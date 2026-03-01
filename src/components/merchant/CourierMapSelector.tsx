import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Courier icon (motorcycle)
const courierIcon = new L.Icon({
  iconUrl: '/motor-icon.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

// Merchant icon (green)
const merchantIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
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

interface CourierOnMap {
  id: string;
  name: string;
  lat: number;
  lng: number;
  vehicle_type: string;
  active_orders: number;
  distance_km?: number;
}

interface CourierMapSelectorProps {
  merchantLat?: number;
  merchantLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  couriers: CourierOnMap[];
  onSelectCourier: (courierId: string) => void;
  assigning?: boolean;
}

function FitAllBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [points.length]);
  return null;
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function CourierMapSelector({
  merchantLat,
  merchantLng,
  deliveryLat,
  deliveryLng,
  couriers,
  onSelectCourier,
  assigning,
}: CourierMapSelectorProps) {
  const [realtimeCouriers, setRealtimeCouriers] = useState<CourierOnMap[]>(couriers);

  useEffect(() => {
    setRealtimeCouriers(couriers);
  }, [couriers]);

  // Subscribe to realtime courier location updates
  useEffect(() => {
    const channel = supabase.channel('courier-map-selector');
    channel
      .on('broadcast', { event: 'location-update' }, (payload) => {
        const data = payload.payload as { id: string; lat: number; lng: number };
        setRealtimeCouriers(prev =>
          prev.map(c => c.id === data.id ? { ...c, lat: data.lat, lng: data.lng } : c)
        );
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'couriers' },
        (payload) => {
          const updated = payload.new as any;
          if (updated.current_lat && updated.current_lng) {
            setRealtimeCouriers(prev =>
              prev.map(c => c.id === updated.id ? { ...c, lat: updated.current_lat, lng: updated.current_lng } : c)
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Compute all map points for fitting bounds
  const allPoints: [number, number][] = [];
  if (merchantLat && merchantLng) allPoints.push([merchantLat, merchantLng]);
  if (deliveryLat && deliveryLng) allPoints.push([deliveryLat, deliveryLng]);
  realtimeCouriers.forEach(c => allPoints.push([c.lat, c.lng]));

  const center: [number, number] = allPoints.length > 0
    ? [allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length, allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length]
    : [-6.2088, 106.8456];

  if (realtimeCouriers.length === 0 && !merchantLat) {
    return (
      <div className="flex items-center justify-center h-[300px] bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">Tidak ada data lokasi untuk ditampilkan</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-border" style={{ height: '300px' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitAllBounds points={allPoints} />

        {/* Merchant marker */}
        {merchantLat && merchantLng && (
          <Marker position={[merchantLat, merchantLng]} icon={merchantIcon}>
            <Popup>
              <div className="text-sm font-bold">🏪 Toko Anda</div>
            </Popup>
          </Marker>
        )}

        {/* Delivery destination marker */}
        {deliveryLat && deliveryLng && (
          <Marker position={[deliveryLat, deliveryLng]} icon={destinationIcon}>
            <Popup>
              <div className="text-sm font-bold">📍 Tujuan Pengiriman</div>
            </Popup>
          </Marker>
        )}

        {/* Courier markers */}
        {realtimeCouriers.map(courier => {
          const distToMerchant = merchantLat && merchantLng
            ? getDistanceKm(courier.lat, courier.lng, merchantLat, merchantLng)
            : courier.distance_km;

          return (
            <Marker key={courier.id} position={[courier.lat, courier.lng]} icon={courierIcon}>
              <Popup>
                <div className="text-sm space-y-2 min-w-[160px]">
                  <p className="font-bold">🏍️ {courier.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{courier.vehicle_type}</p>
                  {distToMerchant !== undefined && (
                    <p className="text-xs">📏 {distToMerchant.toFixed(1)} km dari toko</p>
                  )}
                  <p className="text-xs">📦 {courier.active_orders} pesanan aktif</p>
                  <button
                    onClick={() => onSelectCourier(courier.id)}
                    disabled={assigning}
                    className="w-full mt-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 disabled:opacity-50"
                  >
                    {assigning ? 'Menugaskan...' : 'Pilih Kurir Ini'}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Dashed lines from merchant to each courier */}
        {merchantLat && merchantLng && realtimeCouriers.map(c => (
          <Polyline
            key={`line-${c.id}`}
            positions={[[merchantLat, merchantLng], [c.lat, c.lng]]}
            pathOptions={{ color: '#94a3b8', weight: 1.5, dashArray: '6, 6', opacity: 0.4 }}
          />
        ))}
      </MapContainer>

      {/* Live indicator */}
      <div className="absolute top-3 left-3 z-[1000] bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium shadow-md border border-border flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        Live GPS
      </div>

      {/* Courier count */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium shadow-md border border-border">
        <Navigation className="h-3.5 w-3.5 inline mr-1 text-primary" />
        {realtimeCouriers.length} kurir tersedia
      </div>
    </div>
  );
}
