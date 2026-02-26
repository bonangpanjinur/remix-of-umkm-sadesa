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

interface AdminLocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
  disabled?: boolean;
  height?: string;
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

export function AdminLocationPicker({
  value,
  onChange,
  disabled,
  height = '180px',
}: AdminLocationPickerProps) {
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
        setError('Gagal mendapatkan lokasi');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [onChange]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!disabled) {
      onChange({ lat, lng });
    }
  }, [onChange, disabled]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Titik Lokasi</span>
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
        style={{ height, width: '100%' }}
      >
        <style>
          {`
            .admin-map-container .leaflet-container {
              height: 100% !important;
              width: 100% !important;
              z-index: 1;
            }
            .admin-map-container .leaflet-tile-pane { z-index: 1; }
            .admin-map-container .leaflet-overlay-pane { z-index: 2; }
            .admin-map-container .leaflet-marker-pane { z-index: 3; }
            .admin-map-container .leaflet-control-container { z-index: 4; }
            .admin-map-container .leaflet-tile { position: absolute; }
          `}
        </style>
        <div className="admin-map-container" style={{ height: '100%', width: '100%' }}>
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
      </div>

      {/* Location status */}
      <div className="rounded border border-border p-2 bg-card">
        {value ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-primary font-medium">Lokasi Terpilih</span>
            <span className="text-muted-foreground font-mono text-xs">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center">
            Klik pada peta untuk memilih lokasi
          </p>
        )}
      </div>
    </div>
  );
}
