import { useState, useEffect, useCallback } from 'react';
import { MapPin, Loader2, LocateFixed, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { calculateDistance } from '@/lib/codSecurity';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
  merchantLocation?: { lat: number; lng: number } | null;
  onDistanceChange?: (distanceKm: number) => void;
  onLocationSelected?: (lat: number, lng: number) => void;
  disabled?: boolean;
  externalCenter?: { lat: number; lng: number } | null;
}

// Component to handle map clicks
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to recenter map when external center changes
function MapCenterUpdater({ center, zoom }: { center: { lat: number; lng: number }; zoom?: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], zoom || map.getZoom(), { animate: true });
    }
  }, [center.lat, center.lng, zoom, map]);
  
  return null;
}

export function LocationPicker({
  value,
  onChange,
  merchantLocation,
  onDistanceChange,
  onLocationSelected,
  disabled,
  externalCenter,
}: LocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: -7.3274, lng: 108.2207 });
  
  // Update map center when external center changes (from address geocoding)
  useEffect(() => {
    if (externalCenter) {
      setMapCenter(externalCenter);
    }
  }, [externalCenter]);

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
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        onChange(location);
        setMapCenter(location);
        
        // Notify parent to update address based on coordinates
        if (onLocationSelected) {
          onLocationSelected(location.lat, location.lng);
        }
        
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
  }, [onChange, onLocationSelected]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!disabled) {
      const location = { lat, lng };
      onChange(location);
      
      // Notify parent to update address based on coordinates
      if (onLocationSelected) {
        onLocationSelected(lat, lng);
      }
    }
  }, [onChange, onLocationSelected, disabled]);

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
              <LocateFixed className="h-4 w-4 mr-1" />
              Lokasi Saya
            </>
          )}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* OpenStreetMap Container */}
      <div 
        className="relative rounded-lg border border-border overflow-hidden bg-muted"
        style={{ height: '220px', width: '100%' }}
      >
        <style>
          {`
            .leaflet-container {
              height: 100% !important;
              width: 100% !important;
              z-index: 1;
            }
            .leaflet-tile-pane { z-index: 1; }
            .leaflet-overlay-pane { z-index: 2; }
            .leaflet-marker-pane { z-index: 3; }
            .leaflet-control-container { z-index: 4; }
            .leaflet-tile { position: absolute; }
          `}
        </style>
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={15}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
          attributionControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onLocationSelect={handleMapClick} />
          <MapCenterUpdater center={mapCenter} />
          {value && (
            <Marker position={[value.lat, value.lng]} />
          )}
        </MapContainer>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Navigation className="h-3 w-3" />
        Klik pada peta atau gunakan "Lokasi Saya" untuk menentukan titik pengiriman
      </p>

      {/* Location status */}
      <div className="rounded-lg border border-border p-3 bg-card">
        {value ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="h-4 w-4" />
              <span className="text-sm font-medium">Lokasi Dipilih</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-1">
            Belum ada lokasi dipilih
          </p>
        )}
      </div>
    </div>
  );
}
