import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Navigation, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

// Custom courier icon
const courierIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
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
  courierId?: string; // Optional: track specific courier
  showAllCouriers?: boolean; // Show all available couriers
  height?: string;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function CourierMap({ courierId, showAllCouriers = false, height = '400px' }: CourierMapProps) {
  const [couriers, setCouriers] = useState<CourierLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<[number, number]>([-6.2088, 106.8456]);

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

      // Center on first courier if available
      if (locations.length > 0 && !courierId) {
        setCenter([locations[0].lat, locations[0].lng]);
      } else if (locations.length > 0) {
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

    // Set up channel with broadcast + postgres_changes
    const channelName = courierId ? `courier-tracking-${courierId}` : 'courier-locations';
    const channel = supabase.channel(channelName);

    channel
      // Broadcast listener — instant marker movement
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
        // Auto-center when tracking a specific courier
        if (courierId) {
          setCenter([data.lat, data.lng]);
        }
      })
      // Postgres changes — checkpoint fallback
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couriers',
          filter: courierId ? `id=eq.${courierId}` : undefined,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.current_lat && updated.current_lng) {
            setCouriers((prev) =>
              prev.map((c) =>
                c.id === updated.id
                  ? {
                      ...c,
                      lat: updated.current_lat,
                      lng: updated.current_lng,
                      lastUpdate: updated.last_location_update || '',
                      isAvailable: updated.is_available,
                    }
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
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater center={center} />
        
        {couriers.map((courier) => (
          <Marker
            key={courier.id}
            position={[courier.lat, courier.lng]}
            icon={courierIcon}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{courier.name}</p>
                <p className={courier.isAvailable ? 'text-success' : 'text-destructive'}>
                  {courier.isAvailable ? '🟢 Tersedia' : '🔴 Tidak tersedia'}
                </p>
                <p className="text-muted-foreground text-xs">
                  Update: {formatLastUpdate(courier.lastUpdate)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Refresh button */}
      <Button
        size="icon"
        variant="secondary"
        className="absolute top-3 right-3 z-[1000] shadow-md"
        onClick={() => {
          setLoading(true);
          fetchCouriers();
        }}
      >
        <RefreshCw className="h-4 w-4" />
      </Button>

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
