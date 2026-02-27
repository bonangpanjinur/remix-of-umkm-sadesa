import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Loader2, WifiOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface MerchantDeliveryTrackerProps {
  orderId: string;
  merchantId: string;
  onLocationUpdate?: (lat: number, lng: number) => void;
}

export function MerchantDeliveryTracker({ orderId, merchantId, onLocationUpdate }: MerchantDeliveryTrackerProps) {
  const [isTracking, setIsTracking] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`merchant-delivery-${orderId}`) === 'true';
    }
    return false;
  });
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);
  const isInitialMount = useRef(true);

  const updateLocationToServer = async (lat: number, lng: number) => {
    try {
      await supabase
        .from('merchants')
        .update({
          location_lat: lat,
          location_lng: lng,
        })
        .eq('id', merchantId);
      onLocationUpdate?.(lat, lng);
    } catch (err) {
      console.error('Error updating merchant location:', err);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation tidak didukung oleh browser Anda');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        updateLocationToServer(latitude, longitude);
        setLoading(false);
        setIsTracking(true);
        toast({ title: 'Tracking aktif', description: 'Lokasi Anda dibagikan ke pembeli' });
      },
      (err) => {
        setError(getGeolocationError(err));
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Broadcast channel per order
    const channel = supabase.channel(`merchant-delivery-${orderId}`);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
      }
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        locationRef.current = { lat: latitude, lng: longitude };

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'location-update',
            payload: {
              id: merchantId,
              lat: latitude,
              lng: longitude,
              timestamp: new Date().toISOString(),
            },
          });
        }
      },
      (err) => console.error('Watch position error:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    // Checkpoint to DB every 30 seconds
    intervalRef.current = setInterval(() => {
      if (locationRef.current) {
        updateLocationToServer(locationRef.current.lat, locationRef.current.lng);
      }
    }, 30000);
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setIsTracking(false);
    localStorage.removeItem(`merchant-delivery-${orderId}`);
    toast({ title: 'Tracking dinonaktifkan' });
  };

  const handleToggle = (checked: boolean) => {
    if (checked) {
      localStorage.setItem(`merchant-delivery-${orderId}`, 'true');
      startTracking();
    } else {
      stopTracking();
    }
  };

  useEffect(() => {
    if (!isInitialMount.current) return;
    isInitialMount.current = false;
    if (isTracking) startTracking();
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const getGeolocationError = (error: GeolocationPositionError): string => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Akses lokasi ditolak. Silakan izinkan akses lokasi di pengaturan browser.';
      case error.POSITION_UNAVAILABLE:
        return 'Informasi lokasi tidak tersedia.';
      case error.TIMEOUT:
        return 'Waktu permintaan lokasi habis. Coba lagi.';
      default:
        return 'Terjadi kesalahan saat mendapatkan lokasi.';
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isTracking ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
          }`}>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isTracking ? (
              <Navigation className="h-5 w-5" />
            ) : (
              <MapPin className="h-5 w-5" />
            )}
          </div>
          <div>
            <Label className="text-sm font-medium">Live Tracking Pengiriman</Label>
            <p className="text-xs text-muted-foreground">
              {isTracking ? 'Lokasi Anda terlihat oleh pembeli' : 'Bagikan lokasi ke pembeli'}
            </p>
          </div>
        </div>
        <Switch checked={isTracking} onCheckedChange={handleToggle} disabled={loading} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {currentLocation && isTracking && (
        <div className="flex items-center gap-2 text-success text-sm bg-success/10 p-3 rounded-lg">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>Lokasi: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}</span>
        </div>
      )}

      {isTracking && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            if (currentLocation) {
              updateLocationToServer(currentLocation.lat, currentLocation.lng);
              toast({ title: 'Lokasi diperbarui' });
            }
          }}
        >
          <Navigation className="h-4 w-4 mr-2" />
          Perbarui Lokasi Sekarang
        </Button>
      )}
    </div>
  );
}
