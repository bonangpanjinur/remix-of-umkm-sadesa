import { useState, useEffect, useCallback } from 'react';
import { MapPin, Loader2, LocateFixed, Navigation, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { calculateDistance } from '@/lib/codSecurity';
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
  const [autoGpsTriggered, setAutoGpsTriggered] = useState(false);
  
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

  // Auto-trigger GPS on mount
  useEffect(() => {
    if (!autoGpsTriggered && !value && !disabled) {
      setAutoGpsTriggered(true);
      handleGetCurrentLocation();
    }
  }, [autoGpsTriggered, value, disabled, handleGetCurrentLocation]);

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
      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Tentukan Lokasi Pengiriman</span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetCurrentLocation}
            disabled={loading || disabled}
            title="Gunakan GPS untuk mendeteksi lokasi Anda saat ini"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LocateFixed className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Lokasi Saya</span>
                <span className="sm:hidden">GPS</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* OpenStreetMap Container - Enhanced UI */}
      <div 
        className="relative rounded-lg border-2 border-primary/30 overflow-hidden bg-muted shadow-sm hover:border-primary/50 transition-colors cursor-crosshair"
        style={{ height: '280px', width: '100%', zIndex: 0 }}
      >
        <style>
          {`
            .leaflet-container {
              height: 100% !important;
              width: 100% !important;
              z-index: 0 !important;
              cursor: crosshair !important;
            }
            .leaflet-container.leaflet-touch-zoom {
              cursor: grab !important;
            }
            .leaflet-container.leaflet-touch-zoom.leaflet-dragging {
              cursor: grabbing !important;
            }
            .leaflet-pane { z-index: 1 !important; }
            .leaflet-tile-pane { z-index: 1 !important; }
            .leaflet-overlay-pane { z-index: 2 !important; }
            .leaflet-marker-pane { z-index: 3 !important; }
            .leaflet-tooltip-pane { z-index: 4 !important; }
            .leaflet-popup-pane { z-index: 5 !important; }
            .leaflet-control-container { z-index: 6 !important; }
            .leaflet-top, .leaflet-bottom { z-index: 6 !important; }
            .leaflet-tile { position: absolute; }
            .leaflet-marker-icon {
              filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
            }
          `}
        </style>
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={15}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', position: 'relative' }}
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
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <Navigation className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-700 space-y-1">
          <p className="font-medium">Cara menggunakan peta:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Klik pada peta untuk menentukan titik pengiriman</li>
            <li>Gunakan tombol "Lokasi Saya" untuk GPS otomatis</li>
            <li>Geser peta untuk melihat area lain</li>
          </ul>
        </div>
      </div>

      {/* Location status - Enhanced */}
      <div className="rounded-lg border-2 p-4 bg-card">
        {value ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold">Lokasi Dipilih</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted p-2 rounded">
                <p className="text-muted-foreground">Latitude</p>
                <p className="font-mono font-medium">{value.lat.toFixed(6)}</p>
              </div>
              <div className="bg-muted p-2 rounded">
                <p className="text-muted-foreground">Longitude</p>
                <p className="font-mono font-medium">{value.lng.toFixed(6)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Akurasi: ~5-10m (GPS/Peta)
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <MapPin className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Belum ada lokasi dipilih</p>
            <p className="text-xs text-muted-foreground mt-1">
              Klik pada peta atau gunakan "Lokasi Saya" untuk memulai
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
