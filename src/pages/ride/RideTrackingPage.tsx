import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bike, Phone, X, CheckCircle, MapPin, Clock, Loader2, User, Navigation, Star, MessageCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CourierMap } from '@/components/CourierMap';
import { OrderChat } from '@/components/chat/OrderChat';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';

interface RideData {
  id: string;
  status: string;
  pickup_address: string;
  destination_address: string;
  pickup_lat: number;
  pickup_lng: number;
  destination_lat: number;
  destination_lng: number;
  distance_km: number;
  estimated_fare: number;
  final_fare: number | null;
  driver_id: string | null;
  rating: number | null;
  rating_comment: string | null;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

interface DriverInfo {
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  photo_url: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SEARCHING: { label: 'Mencari Driver', color: 'bg-amber-500' },
  ACCEPTED: { label: 'Driver Ditemukan', color: 'bg-blue-500' },
  PICKED_UP: { label: 'Dalam Perjalanan', color: 'bg-primary' },
  IN_TRANSIT: { label: 'Menuju Tujuan', color: 'bg-primary' },
  COMPLETED: { label: 'Selesai', color: 'bg-emerald-500' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-destructive' },
};

const SEARCH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function RideTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ride, setRide] = useState<RideData | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [searchCountdown, setSearchCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    fetchRide();

    const channel = supabase
      .channel(`ride-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ride_requests',
        filter: `id=eq.${id}`,
      }, (payload) => {
        const updated = payload.new as Record<string, unknown>;
        setRide(prev => prev ? { ...prev, ...updated } as unknown as RideData : null);
        if (updated.driver_id && !driver) {
          fetchDriver(updated.driver_id as string);
        }
        if (updated.status === 'ACCEPTED') {
          toast({ title: '🎉 Driver ditemukan!', description: 'Driver sedang menuju lokasi jemput Anda' });
        }
        if (updated.status === 'COMPLETED') {
          toast({ title: '✅ Perjalanan selesai!', description: 'Terima kasih telah menggunakan Ojek Desa' });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, id]);

  // Search timeout countdown
  useEffect(() => {
    if (!ride || ride.status !== 'SEARCHING') {
      setSearchCountdown(null);
      return;
    }

    const createdAt = new Date(ride.created_at).getTime();
    const deadline = createdAt + SEARCH_TIMEOUT_MS;

    const tick = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        setSearchCountdown(0);
        // Auto-cancel
        autoCancel();
      } else {
        setSearchCountdown(Math.ceil(remaining / 1000));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [ride?.status, ride?.created_at]);

  const autoCancel = useCallback(async () => {
    if (!ride || ride.status !== 'SEARCHING') return;
    try {
      await supabase
        .from('ride_requests')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Tidak ada driver tersedia dalam waktu yang ditentukan',
        } as Record<string, unknown>)
        .eq('id', ride.id)
        .eq('status', 'SEARCHING'); // Only cancel if still searching
      toast({ title: '⏰ Pencarian habis waktu', description: 'Tidak ada driver tersedia. Silakan coba lagi.' });
    } catch {
      // Silent fail
    }
  }, [ride]);

  const fetchRide = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      setRide(data as unknown as RideData);
      if (data.driver_id) fetchDriver(data.driver_id);
    } catch {
      toast({ title: 'Gagal memuat data perjalanan', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchDriver = async (driverId: string) => {
    const { data } = await supabase
      .from('couriers')
      .select('name, phone, vehicle_type, vehicle_plate, photo_url')
      .eq('id', driverId)
      .single();
    if (data) setDriver(data);
  };

  const handleCancelClick = () => {
    if (ride?.status === 'ACCEPTED') {
      setShowCancelConfirm(true);
    } else {
      doCancel();
    }
  };

  const doCancel = async () => {
    if (!ride) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Dibatalkan oleh penumpang',
        } as Record<string, unknown>)
        .eq('id', ride.id);
      if (error) throw error;

      if (ride.driver_id) {
        const { data: courierData } = await supabase
          .from('couriers')
          .select('user_id')
          .eq('id', ride.driver_id)
          .single();
        if (courierData?.user_id) {
          await supabase.from('notifications').insert({
            user_id: courierData.user_id,
            title: 'Perjalanan Dibatalkan',
            message: 'Penumpang membatalkan perjalanan ojek',
            type: 'ride',
          });
        }
      }

      toast({ title: 'Perjalanan dibatalkan' });
      navigate('/ride/history');
    } catch {
      toast({ title: 'Gagal membatalkan', variant: 'destructive' });
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const submitRating = async () => {
    if (!ride) return;
    setSubmittingRating(true);
    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({
          rating: ratingValue,
          rating_comment: ratingComment || null,
        } as Record<string, unknown>)
        .eq('id', ride.id);
      if (error) throw error;
      setRide(prev => prev ? { ...prev, rating: ratingValue, rating_comment: ratingComment } : null);
      toast({ title: '⭐ Terima kasih atas penilaian Anda!' });
      setShowRatingDialog(false);
    } catch {
      toast({ title: 'Gagal mengirim rating', variant: 'destructive' });
    } finally {
      setSubmittingRating(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="text-center py-20">
          <p className="text-muted-foreground">Perjalanan tidak ditemukan</p>
          <Button className="mt-4" onClick={() => navigate('/ride')}>Pesan Ojek Baru</Button>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[ride.status] || STATUS_LABELS.SEARCHING;
  const canCancel = ['SEARCHING', 'ACCEPTED'].includes(ride.status);
  const showMap = ride.driver_id && !['CANCELLED', 'COMPLETED'].includes(ride.status);
  const canRate = ride.status === 'COMPLETED' && !ride.rating;

  return (
    <div className="mobile-shell bg-background min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto max-w-lg mx-auto px-4 py-6 pb-24 space-y-4">
        {/* Status Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-4 h-4 rounded-full ${statusInfo.color} ${ride.status === 'SEARCHING' ? 'animate-pulse' : ''}`} />
              <h2 className="text-lg font-bold">{statusInfo.label}</h2>
            </div>

            {ride.status === 'SEARCHING' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">Sedang mencari driver terdekat...</p>
                </div>
                {/* Countdown timer */}
                {searchCountdown !== null && searchCountdown > 0 && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Batas waktu pencarian</span>
                    </div>
                    <span className="font-mono font-bold text-lg">{formatCountdown(searchCountdown)}</span>
                  </div>
                )}
                {searchCountdown === 0 && (
                  <div className="p-3 bg-destructive/10 rounded-lg text-center space-y-2">
                    <p className="text-sm font-medium text-destructive">Waktu pencarian habis</p>
                    <Button size="sm" variant="outline" onClick={() => navigate('/ride')}>
                      <Bike className="h-4 w-4 mr-1" /> Coba Lagi
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Real-time Map */}
        {showMap && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <CourierMap
              courierId={ride.driver_id!}
              height="250px"
              destinationLat={ride.destination_lat}
              destinationLng={ride.destination_lng}
              destinationLabel="Tujuan"
            />
          </motion.div>
        )}

        {/* Driver Info */}
        {driver && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-4">
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground">Driver Anda</h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {driver.photo_url ? (
                    <img src={driver.photo_url} alt={driver.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold">{driver.name}</p>
                  <p className="text-sm text-muted-foreground">{driver.vehicle_type === 'motor' ? 'Motor' : driver.vehicle_type} {driver.vehicle_plate && `• ${driver.vehicle_plate}`}</p>
                </div>
                <a href={`tel:${driver.phone}`}>
                  <Button size="icon" variant="outline">
                    <Phone className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Route Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Jemput</p>
                <p className="text-sm font-medium">{ride.pickup_address}</p>
              </div>
            </div>
            <div className="ml-1.5 border-l-2 border-dashed border-border h-4" />
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-destructive mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Tujuan</p>
                <p className="text-sm font-medium">{ride.destination_address}</p>
              </div>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">Jarak: {ride.distance_km} km</span>
              <span className="font-bold text-primary">{formatPrice(ride.final_fare || ride.estimated_fare)}</span>
            </div>
          </Card>
        </motion.div>

        {/* Status Timeline */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-4">
            <h3 className="font-semibold mb-3 text-sm">Status Perjalanan</h3>
            <div className="space-y-3">
              {['SEARCHING', 'ACCEPTED', 'PICKED_UP', 'COMPLETED'].map((s, i) => {
                const steps = ['SEARCHING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'COMPLETED'];
                const currentIdx = steps.indexOf(ride.status);
                const stepIdx = steps.indexOf(s);
                const isActive = stepIdx <= currentIdx;
                const labels = { SEARCHING: 'Mencari driver', ACCEPTED: 'Driver ditemukan', PICKED_UP: 'Dijemput', COMPLETED: 'Selesai' };
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {isActive ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <span className={`text-sm ${isActive ? 'font-medium' : 'text-muted-foreground'}`}>
                      {labels[s as keyof typeof labels]}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Rating display if already rated */}
        {ride.rating && (
          <Card className="p-4">
            <h3 className="font-semibold mb-2 text-sm">Penilaian Anda</h3>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`h-5 w-5 ${s <= ride.rating! ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
              ))}
            </div>
            {ride.rating_comment && <p className="text-sm text-muted-foreground mt-2">{ride.rating_comment}</p>}
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {canCancel && (
            <Button variant="destructive" className="flex-1" onClick={handleCancelClick} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
              Batalkan
            </Button>
          )}
          {canRate && (
            <Button className="flex-1" variant="outline" onClick={() => setShowRatingDialog(true)}>
              <Star className="h-4 w-4 mr-2" />
              Beri Rating
            </Button>
          )}
          {ride.status === 'COMPLETED' && (
            <Button className="flex-1" onClick={() => navigate('/ride')}>
              <Bike className="h-4 w-4 mr-2" />
              Pesan Lagi
            </Button>
          )}
          {ride.status === 'CANCELLED' && (
            <Button className="flex-1" onClick={() => navigate('/ride')}>
              <Bike className="h-4 w-4 mr-2" />
              Pesan Ojek Baru
            </Button>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Perjalanan?</AlertDialogTitle>
            <AlertDialogDescription>
              Driver sudah ditemukan dan sedang menuju lokasi Anda. Yakin ingin membatalkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tidak</AlertDialogCancel>
            <AlertDialogAction onClick={doCancel} className="bg-destructive text-destructive-foreground">
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rating Dialog */}
      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Beri Rating Driver</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRatingValue(s)} className="p-1">
                  <Star className={`h-8 w-8 transition ${s <= ratingValue ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Komentar (opsional)"
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button onClick={submitRating} disabled={submittingRating}>
              {submittingRating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Kirim Rating
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BottomNav />
    </div>
  );
}
