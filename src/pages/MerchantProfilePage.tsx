import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Share2, 
  MapPin, 
  Star, 
  Clock, 
  Phone,
  Store,
  ShoppingBag,
  MessageCircle,
  Check,
  Badge as BadgeIcon,
  Building
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ProductCard } from '../components/ProductCard';
import { supabase } from '../integrations/supabase/client';
import { VerifiedBadge } from '../components/merchant/VerifiedBadge';
import { MerchantClosedBanner, MerchantStatusBadge } from '../components/merchant/MerchantClosedBanner';
import { getMerchantOperatingStatus, formatTime } from '../lib/merchantOperatingHours';
import { checkMerchantHasActiveQuota } from '../lib/api';
import type { Product } from '../types';

interface MerchantData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  image_url: string | null;
  is_open: boolean;
  status: string;
  open_time: string | null;
  close_time: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  badge: string | null;
  business_category: string | null;
  business_description: string | null;
  classification_price: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  subdistrict: string | null;
  village_id: string | null;
  villages?: { name: string } | null;
  halal_status?: string | null;
  halal_certificate_url?: string | null;
  slug?: string | null;
}

interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  buyer_id: string;
  profiles?: { full_name: string } | null;
}

interface MerchantProfilePageProps {
  overrideId?: string;
}

export default function MerchantProfilePage({ overrideId }: MerchantProfilePageProps = {}) {
  const { id: paramId } = useParams();
  const id = overrideId || paramId;
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews'>('products');
  const [hasActiveQuota, setHasActiveQuota] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        // Fetch merchant
        const { data: merchantData, error: merchantError } = await supabase
          .from('merchants')
          .select(`
            *,
            villages(name)
          `)
          .eq('id', id)
          .single();

        if (merchantError) throw merchantError;
        setMerchant(merchantData);

        // Check merchant quota
        const quotaActive = await checkMerchantHasActiveQuota(id);
        setHasActiveQuota(quotaActive);

        // Determine if merchant is currently open
        const merchantStatus = getMerchantOperatingStatus(
          merchantData.is_open,
          merchantData.open_time,
          merchantData.close_time
        );
        const isMerchantOpen = merchantStatus.isCurrentlyOpen;

        // Fetch products
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .eq('merchant_id', id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        const mappedProducts: Product[] = (productsData || []).map(p => {
          const isAvailable = quotaActive && isMerchantOpen && p.is_active;
          
          return {
            id: p.id,
            merchantId: p.merchant_id,
            merchantName: merchantData.name,
            merchantVillage: merchantData.villages?.name || '',
            name: p.name,
            description: p.description || '',
            price: p.price,
            stock: p.stock,
            image: p.image_url || '/placeholder.svg',
            category: p.category as any,
            isActive: p.is_active,
            isPromo: p.is_promo,
            isAvailable,
            isMerchantOpen,
            hasQuota: quotaActive,
          };
        });
        setProducts(mappedProducts);

        // Fetch reviews
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('id, rating, comment, created_at, buyer_id')
          .eq('merchant_id', id)
          .eq('is_visible', true)
          .order('created_at', { ascending: false })
          .limit(10);

        // Get buyer profiles for reviews
        if (reviewsData && reviewsData.length > 0) {
          const buyerIds = [...new Set(reviewsData.map(r => r.buyer_id))];
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', buyerIds);
          
          const profilesMap = new Map((profilesData || []).map(p => [p.user_id, p.full_name]));
          
          setReviews(reviewsData.map(r => ({
            ...r,
            profiles: { full_name: profilesMap.get(r.buyer_id) || 'Pembeli' }
          })));
        } else {
          setReviews([]);
        }

      } catch (error) {
        console.error('Error loading merchant:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const getPriceLabel = (classification: string | null) => {
    switch (classification) {
      case 'UNDER_5K': return '< Rp 5.000';
      case 'FROM_5K_TO_10K': return 'Rp 5.000 - 10.000';
      case 'FROM_10K_TO_20K': return 'Rp 10.000 - 20.000';
      case 'ABOVE_20K': return '> Rp 20.000';
      default: return '-';
    }
  };

  const handleWhatsAppClick = () => {
    if (merchant?.phone) {
      const phone = merchant.phone.replace(/\D/g, '');
      const formattedPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
      window.open(`https://wa.me/${formattedPhone}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  if (!merchant) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Toko tidak ditemukan</p>
          <Button onClick={() => navigate('/')}>Kembali</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Hero Image */}
        <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5">
          {merchant.image_url ? (
            <img 
              src={merchant.image_url} 
              alt={merchant.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Store className="h-16 w-16 text-primary/30" />
            </div>
          )}
          
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
          <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-background to-transparent" />
        </div>
        
        {/* Content */}
        <div className="px-4 -mt-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Store Info Card */}
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl font-bold text-foreground">{merchant.name}</h1>
                    {merchant.badge === 'VERIFIED' && (
                      <VerifiedBadge type="verified" size="sm" />
                    )}
                    {merchant.badge === 'POPULAR' && (
                      <VerifiedBadge type="popular" size="sm" />
                    )}
                    {merchant.badge === 'NEW' && (
                      <VerifiedBadge type="new" size="sm" />
                    )}
                    {merchant.halal_status === 'VERIFIED' && (
                      <Badge className="bg-green-500 text-white border-none text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        HALAL
                      </Badge>
                    )}
                  </div>
                  
                  {/* Rating */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-gold text-gold" />
                      <span className="font-semibold text-foreground">
                        {merchant.rating_avg?.toFixed(1) || '0.0'}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-sm">
                      ({merchant.rating_count || 0} ulasan)
                    </span>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-1 text-muted-foreground text-sm">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>
                      {merchant.villages?.name || merchant.subdistrict || merchant.district || merchant.city}
                    </span>
                  </div>
                </div>

                {/* Open Status */}
                <MerchantStatusBadge
                  isManuallyOpen={merchant.is_open}
                  openTime={merchant.open_time}
                  closeTime={merchant.close_time}
                  hasQuota={hasActiveQuota}
                  size="md"
                />
              </div>

              {/* Quick Info */}
              <div className="flex gap-4 mt-4 pt-4 border-t border-border">
                {merchant.open_time && merchant.close_time && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{formatTime(merchant.open_time)} - {formatTime(merchant.close_time)}</span>
                  </div>
                )}
                {merchant.classification_price && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShoppingBag className="h-4 w-4" />
                    <span>{getPriceLabel(merchant.classification_price)}</span>
                  </div>
            )}

            {/* Halal Certificate */}
            {merchant.halal_status === 'VERIFIED' && merchant.halal_certificate_url && (
              <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Sertifikat Halal
                </h3>
                <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                  <img 
                    src={merchant.halal_certificate_url} 
                    alt="Sertifikat Halal" 
                    className="object-contain w-full h-full cursor-pointer hover:opacity-90 transition"
                    onClick={() => window.open(merchant.halal_certificate_url!, '_blank')}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Klik untuk melihat sertifikat ukuran penuh</p>
              </div>
            )}
              </div>
            </div>

            {/* Description */}
            {merchant.business_description && (
              <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
                <h3 className="font-semibold text-foreground mb-2">Tentang Toko</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {merchant.business_description}
                </p>
              </div>
            )}

            {/* Address */}
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
              <h3 className="font-semibold text-foreground mb-2">Alamat</h3>
              {merchant.address && (
                <p className="text-sm text-muted-foreground mb-1">
                  {merchant.address}
                </p>
              )}
              {(merchant.subdistrict || merchant.district || merchant.city) && (
                <p className="text-xs text-muted-foreground">
                  {[merchant.subdistrict, merchant.district, merchant.city, merchant.province]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              {merchant.villages?.name && (
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <Building className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">Desa Wisata: {merchant.villages.name}</span>
                </div>
              )}
            </div>

            {/* Merchant Closed / No Quota Banner */}
            {merchant && (!hasActiveQuota || !getMerchantOperatingStatus(merchant.is_open, merchant.open_time, merchant.close_time).isCurrentlyOpen) && (
              <div className="mb-4">
                <MerchantClosedBanner
                  isManuallyOpen={merchant.is_open}
                  openTime={merchant.open_time}
                  closeTime={merchant.close_time}
                  merchantName={merchant.name}
                  hasQuota={hasActiveQuota}
                />
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={activeTab === 'products' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('products')}
                className="flex-1"
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Produk ({products.length})
              </Button>
              <Button
                variant={activeTab === 'reviews' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('reviews')}
                className="flex-1"
              >
                <Star className="h-4 w-4 mr-2" />
                Ulasan ({reviews.length})
              </Button>
            </div>

            {/* Products Tab */}
            {activeTab === 'products' && (
              <div className="grid grid-cols-2 gap-3 pb-6">
                {products.length > 0 ? (
                  products.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8 text-muted-foreground">
                    Belum ada produk
                  </div>
                )}
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-3 pb-6">
                {reviews.length > 0 ? (
                  reviews.map(review => (
                    <div key={review.id} className="bg-card rounded-xl p-4 border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {(review.profiles as any)?.full_name || 'Pembeli'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString('id-ID')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`h-3 w-3 ${i < review.rating ? 'fill-gold text-gold' : 'text-muted'}`} 
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Belum ada ulasan
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Sticky CTA */}
      {merchant.phone && (
        <div className="absolute bottom-0 w-full bg-card border-t border-border p-4 px-6 shadow-lg z-20">
          <Button
            onClick={handleWhatsAppClick}
            className="w-full bg-primary text-primary-foreground shadow-brand font-bold"
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Chat Penjual
          </Button>
        </div>
      )}
    </div>
  );
}
