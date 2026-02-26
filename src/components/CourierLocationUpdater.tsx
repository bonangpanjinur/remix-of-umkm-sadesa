import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Loader2, WifiOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface CourierLocationUpdaterProps {
  courierId: string;
  onLocationUpdate?: (lat: number, lng: number) => void;
}

export function CourierLocationUpdater({ courierId, onLocationUpdate }: CourierLocationUpdaterProps) {
  const [isTracking, setIsTracking] = useState(() => {
    // Restore tracking state from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`courier-tracking-${courierId}`);
      return saved === 'true';
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
      const { error } = await supabase
        .from('couriers')
        .update({
          current_lat: lat,
          current_lng: lng,
          last_location_update: new Date().toISOString(),
        })
        .eq('id', courierId);

      if (error) throw error;
      
      onLocationUpdate?.(lat, lng);
    } catch (err) {
      console.error('Error updating location:', err);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation tidak didukung oleh browser Anda');
      return;
    }

    setLoading(true);
    setError(null);

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        updateLocationToServer(latitude, longitude);
        setLoading(false);
        setIsTracking(true);

        toast({
          title: 'Tracking aktif',
          description: 'Lokasi Anda akan diperbarui secara berkala',
        });
      },
      (err) => {
        setError(getGeolocationError(err));
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    // Initialize broadcast channel
    const channel = supabase.channel(`courier-tracking-${courierId}`);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
      }
    });

    // Watch position for real-time updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        locationRef.current = { lat: latitude, lng: longitude };

        // Broadcast via websocket (no DB write)
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'location-update',
            payload: { id: courierId, lat: latitude, lng: longitude, timestamp: new Date().toISOString() },
          });
        }
      },
      (err) => {
        console.error('Watch position error:', err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
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
    localStorage.removeItem(`courier-tracking-${courierId}`);
    toast({
      title: 'Tracking dinonaktifkan',
    });
  };

  const handleToggle = (checked: boolean) => {
    if (checked) {
      localStorage.setItem(`courier-tracking-${courierId}`, 'true');
      startTracking();
    } else {
      stopTracking();
    }
  };

  // Restore tracking state on mount if it was previously active
  useEffect(() => {
    if (!isInitialMount.current) return;
    isInitialMount.current = false;

    // If tracking was enabled before reload, restart it
    if (isTracking) {
      startTracking();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
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
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
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
            <Label className="text-sm font-medium">Live Tracking</Label>
            <p className="text-xs text-muted-foreground">
              {isTracking ? 'Lokasi Anda sedang dibagikan' : 'Bagikan lokasi realtime'}
            </p>
          </div>
        </div>
        <Switch
          checked={isTracking}
          onCheckedChange={handleToggle}
          disabled={loading}
        />
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
          <span>
            Lokasi: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
          </span>
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
