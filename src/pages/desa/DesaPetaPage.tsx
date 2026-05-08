import { useState, useEffect } from 'react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup } from 'react-leaflet';
import { Store, Mountain, MapPin, Filter } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const merchantIcon = L.divIcon({
  html: '<div style="background:#10b981;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  className: '',
});

const tourismIcon = L.divIcon({
  html: '<div style="background:#3b82f6;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  className: '',
});

interface MapItem {
  id: string;
  name: string;
  type: 'merchant' | 'tourism';
  lat: number;
  lng: number;
  category?: string | null;
  phone?: string | null;
  address?: string | null;
}

export default function DesaPetaPage() {
  const { user } = useAuth();
  const [villageId, setVillageId] = useState<string | null>(null);
  const [items, setItems] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMerchants, setShowMerchants] = useState(true);
  const [showTourism, setShowTourism] = useState(true);
  const [center, setCenter] = useState<[number, number]>([-7.5, 110.0]);

  useEffect(() => {
    const fetchVillage = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('user_villages')
        .select('village_id, villages(location_lat, location_lng)')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.village_id) {
        setVillageId(data.village_id);
        const v = (data as any).villages;
        if (v?.location_lat && v?.location_lng) {
          setCenter([Number(v.location_lat), Number(v.location_lng)]);
        }
      }
    };
    fetchVillage();
  }, [user]);

  useEffect(() => { if (villageId) fetchItems(); }, [villageId]);

  const fetchItems = async () => {
    if (!villageId) return;
    setLoading(true);
    const [merchantRes, tourismRes] = await Promise.all([
      supabase.from('merchants').select('id, name, business_category, phone, address, location_lat, location_lng').eq('village_id', villageId).eq('registration_status', 'APPROVED').not('location_lat', 'is', null),
      supabase.from('tourism').select('id, name, location_lat, location_lng').eq('village_id', villageId).eq('is_active', true).not('location_lat', 'is', null),
    ]);

    const merchants: MapItem[] = ((merchantRes.data || []) as any[]).map(m => ({
      id: m.id,
      name: m.name,
      type: 'merchant' as const,
      lat: Number(m.location_lat),
      lng: Number(m.location_lng),
      category: m.business_category,
      phone: m.phone,
      address: m.address,
    })).filter(m => m.lat && m.lng);

    const tourism: MapItem[] = ((tourismRes.data || []) as any[]).map(t => ({
      id: t.id,
      name: t.name,
      type: 'tourism' as const,
      lat: Number(t.location_lat),
      lng: Number(t.location_lng),
    })).filter(t => t.lat && t.lng);

    const all = [...merchants, ...tourism];
    setItems(all);

    if (all.length > 0) {
      const avgLat = all.reduce((s, i) => s + i.lat, 0) / all.length;
      const avgLng = all.reduce((s, i) => s + i.lng, 0) / all.length;
      setCenter([avgLat, avgLng]);
    }

    setLoading(false);
  };

  const merchantItems = items.filter(i => i.type === 'merchant');
  const tourismItems = items.filter(i => i.type === 'tourism');
  const visibleItems = items.filter(i => (i.type === 'merchant' && showMerchants) || (i.type === 'tourism' && showTourism));

  return (
    <DesaLayout title="Peta Interaktif Desa" subtitle="Lokasi merchant dan destinasi wisata">
      <div className="space-y-4">
        {/* Stats & Controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant={showMerchants ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowMerchants(p => !p)}
          >
            <Store className="h-4 w-4" />
            Merchant ({merchantItems.length})
          </Button>
          <Button
            variant={showTourism ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowTourism(p => !p)}
          >
            <Mountain className="h-4 w-4" />
            Wisata ({tourismItems.length})
          </Button>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />Merchant
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />Wisata
          </span>
        </div>

        {/* Map */}
        <Card>
          <CardContent className="p-0 overflow-hidden rounded-lg">
            <div style={{ height: '500px' }}>
              {loading ? (
                <div className="h-full flex items-center justify-center bg-muted">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {visibleItems.map(item => (
                    <Marker
                      key={item.id}
                      position={[item.lat, item.lng]}
                      icon={item.type === 'merchant' ? merchantIcon : tourismIcon}
                    >
                      <Popup>
                        <div className="min-w-[180px]">
                          <div className="flex items-center gap-2 mb-1">
                            {item.type === 'merchant'
                              ? <Store className="h-4 w-4 text-emerald-600" />
                              : <Mountain className="h-4 w-4 text-blue-600" />
                            }
                            <span className="font-semibold text-sm">{item.name}</span>
                          </div>
                          {item.category && <p className="text-xs text-gray-500">{item.category}</p>}
                          {item.address && <p className="text-xs text-gray-500 mt-1">{item.address}</p>}
                          {item.phone && <p className="text-xs text-gray-500">{item.phone}</p>}
                          <a
                            href={`https://maps.google.com/?q=${item.lat},${item.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline mt-1 block"
                          >
                            Buka di Google Maps
                          </a>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {items.length === 0 && !loading && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Belum ada lokasi yang terdaftar</p>
              <p className="text-xs mt-1">Merchant dan destinasi wisata yang sudah menambahkan koordinat akan muncul di sini</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DesaLayout>
  );
}
