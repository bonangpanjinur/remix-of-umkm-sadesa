import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin, ExternalLink, Home } from 'lucide-react';
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

// Blue icon for tourism spots
const tourismIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Red icon for village center
const villageIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface VillageCenter {
  name: string;
  lat: number;
  lng: number;
  image?: string;
}

interface TourismMapProps {
  tourismSpots: Tourism[];
  villageCenter?: VillageCenter | null;
  height?: string;
}

function MapBoundsUpdater({ spots, villageCenter }: { spots: Tourism[]; villageCenter?: VillageCenter | null }) {
  const map = useMap();

  useEffect(() => {
    const allPoints: [number, number][] = [];

    if (villageCenter && villageCenter.lat !== 0 && villageCenter.lng !== 0) {
      allPoints.push([villageCenter.lat, villageCenter.lng]);
    }

    spots.forEach((s) => {
      if (s.locationLat && s.locationLng && s.locationLat !== 0 && s.locationLng !== 0) {
        allPoints.push([s.locationLat, s.locationLng]);
      }
    });

    if (allPoints.length === 0) return;

    if (allPoints.length === 1) {
      map.setView(allPoints[0], 14);
    } else {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [spots, villageCenter, map]);

  return null;
}

export function TourismMap({ tourismSpots, villageCenter, height = '300px' }: TourismMapProps) {
  const [loading, setLoading] = useState(true);

  const validSpots = tourismSpots.filter(
    (s) => s.locationLat && s.locationLng && s.locationLat !== 0 && s.locationLng !== 0
  );

  const hasVillageCenter = villageCenter && villageCenter.lat !== 0 && villageCenter.lng !== 0;
  const hasAnyPoint = validSpots.length > 0 || hasVillageCenter;

  // Default center (Indonesia)
  const defaultCenter: [number, number] = hasVillageCenter
    ? [villageCenter!.lat, villageCenter!.lng]
    : validSpots.length > 0
      ? [validSpots[0].locationLat, validSpots[0].locationLng]
      : [-6.2088, 106.8456];

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  if (!hasAnyPoint) {
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
        <MapBoundsUpdater spots={validSpots} villageCenter={villageCenter} />

        {/* Village Center Marker (Red) */}
        {hasVillageCenter && (
          <Marker
            position={[villageCenter!.lat, villageCenter!.lng]}
            icon={villageIcon}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <p className="font-bold mb-1">📍 {villageCenter!.name}</p>
                <p className="text-xs text-muted-foreground">Pusat Desa Wisata</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Tourism Spots Markers (Blue) */}
        {validSpots.map((spot) => (
          <Marker
            key={spot.id}
            position={[spot.locationLat, spot.locationLng]}
            icon={tourismIcon}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <p className="font-bold mb-1">{spot.name}</p>
                <p className="text-xs line-clamp-2 mb-2">
                  {spot.description}
                </p>
                {spot.viewCount != null && spot.viewCount > 0 && (
                  <p className="text-xs mb-2">
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

      {/* Legend & count badge */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium shadow-md border border-border flex items-center gap-3">
        {hasVillageCenter && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            Desa
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
          {validSpots.length} Wisata
        </span>
      </div>
    </div>
  );
}
