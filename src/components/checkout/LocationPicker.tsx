import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { calculateDistance } from '@/lib/codSecurity';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
  merchantLocation?: { lat: number; lng: number } | null;
  onDistanceChange?: (distanceKm: number) => void;
  disabled?: boolean;
}

export function LocationPicker({
  value,
  onChange,
  merchantLocation,
  onDistanceChange,
  disabled,
}: LocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate distance when location changes
  useEffect(() => {
    if (value && merchantLocation && onDistanceChange) {
      const distance = calculateDistance(
        value.lat,
        value.lng,
        merchantLocation.lat,
        merchantLocation.lng
      );
      onDistanceChange(distance);
    }
  }, [value, merchantLocation, onDistanceChange]);

  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Browser tidak mendukung geolokasi');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('Gagal mendapatkan lokasi. Pastikan izin lokasi diaktifkan.');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Titik Lokasi Pengiriman</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGetCurrentLocation}
          disabled={loading || disabled}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Navigation className="h-4 w-4 mr-1" />
              Lokasi Saya
            </>
          )}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Location status */}
      <div className="rounded-lg border border-border p-4 bg-secondary/30">
        {value ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="h-5 w-5" />
              <span className="font-medium">Lokasi Terdeteksi</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Koordinat: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Klik tombol "Lokasi Saya" untuk menentukan titik pengiriman
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Gunakan tombol "Lokasi Saya" untuk mendeteksi lokasi pengiriman secara otomatis
      </p>
    </div>
  );
}
