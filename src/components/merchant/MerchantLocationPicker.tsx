import { useState, useEffect, useCallback } from 'react';
import { MapPin, Loader2, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: '/motor-icon.png',
  iconRetinaUrl: '/motor-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

interface MerchantLocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
  disabled?: boolean;
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

// Component to recenter map when value changes
function MapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  
  return null;
}

export function MerchantLocationPicker({
  value,
  onChange,
  disabled,
}: MerchantLocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Default center (Tasikmalaya)
  const defaultCenter = { lat: -7.3274, lng: 108.2207 };
  const mapCenter = value || defaultCenter;

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

  // Auto-detect GPS on mount if no value set
  useEffect(() => {
    if (!value && navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          onChange({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLoading(false);
        },
        () => {
          setLoading(false);
          // Fallback to default (Tasikmalaya) silently
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []); // Only on mount

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!disabled) {
      onChange({ lat, lng });
    }
  }, [onChange, disabled]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Titik Lokasi Toko</span>
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
        style={{ height: '200px', width: '100%' }}
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
          {value && (
            <>
              <Marker position={[value.lat, value.lng]} />
              <MapUpdater lat={value.lat} lng={value.lng} />
            </>
          )}
        </MapContainer>
      </div>

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
            Klik pada peta atau gunakan tombol "Lokasi Saya"
          </p>
        )}
      </div>
    </div>
  );
}
