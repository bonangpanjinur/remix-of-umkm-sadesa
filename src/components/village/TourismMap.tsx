import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import type { Tourism } from '@/types';

// Fix for default marker icons in Leaflet with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom tourism icon
const tourismIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface TourismMapProps {
  tourismSpots: Tourism[];
  height?: string;
}

function MapBoundsUpdater({ spots }: { spots: Tourism[] }) {
  const map = useMap();

  useEffect(() => {
    if (spots.length === 0) return;

    const validSpots = spots.filter(
      (s) => s.locationLat && s.locationLng && s.locationLat !== 0 && s.locationLng !== 0
    );

    if (validSpots.length === 0) return;

    if (validSpots.length === 1) {
      map.setView([validSpots[0].locationLat, validSpots[0].locationLng], 14);
    } else {
      const bounds = L.latLngBounds(
        validSpots.map((s) => [s.locationLat, s.locationLng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [spots, map]);

  return null;
}

export function TourismMap({ tourismSpots, height = '300px' }: TourismMapProps) {
  const [loading, setLoading] = useState(true);

  const validSpots = tourismSpots.filter(
    (s) => s.locationLat && s.locationLng && s.locationLat !== 0 && s.locationLng !== 0
  );

  // Default center (Indonesia)
  const defaultCenter: [number, number] = validSpots.length > 0
    ? [validSpots[0].locationLat, validSpots[0].locationLng]
    : [-6.2088, 106.8456];

  useEffect(() => {
    // Small delay to ensure smooth loading
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  if (validSpots.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-xl text-muted-foreground"
        style={{ height }}
      >
        <div className="text-center">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Belum ada lokasi wisata</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-xl"
        style={{ height }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-border" style={{ height }}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBoundsUpdater spots={validSpots} />

        {validSpots.map((spot) => (
          <Marker
            key={spot.id}
            position={[spot.locationLat, spot.locationLng]}
            icon={tourismIcon}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <p className="font-bold text-foreground mb-1">{spot.name}</p>
                <p className="text-muted-foreground text-xs line-clamp-2 mb-2">
                  {spot.description}
                </p>
                {spot.viewCount && (
                  <p className="text-xs text-muted-foreground mb-2">
                    👁 {spot.viewCount.toLocaleString('id-ID')} views
                  </p>
                )}
                <Link to={`/tourism/${spot.id}`}>
                  <Button size="sm" variant="outline" className="w-full text-xs">
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    Lihat Detail
                  </Button>
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Spot count badge */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium shadow-md border border-border">
        <MapPin className="h-3.5 w-3.5 inline mr-1.5 text-primary" />
        {validSpots.length} lokasi wisata
      </div>
    </div>
  );
}
