import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bike, Clock, MapPin, Star, ChevronRight } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';

interface RideHistory {
  id: string;
  status: string;
  pickup_address: string;
  destination_address: string;
  distance_km: number;
  estimated_fare: number;
  final_fare: number | null;
  rating: number | null;
  created_at: string;
  completed_at: string | null;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  COMPLETED: { label: 'Selesai', variant: 'default' },
  CANCELLED: { label: 'Dibatalkan', variant: 'destructive' },
  SEARCHING: { label: 'Mencari', variant: 'secondary' },
  ACCEPTED: { label: 'Diterima', variant: 'secondary' },
  PICKED_UP: { label: 'Dijemput', variant: 'secondary' },
  IN_TRANSIT: { label: 'Dalam Perjalanan', variant: 'secondary' },
};

export default function RideHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rides, setRides] = useState<RideHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_requests')
        .select('id, status, pickup_address, destination_address, distance_km, estimated_fare, final_fare, rating, created_at, completed_at')
        .eq('passenger_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setRides((data || []) as unknown as RideHistory[]);
    } catch {
      console.error('Failed to fetch ride history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Riwayat Perjalanan
          </h1>
          <Button size="sm" onClick={() => navigate('/ride')}>
            <Bike className="h-4 w-4 mr-1" /> Pesan
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : rides.length === 0 ? (
          <Card className="p-8 text-center">
            <Bike className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">Belum ada riwayat perjalanan</p>
            <Button onClick={() => navigate('/ride')}>Pesan Ojek Sekarang</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {rides.map((ride, idx) => {
              const status = STATUS_MAP[ride.status] || STATUS_MAP.SEARCHING;
              return (
                <motion.div key={ride.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Link to={`/ride/${ride.id}`}>
                    <Card className="p-4 hover:bg-secondary/50 transition cursor-pointer">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-xs text-muted-foreground">
                          {new Date(ride.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <div className="space-y-1.5 mb-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          <span className="truncate">{ride.pickup_address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                          <span className="truncate">{ride.destination_address}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{ride.distance_km} km</span>
                        <div className="flex items-center gap-2">
                          {ride.rating && (
                            <span className="flex items-center gap-0.5 text-amber-500">
                              <Star className="h-3.5 w-3.5 fill-current" />
                              {ride.rating}
                            </span>
                          )}
                          <span className="font-bold">{formatPrice(ride.final_fare || ride.estimated_fare)}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
