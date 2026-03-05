import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Loader2, ArrowLeft, LocateFixed, MapPin, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet icon fix
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: '/motor-icon.png',
  iconRetinaUrl: '/motor-icon.png',
  shadowUrl: markerShadow,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const destIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const driverIcon = new L.Icon({
  iconUrl: '/motor-icon.png',
  iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -36],
});

interface FareSettings { base_fare: number; per_km_fare: number; min_fare: number; max_fare: number; }
const DEFAULT_FARE: FareSettings = { base_fare: 5000, per_km_fare: 3000, min_fare: 5000, max_fare: 100000 };

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface DriverMarker { id: string; lat: number; lng: number; name: string; }

// Sub-component: handles map click
function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onSelect(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function FitBoundsHelper({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points.map(p => L.latLng(p[0], p[1]))), { padding: [50, 50], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
    }
  }, [points, map]);
  return null;
}

export default function RideBookingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<'pickup' | 'destination'>('pickup');
  const [pickupLocation, setPickupLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [destLocation, setDestLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destAddress, setDestAddress] = useState('');
  const [fareSettings, setFareSettings] = useState<FareSettings>(DEFAULT_FARE);
  const [submitting, setSubmitting] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);
  const [drivers, setDrivers] = useState<DriverMarker[]>([]);
  const [mapCenter] = useState<[number, number]>([-7.3274, 108.2207]);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    supabase.from('app_settings').select('value').eq('key', 'ride_fare_settings').maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const v = data.value as Record<string, unknown>;
          setFareSettings({
            base_fare: Number(v.base_fare) || DEFAULT_FARE.base_fare,
            per_km_fare: Number(v.per_km_fare) || DEFAULT_FARE.per_km_fare,
            min_fare: Number(v.min_fare) || DEFAULT_FARE.min_fare,
            max_fare: Number(v.max_fare) || DEFAULT_FARE.max_fare,
          });
        }
      });
    // Fetch nearby drivers
    supabase.from('couriers').select('id, name, current_lat, current_lng')
      .eq('is_available', true).eq('status', 'ACTIVE')
      .not('current_lat', 'is', null).not('current_lng', 'is', null)
      .then(({ data }) => {
        if (data) setDrivers(data.map(d => ({ id: d.id, lat: d.current_lat!, lng: d.current_lng!, name: d.name })));
      });
    // Auto GPS on load
    handleGps();
  }, [user, navigate]);

  const handleGps = useCallback(() => {
    setGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickupLocation(loc);
        setPickupAddress('Lokasi saya saat ini');
        setGettingGps(false);
        setMode('destination');
      },
      () => { setGettingGps(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (mode === 'pickup') {
      setPickupLocation({ lat, lng });
      setPickupAddress('Titik jemput');
    } else {
      setDestLocation({ lat, lng });
      setDestAddress('Titik tujuan');
    }
  }, [mode]);

  const distanceKm = pickupLocation && destLocation
    ? haversineDistance(pickupLocation.lat, pickupLocation.lng, destLocation.lat, destLocation.lng) : 0;

  const estimatedFare = Math.min(
    fareSettings.max_fare,
    Math.max(fareSettings.min_fare, Math.round(fareSettings.base_fare + distanceKm * fareSettings.per_km_fare))
  );

  const fitPoints = useMemo(() => {
    const pts: [number, number][] = [];
    if (pickupLocation) pts.push([pickupLocation.lat, pickupLocation.lng]);
    if (destLocation) pts.push([destLocation.lat, destLocation.lng]);
    return pts;
  }, [pickupLocation, destLocation]);

  const handleSubmit = async () => {
    if (!user || !pickupLocation || !destLocation) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('ride_requests').insert([{
        passenger_id: user.id,
        pickup_lat: pickupLocation.lat, pickup_lng: pickupLocation.lng,
        pickup_address: pickupAddress || 'Titik jemput',
        destination_lat: destLocation.lat, destination_lng: destLocation.lng,
        destination_address: destAddress || 'Titik tujuan',
        distance_km: Math.round(distanceKm * 100) / 100,
        estimated_fare: estimatedFare, status: 'SEARCHING',
      }]).select('id').single();
      if (error) throw error;
      toast({ title: 'Mencari driver...', description: 'Permintaan ojek Anda sedang dicari driver terdekat' });
      navigate(`/ride/${data.id}`);
    } catch (err) {
      console.error(err);
      toast({ title: 'Gagal memesan ojek', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const canOrder = !!pickupLocation && !!destLocation && distanceKm > 0.05;

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Compact header */}
      <div className="relative z-20 flex items-center gap-3 px-4 py-3 bg-background/95 backdrop-blur border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold">Ojek Desa</h1>
        </div>
        <Button
          variant="outline" size="sm"
          className="ml-auto h-8 text-xs"
          onClick={handleGps} disabled={gettingGps}
        >
          {gettingGps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Fullscreen map */}
      <div className="flex-1 relative z-0">
        <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onSelect={handleMapClick} />
          {fitPoints.length > 0 && <FitBoundsHelper points={fitPoints} />}

          {/* Pickup marker */}
          {pickupLocation && <Marker position={[pickupLocation.lat, pickupLocation.lng]} icon={pickupIcon} />}
          {/* Destination marker */}
          {destLocation && <Marker position={[destLocation.lat, destLocation.lng]} icon={destIcon} />}
          {/* Route line */}
          {pickupLocation && destLocation && (
            <Polyline
              positions={[[pickupLocation.lat, pickupLocation.lng], [destLocation.lat, destLocation.lng]]}
              pathOptions={{ color: 'hsl(160,84%,39%)', weight: 3, dashArray: '10, 8', opacity: 0.7 }}
            />
          )}
          {/* Driver markers */}
          {drivers.map(d => (
            <Marker key={d.id} position={[d.lat, d.lng]} icon={driverIcon} />
          ))}
        </MapContainer>

        {/* Mode indicator floating on map */}
        <div className="absolute top-3 left-3 z-[1000]">
          <div className="bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold shadow border border-border flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${mode === 'pickup' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {mode === 'pickup' ? 'Tap peta: pilih jemput' : 'Tap peta: pilih tujuan'}
          </div>
        </div>

        {/* Driver count */}
        {drivers.length > 0 && (
          <div className="absolute top-3 right-3 z-[1000] bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium shadow border border-border flex items-center gap-1.5">
            <Navigation className="h-3 w-3 text-primary" />
            {drivers.length} driver
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative z-10 bg-card border-t border-border rounded-t-2xl shadow-lg px-4 pt-4 pb-6 space-y-3"
        >
          {/* Input fields */}
          <div className="space-y-2">
            {/* Pickup */}
            <button
              type="button"
              onClick={() => setMode('pickup')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left text-sm transition ${
                mode === 'pickup' ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/30' : 'border-border bg-muted/30'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
              <Input
                placeholder="Titik jemput"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                onFocus={() => setMode('pickup')}
                className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </button>
            {/* Destination */}
            <button
              type="button"
              onClick={() => setMode('destination')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left text-sm transition ${
                mode === 'destination' ? 'border-red-500 bg-red-50/50 ring-1 ring-red-500/30' : 'border-border bg-muted/30'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
              <Input
                placeholder="Mau ke mana?"
                value={destAddress}
                onChange={(e) => setDestAddress(e.target.value)}
                onFocus={() => setMode('destination')}
                className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </button>
          </div>

          {/* Fare estimation + Order */}
          {canOrder && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="flex items-center justify-between text-sm bg-muted/50 rounded-xl px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground text-xs">Jarak</p>
                  <p className="font-semibold">{distanceKm.toFixed(1)} km</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="space-y-0.5 text-right">
                  <p className="text-muted-foreground text-xs">Estimasi</p>
                  <p className="font-bold text-primary text-base">{formatPrice(estimatedFare)}</p>
                </div>
              </div>
              <Button className="w-full h-12 text-sm font-bold rounded-xl" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bike className="h-4 w-4 mr-2" />}
                Pesan Ojek
              </Button>
            </motion.div>
          )}

          {!canOrder && (
            <p className="text-center text-xs text-muted-foreground py-1">
              {!pickupLocation ? 'Pilih titik jemput di peta atau gunakan GPS' :
               !destLocation ? 'Tap peta untuk pilih tujuan' : 'Jarak terlalu dekat'}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
