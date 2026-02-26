import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Navigation, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

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

// Custom courier icon (motorcycle)
const courierIcon = new L.Icon({
  iconUrl: '/motorcycle-icon.png',
  shadowUrl: markerShadow,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
  shadowSize: [41, 41],
  className: 'courier-motorcycle-icon',
});

// Destination icon (red)
const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface CourierLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lastUpdate: string;
  isAvailable: boolean;
}

interface CourierMapProps {
  courierId?: string;
  showAllCouriers?: boolean;
  height?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  destinationLabel?: string;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [points, map]);
  return null;
}

export function CourierMap({ courierId, showAllCouriers = false, height = '400px', destinationLat, destinationLng, destinationLabel = 'Tujuan Pengiriman' }: CourierMapProps) {
  const [couriers, setCouriers] = useState<CourierLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<[number, number]>([-6.2088, 106.8456]);
  const [hasFittedBounds, setHasFittedBounds] = useState(false);

  const hasDestination = destinationLat != null && destinationLng != null;

  const fetchCouriers = async () => {
    try {
      let query = supabase
        .from('couriers')
        .select('id, name, current_lat, current_lng, last_location_update, is_available')
        .not('current_lat', 'is', null)
        .not('current_lng', 'is', null);

      if (courierId) {
        query = query.eq('id', courierId);
      } else if (showAllCouriers) {
        query = query.eq('is_available', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      const locations: CourierLocation[] = (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        lat: c.current_lat!,
        lng: c.current_lng!,
        lastUpdate: c.last_location_update || '',
        isAvailable: c.is_available,
      }));

      setCouriers(locations);

      if (locations.length > 0) {
        setCenter([locations[0].lat, locations[0].lng]);
      }
    } catch (error) {
      console.error('Error fetching courier locations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCouriers();

    const channelName = courierId ? `courier-tracking-${courierId}` : 'courier-locations';
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'location-update' }, (payload) => {
        const data = payload.payload as { id: string; lat: number; lng: number; timestamp: string };
        setCouriers((prev) => {
          const exists = prev.some((c) => c.id === data.id);
          if (exists) {
            return prev.map((c) =>
              c.id === data.id
                ? { ...c, lat: data.lat, lng: data.lng, lastUpdate: data.timestamp }
                : c
            );
          }
          return prev;
        });
        if (courierId && !hasDestination) {
          setCenter([data.lat, data.lng]);
        }
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'couriers', filter: courierId ? `id=eq.${courierId}` : undefined },
        (payload) => {
          const updated = payload.new as any;
          if (updated.current_lat && updated.current_lng) {
            setCouriers((prev) =>
              prev.map((c) =>
                c.id === updated.id
                  ? { ...c, lat: updated.current_lat, lng: updated.current_lng, lastUpdate: updated.last_location_update || '', isAvailable: updated.is_available }
                  : c
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courierId, showAllCouriers]);

  // Compute fit-bounds points
  const fitPoints: [number, number][] = [];
  if (couriers.length > 0) fitPoints.push([couriers[0].lat, couriers[0].lng]);
  if (hasDestination) fitPoints.push([destinationLat!, destinationLng!]);

  const formatLastUpdate = (dateStr: string) => {
    if (!dateStr) return 'Tidak diketahui';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    return date.toLocaleDateString('id-ID');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-muted rounded-xl" style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-border" style={{ height }}>
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-fit when we have courier + destination */}
        {fitPoints.length >= 2 && !hasFittedBounds ? (
          <FitBounds points={fitPoints} />
        ) : (
          <MapUpdater center={center} />
        )}

        {/* Courier markers */}
        {couriers.map((courier) => (
          <Marker key={courier.id} position={[courier.lat, courier.lng]} icon={courierIcon} title={courier.name}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold">🏍️ {courier.name}</p>
                <p className="text-xs text-muted-foreground mt-1">Status: {courier.isAvailable ? 'Tersedia' : 'Tidak Tersedia'}</p>
                <p className="text-xs text-muted-foreground mt-1">Update: {formatLastUpdate(courier.lastUpdate)}</p>
              </div>
            </Popup>
          </Marker>
        ))

        {/* Destination marker */}
        {hasDestination && (
          <Marker position={[destinationLat!, destinationLng!]} icon={destinationIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold">📍 {destinationLabel}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Dashed line between courier and destination */}
        {hasDestination && couriers.length > 0 && (
          <Polyline
            positions={[[couriers[0].lat, couriers[0].lng], [destinationLat!, destinationLng!]]}
            pathOptions={{ color: 'hsl(var(--primary))', weight: 3, dashArray: '8, 8', opacity: 0.6 }}
          />
        )}
      </MapContainer>

      {/* Refresh button */}
      <Button
        size="icon"
        variant="secondary"
        className="absolute top-3 right-3 z-[1000] shadow-md"
        onClick={() => { setLoading(true); fetchCouriers(); }}
      >
        <RefreshCw className="h-4 w-4" />
      </Button>

      {/* Live indicator */}
      {couriers.length > 0 && courierId && (
        <div className="absolute top-3 left-3 z-[1000] bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium shadow-md border border-border flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          Live
        </div>
      )}

      {/* Courier count badge */}
      {showAllCouriers && couriers.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium shadow-md border border-border">
          <Navigation className="h-3.5 w-3.5 inline mr-1.5 text-primary" />
          {couriers.length} kurir aktif
        </div>
      )}
    </div>
  );
}
