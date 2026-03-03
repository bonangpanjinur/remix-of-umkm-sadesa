import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, Bike, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';
import { LocationPicker } from '@/components/checkout/LocationPicker';

interface FareSettings {
  base_fare: number;
  per_km_fare: number;
  min_fare: number;
  max_fare: number;
}

const DEFAULT_FARE: FareSettings = { base_fare: 5000, per_km_fare: 3000, min_fare: 5000, max_fare: 100000 };

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function RideBookingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<'pickup' | 'destination' | 'confirm'>('pickup');
  const [pickupLocation, setPickupLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [destLocation, setDestLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destAddress, setDestAddress] = useState('');
  const [fareSettings, setFareSettings] = useState<FareSettings>(DEFAULT_FARE);
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    // Fetch fare settings
    supabase.from('app_settings').select('value').eq('key', 'ride_fare_settings').maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const v = data.value as Record<string, unknown>;
          setFareSettings({
            base_fare: Number(v.base_fare) || DEFAULT_FARE.base_fare,
            per_km_fare: Number(v.per_km_fare) || DEFAULT_FARE.per_km_fare,
            min_fare: Number(v.min_fare) || DEFAULT_FARE.min_fare,
            max_fare: Number(v.max_fare) || DEFAULT_FARE.max_fare,
          });
        }
      });
  }, [user, navigate]);

  const useCurrentLocation = useCallback(() => {
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickupLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPickupAddress('Lokasi saya saat ini');
        setGettingLocation(false);
      },
      () => {
        toast({ title: 'Gagal mendapatkan lokasi', variant: 'destructive' });
        setGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const distanceKm = pickupLocation && destLocation
    ? haversineDistance(pickupLocation.lat, pickupLocation.lng, destLocation.lat, destLocation.lng)
    : 0;

  const estimatedFare = Math.min(
    fareSettings.max_fare,
    Math.max(fareSettings.min_fare, Math.round(fareSettings.base_fare + distanceKm * fareSettings.per_km_fare))
  );

  const handleSubmit = async () => {
    if (!user || !pickupLocation || !destLocation) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('ride_requests').insert([{
        passenger_id: user.id,
        pickup_lat: pickupLocation.lat,
        pickup_lng: pickupLocation.lng,
        pickup_address: pickupAddress || 'Titik jemput',
        destination_lat: destLocation.lat,
        destination_lng: destLocation.lng,
        destination_address: destAddress || 'Titik tujuan',
        distance_km: Math.round(distanceKm * 100) / 100,
        estimated_fare: estimatedFare,
        status: 'SEARCHING',
      }]).select('id').single();

      if (error) throw error;
      toast({ title: 'Mencari driver...', description: 'Permintaan ojek Anda sedang dicari driver terdekat' });
      navigate(`/ride/${data.id}`);
    } catch (err: unknown) {
      console.error(err);
      toast({ title: 'Gagal memesan ojek', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
            <Bike className="h-6 w-6 text-primary" />
            Ojek Desa
          </h1>
          <p className="text-sm text-muted-foreground">Pesan ojek untuk perjalanan Anda</p>
        </motion.div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className={`px-3 py-1.5 rounded-full ${step === 'pickup' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>1. Jemput</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className={`px-3 py-1.5 rounded-full ${step === 'destination' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2. Tujuan</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className={`px-3 py-1.5 rounded-full ${step === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>3. Pesan</span>
        </div>

        {/* Step 1: Pickup */}
        {step === 'pickup' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                Titik Jemput
              </h3>
              <Button variant="outline" className="w-full" onClick={useCurrentLocation} disabled={gettingLocation}>
                {gettingLocation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Navigation className="h-4 w-4 mr-2" />}
                Gunakan Lokasi Saya
              </Button>
              <p className="text-xs text-muted-foreground text-center">atau pilih di peta:</p>
              <div className="h-64 rounded-lg overflow-hidden border border-border">
                <LocationPicker
                  value={pickupLocation}
                  onChange={(loc) => { setPickupLocation(loc); setPickupAddress('Titik jemput dari peta'); }}
                />
              </div>
              <Input
                placeholder="Nama titik jemput (opsional)"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
              />
              <Button className="w-full" disabled={!pickupLocation} onClick={() => setStep('destination')}>
                Lanjut Pilih Tujuan
              </Button>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Destination */}
        {step === 'destination' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                Titik Tujuan
              </h3>
              <div className="h-64 rounded-lg overflow-hidden border border-border">
                <LocationPicker
                  value={destLocation}
                  onChange={(loc) => { setDestLocation(loc); setDestAddress('Titik tujuan dari peta'); }}
                />
              </div>
              <Input
                placeholder="Nama titik tujuan (opsional)"
                value={destAddress}
                onChange={(e) => setDestAddress(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep('pickup')}>Kembali</Button>
                <Button className="flex-1" disabled={!destLocation} onClick={() => setStep('confirm')}>Lihat Estimasi</Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Card className="p-4 space-y-4">
              <h3 className="font-semibold">Ringkasan Perjalanan</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Jemput</p>
                    <p className="text-sm font-medium">{pickupAddress || 'Titik jemput'}</p>
                  </div>
                </div>
                <div className="ml-1.5 border-l-2 border-dashed border-border h-4" />
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-destructive mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tujuan</p>
                    <p className="text-sm font-medium">{destAddress || 'Titik tujuan'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-muted rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jarak</span>
                  <span className="font-medium">{distanceKm.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tarif dasar</span>
                  <span>{formatPrice(fareSettings.base_fare)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Biaya jarak</span>
                  <span>{formatPrice(Math.round(distanceKm * fareSettings.per_km_fare))}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span>Estimasi Total</span>
                  <span className="text-primary">{formatPrice(estimatedFare)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep('destination')}>Ubah</Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bike className="h-4 w-4 mr-2" />}
                  Pesan Ojek
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
