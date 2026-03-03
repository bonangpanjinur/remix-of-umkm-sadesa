import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bike, MapPin, Navigation, CheckCircle, Loader2, RefreshCw, Phone, User } from 'lucide-react';
import { CourierLayout } from '@/components/courier/CourierLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';

interface RideRequest {
  id: string;
  passenger_id: string;
  status: string;
  pickup_address: string;
  destination_address: string;
  pickup_lat: number;
  pickup_lng: number;
  destination_lat: number;
  destination_lng: number;
  distance_km: number;
  estimated_fare: number;
  created_at: string;
}

interface ActiveRide extends RideRequest {
  driver_id: string | null;
}

export default function CourierRidesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courierId, setCourierId] = useState<string | null>(null);
  const [availableRides, setAvailableRides] = useState<RideRequest[]>([]);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchCourierAndRides();
  }, [user]);

  useEffect(() => {
    if (!courierId) return;
    // Subscribe to new ride requests
    const channel = supabase
      .channel('ride-requests-courier')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ride_requests',
      }, () => {
        fetchRides();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [courierId]);

  const fetchCourierAndRides = async () => {
    try {
      const { data: courier } = await supabase
        .from('couriers')
        .select('id')
        .eq('user_id', user!.id)
        .eq('registration_status', 'APPROVED')
        .maybeSingle();

      if (!courier) {
        setLoading(false);
        return;
      }
      setCourierId(courier.id);
      await fetchRidesWithCourierId(courier.id);
    } catch {
      console.error('Failed to fetch courier data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRides = async () => {
    if (courierId) await fetchRidesWithCourierId(courierId);
  };

  const fetchRidesWithCourierId = async (cId: string) => {
    // Fetch available rides (SEARCHING)
    const { data: available } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('status', 'SEARCHING')
      .order('created_at', { ascending: false })
      .limit(20);

    setAvailableRides((available || []) as unknown as RideRequest[]);

    // Fetch active ride assigned to this courier
    const { data: active } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('driver_id', cId)
      .in('status', ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'])
      .order('created_at', { ascending: false })
      .limit(1);

    setActiveRide(active && active.length > 0 ? (active[0] as unknown as ActiveRide) : null);
  };

  const acceptRide = async (rideId: string) => {
    if (!courierId) return;
    setAccepting(rideId);
    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({
          driver_id: courierId,
          status: 'ACCEPTED',
          accepted_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', rideId)
        .eq('status', 'SEARCHING');

      if (error) throw error;
      toast({ title: '✅ Ride diterima!' });
      fetchRides();
    } catch {
      toast({ title: 'Gagal menerima ride', variant: 'destructive' });
    } finally {
      setAccepting(null);
    }
  };

  const updateRideStatus = async (newStatus: string) => {
    if (!activeRide) return;
    setUpdatingStatus(true);
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'PICKED_UP') updateData.picked_up_at = new Date().toISOString();
      if (newStatus === 'COMPLETED') {
        updateData.completed_at = new Date().toISOString();
        updateData.final_fare = activeRide.estimated_fare;
      }

      const { error } = await supabase
        .from('ride_requests')
        .update(updateData)
        .eq('id', activeRide.id);

      if (error) throw error;
      toast({ title: newStatus === 'COMPLETED' ? '✅ Perjalanan selesai!' : 'Status diperbarui' });
      fetchRides();
    } catch {
      toast({ title: 'Gagal memperbarui status', variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getNextAction = () => {
    if (!activeRide) return null;
    switch (activeRide.status) {
      case 'ACCEPTED': return { label: 'Sudah Dijemput', nextStatus: 'PICKED_UP' };
      case 'PICKED_UP': return { label: 'Mulai Perjalanan', nextStatus: 'IN_TRANSIT' };
      case 'IN_TRANSIT': return { label: 'Selesai', nextStatus: 'COMPLETED' };
      default: return null;
    }
  };

  const openNavigation = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  return (
    <CourierLayout title="Ojek Desa" subtitle="Terima dan kelola perjalanan ojek">
      <div className="space-y-6">
        {/* Active Ride */}
        {activeRide && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-primary border-2">
              <div className="flex items-center gap-2 mb-3">
                <Bike className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Perjalanan Aktif</h3>
                <Badge>{activeRide.status}</Badge>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Jemput</p>
                    <p className="font-medium">{activeRide.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tujuan</p>
                    <p className="font-medium">{activeRide.destination_address}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-muted-foreground">{activeRide.distance_km} km</span>
                <span className="font-bold text-primary text-lg">{formatPrice(activeRide.estimated_fare)}</span>
              </div>

              <div className="flex gap-2">
                {activeRide.status === 'ACCEPTED' && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openNavigation(activeRide.pickup_lat, activeRide.pickup_lng)}>
                    <Navigation className="h-4 w-4 mr-1" /> Navigasi Jemput
                  </Button>
                )}
                {['PICKED_UP', 'IN_TRANSIT'].includes(activeRide.status) && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openNavigation(activeRide.destination_lat, activeRide.destination_lng)}>
                    <Navigation className="h-4 w-4 mr-1" /> Navigasi Tujuan
                  </Button>
                )}
                {getNextAction() && (
                  <Button size="sm" className="flex-1" onClick={() => updateRideStatus(getNextAction()!.nextStatus)} disabled={updatingStatus}>
                    {updatingStatus ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    {getNextAction()!.label}
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Available Rides */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Permintaan Ojek ({availableRides.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={fetchRides}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : availableRides.length === 0 ? (
            <Card className="p-8 text-center">
              <Bike className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada permintaan ojek saat ini</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {availableRides.map((ride, idx) => (
                <motion.div key={ride.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs text-muted-foreground">
                        {new Date(ride.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <Badge variant="secondary">{ride.distance_km} km</Badge>
                    </div>
                    <div className="space-y-1.5 mb-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        <span className="truncate">{ride.pickup_address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                        <span className="truncate">{ride.destination_address}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary">{formatPrice(ride.estimated_fare)}</span>
                      <Button size="sm" onClick={() => acceptRide(ride.id)} disabled={accepting === ride.id || !!activeRide}>
                        {accepting === ride.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                        Terima
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CourierLayout>
  );
}
