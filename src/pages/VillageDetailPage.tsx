import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Share2, 
  MapPin, 
  Mountain, 
  Store, 
  Phone, 
  Mail,
  Eye,
  Check,
  Calendar,
  Map,
  Star,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { TourismCard } from '@/components/TourismCard';
import { TourismMap } from '@/components/village/TourismMap';
import { VerifiedBadge } from '@/components/merchant/VerifiedBadge';
import type { Tourism } from '@/types';

interface VillageData {
  id: string;
  name: string;
  district: string;
  regency: string;
  subdistrict: string | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  registered_at: string | null;
}

interface MerchantData {
  id: string;
  name: string;
  image_url: string | null;
  business_category: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  product_count?: number;
  is_verified?: boolean;
  badge?: string | null;
}

export default function VillageDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [village, setVillage] = useState<VillageData | null>(null);
  const [tourisms, setTourisms] = useState<Tourism[]>([]);
  const [merchants, setMerchants] = useState<MerchantData[]>([]);
  const [stats, setStats] = useState({ totalTourism: 0, totalMerchants: 0, totalViews: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tourism' | 'merchants'>('tourism');

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        // Fetch village
        const { data: villageData, error: villageError } = await supabase
          .from('villages')
          .select('*')
          .eq('id', id)
          .single();

        if (villageError) throw villageError;
        setVillage(villageData);

        // Fetch tourism spots
        const { data: tourismData } = await supabase
          .from('tourism')
          .select(`
            id, name, description, image_url, is_active, view_count,
            location_lat, location_lng, wa_link, sosmed_link, facilities,
            village_id, villages(name)
          `)
          .eq('village_id', id)
          .eq('is_active', true);

        const mappedTourism: Tourism[] = (tourismData || []).map(t => ({
          id: t.id,
          villageId: t.village_id,
          villageName: (t.villages as any)?.name || '',
          name: t.name,
          description: t.description || '',
          image: t.image_url || '/placeholder.svg',
          locationLat: Number(t.location_lat) || 0,
          locationLng: Number(t.location_lng) || 0,
          waLink: t.wa_link || '',
          sosmedLink: t.sosmed_link || undefined,
          facilities: t.facilities || [],
          isActive: t.is_active,
          viewCount: t.view_count || 0,
        }));
        setTourisms(mappedTourism);

        // Fetch merchants with product counts - optimized query
        const { data: merchantsData } = await supabase
          .from('merchants')
          .select('id, name, image_url, business_category, rating_avg, rating_count, is_open, open_time, close_time, is_verified, badge')
          .eq('village_id', id)
          .eq('status', 'ACTIVE')
          .eq('registration_status', 'APPROVED');

        // Get product counts for all merchants in one query
        const merchantIds = (merchantsData || []).map(m => m.id);
        const { data: productCounts } = merchantIds.length > 0 
          ? await supabase
              .from('products')
              .select('merchant_id')
              .in('merchant_id', merchantIds)
              .eq('is_active', true)
          : { data: [] };

        // Count products per merchant
        const countMap: Record<string, number> = {};
        (productCounts || []).forEach(p => {
          countMap[p.merchant_id] = (countMap[p.merchant_id] || 0) + 1;
        });

        const merchantsWithCounts: MerchantData[] = (merchantsData || []).map(merchant => ({
          ...merchant,
          product_count: countMap[merchant.id] || 0
        }));
        setMerchants(merchantsWithCounts);

        // Stats
        setStats({
          totalTourism: mappedTourism.length,
          totalMerchants: merchantsWithCounts.length,
          totalViews: mappedTourism.reduce((sum, t) => sum + (t.viewCount || 0), 0),
        });

      } catch (error) {
        console.error('Error loading village:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  if (!village) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Desa tidak ditemukan</p>
          <Button onClick={() => navigate('/')}>Kembali</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      {/* Hero Image */}
      <div className="relative h-64">
        <img 
          src={village.image_url || '/placeholder.svg'} 
          alt={village.name}
          className="w-full h-full object-cover"
        />
        
        {/* Top Navigation */}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-foreground/20 backdrop-blur rounded-full flex items-center justify-center text-primary-foreground hover:bg-foreground/40 transition border border-primary-foreground/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button className="w-10 h-10 bg-foreground/20 backdrop-blur rounded-full flex items-center justify-center text-primary-foreground hover:bg-foreground/40 transition border border-primary-foreground/20">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
        
        {/* Gradient overlay */}
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-background to-transparent" />
      </div>
      
      {/* Content */}
      <div className="flex-1 px-4 -mt-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-foreground">{village.name}</h1>
                  {village.is_active && (
                    <Badge variant="default" className="text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground text-sm">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{village.district}, {village.regency}</span>
                </div>
                {village.subdistrict && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Kec. {village.subdistrict}
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mountain className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{stats.totalTourism}</p>
                  <p className="text-xs text-muted-foreground">Wisata</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <Store className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{stats.totalMerchants}</p>
                  <p className="text-xs text-muted-foreground">UMKM</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{stats.totalViews.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {village.description && (
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
              <h3 className="font-semibold text-foreground mb-2">Tentang Desa</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {village.description}
              </p>
            </div>
          )}

          {/* Contact Info */}
          {(village.contact_name || village.contact_phone || village.contact_email) && (
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
              <h3 className="font-semibold text-foreground mb-3">Kontak Pengelola</h3>
              <div className="space-y-2">
                {village.contact_name && (
                  <p className="text-sm text-foreground font-medium">{village.contact_name}</p>
                )}
                {village.contact_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{village.contact_phone}</span>
                  </div>
                )}
                {village.contact_email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{village.contact_email}</span>
                  </div>
                )}
              </div>
              {village.registered_at && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Bergabung sejak {new Date(village.registered_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })}</span>
                </div>
              )}
            </div>
          )}

          {/* Tourism Map */}
          {tourisms.length > 0 && (
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Map className="h-4 w-4 text-primary" />
                Peta Lokasi Wisata
              </h3>
              <TourismMap tourismSpots={tourisms} height="250px" />
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={activeTab === 'tourism' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('tourism')}
              className="flex-1"
            >
              <Mountain className="h-4 w-4 mr-2" />
              Wisata ({stats.totalTourism})
            </Button>
            <Button
              variant={activeTab === 'merchants' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('merchants')}
              className="flex-1"
            >
              <Store className="h-4 w-4 mr-2" />
              Toko ({merchants.length})
            </Button>
          </div>

          {/* Content based on tab */}
          {activeTab === 'tourism' && (
            <div className="space-y-3 pb-6">
              {tourisms.length > 0 ? (
                tourisms.map(tourism => (
                  <TourismCard key={tourism.id} tourism={tourism} />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada wisata terdaftar
                </div>
              )}
            </div>
          )}

          {activeTab === 'merchants' && (
            <div className="space-y-3 pb-6">
              {merchants.length > 0 ? (
                merchants.map(merchant => (
                  <Link key={merchant.id} to={`/merchant/${merchant.id}`}>
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex gap-3">
                          <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                            <img 
                              src={merchant.image_url || '/placeholder.svg'} 
                              alt={merchant.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-semibold text-foreground truncate">{merchant.name}</h3>
                                {merchant.is_verified && (
                                  <VerifiedBadge type="verified" size="sm" showLabel={false} />
                                )}
                              </div>
                              <Badge 
                                variant={merchant.is_open ? 'default' : 'secondary'} 
                                className="text-xs flex-shrink-0"
                              >
                                {merchant.is_open ? 'Buka' : 'Tutup'}
                              </Badge>
                            </div>
                            {merchant.business_category && (
                              <p className="text-xs text-muted-foreground mt-0.5">{merchant.business_category}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              {merchant.rating_avg && merchant.rating_avg > 0 && (
                                <div className="flex items-center gap-1 text-xs">
                                  <Star className="h-3 w-3 fill-warning text-warning" />
                                  <span className="font-medium">{merchant.rating_avg.toFixed(1)}</span>
                                  <span className="text-muted-foreground">({merchant.rating_count})</span>
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                {merchant.product_count} produk
                              </div>
                              {merchant.open_time && merchant.close_time && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>{merchant.open_time}-{merchant.close_time}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada toko dari desa ini
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
