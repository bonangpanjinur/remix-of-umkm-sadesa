import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  MapPin, 
  Star, 
  Clock, 
  Store,
  ShoppingBag,
  MessageCircle,
  Check,
  Building,
  Info
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { ProductCard } from '../components/ProductCard';
import { supabase } from '../integrations/supabase/client';
import { VerifiedBadge } from '../components/merchant/VerifiedBadge';
import { MerchantClosedBanner, MerchantStatusBadge } from '../components/merchant/MerchantClosedBanner';
import { getMerchantOperatingStatus, formatTime } from '../lib/merchantOperatingHours';
import { checkMerchantHasActiveQuota } from '../lib/api';
import { ShareStoreButton } from '../components/merchant/ShareStoreButton';
import { OrderChat } from '../components/chat/OrderChat';
import { trackPageView } from '../lib/pageViewTracker';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
  user_id: string | null;
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
  const { user } = useAuth();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasActiveQuota, setHasActiveQuota] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [showHalalModal, setShowHalalModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
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

        trackPageView({ merchantId: id, pageType: 'store' });

        const quotaActive = await checkMerchantHasActiveQuota(id);
        setHasActiveQuota(quotaActive);

        const merchantStatus = getMerchantOperatingStatus(
          merchantData.is_open,
          merchantData.open_time,
          merchantData.close_time
        );
        const isMerchantOpen = merchantStatus.isCurrentlyOpen;

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

        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('id, rating, comment, created_at, buyer_id')
          .eq('merchant_id', id)
          .eq('is_visible', true)
          .order('created_at', { ascending: false })
          .limit(10);

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

  const handleChatClick = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!merchant) return;
    
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('merchant_id', merchant.id)
      .not('status', 'in', '("CANCELLED","REJECTED")')
      .order('created_at', { ascending: false })
      .limit(1);

    if (orders && orders.length > 0) {
      setChatOrderId(orders[0].id);
      setChatOpen(true);
    } else if (merchant.phone) {
      const phone = merchant.phone.replace(/\D/g, '');
      const formattedPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
      window.open(`https://wa.me/${formattedPhone}`, '_blank');
    } else {
      toast({
        title: 'Belum bisa chat',
        description: 'Buat pesanan terlebih dahulu untuk chat dengan penjual',
      });
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

  const operatingStatus = getMerchantOperatingStatus(merchant.is_open, merchant.open_time, merchant.close_time);
  const isClosed = !hasActiveQuota || !operatingStatus.isCurrentlyOpen;

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen relative">
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Hero Image */}
        <div className="relative h-40 bg-gradient-to-br from-primary/20 to-primary/5">
          {merchant.image_url ? (
            <img 
              src={merchant.image_url} 
              alt={merchant.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Store className="h-14 w-14 text-primary/30" />
            </div>
          )}
          
          <div className="absolute top-0 left-0 w-full p-3 flex justify-between items-center z-20">
            <button 
              onClick={() => navigate(-1)}
              className="w-9 h-9 bg-foreground/20 backdrop-blur rounded-full flex items-center justify-center text-primary-foreground hover:bg-foreground/40 transition border border-primary-foreground/20"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <ShareStoreButton 
              merchantName={merchant.name} 
              slug={merchant.slug} 
              merchantId={merchant.id} 
            />
          </div>
          
          <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-background to-transparent" />
        </div>
        
        {/* Compact Header */}
        <div className="px-4 -mt-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="bg-card rounded-xl p-3 shadow-sm border border-border mb-3">
              {/* Row 1: Name + badges + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h1 className="text-lg font-bold text-foreground truncate">{merchant.name}</h1>
                    {merchant.badge === 'VERIFIED' && <VerifiedBadge type="verified" size="sm" />}
                    {merchant.badge === 'POPULAR' && <VerifiedBadge type="popular" size="sm" />}
                    {merchant.badge === 'NEW' && <VerifiedBadge type="new" size="sm" />}
                    {merchant.halal_status === 'VERIFIED' && (
                      <button onClick={() => setShowHalalModal(true)}>
                        <Badge className="bg-green-500 text-white border-none text-[10px] font-bold px-1.5 py-0 rounded-full flex items-center gap-0.5 cursor-pointer hover:bg-green-600 transition">
                          <Check className="h-2.5 w-2.5" />
                          HALAL
                        </Badge>
                      </button>
                    )}
                  </div>

                  {/* Row 2: Rating + location */}
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-0.5">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium text-foreground">{merchant.rating_avg?.toFixed(1) || '0.0'}</span>
                    </div>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-xs">({merchant.rating_count || 0} ulasan)</span>
                    <span className="text-muted-foreground/50">·</span>
                    <div className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      <span className="text-xs truncate max-w-[120px]">
                        {merchant.villages?.name || merchant.subdistrict || merchant.district || merchant.city}
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Operating hours */}
                  {merchant.open_time && merchant.close_time && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(merchant.open_time)} - {formatTime(merchant.close_time)}</span>
                    </div>
                  )}
                </div>

                <MerchantStatusBadge
                  isManuallyOpen={merchant.is_open}
                  openTime={merchant.open_time}
                  closeTime={merchant.close_time}
                  hasQuota={hasActiveQuota}
                  size="md"
                />
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="products" className="w-full">
              <TabsList className="w-full grid grid-cols-3 mb-3">
                <TabsTrigger value="products" className="text-xs gap-1">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Produk ({products.length})
                </TabsTrigger>
                <TabsTrigger value="info" className="text-xs gap-1">
                  <Info className="h-3.5 w-3.5" />
                  Info
                </TabsTrigger>
                <TabsTrigger value="reviews" className="text-xs gap-1">
                  <Star className="h-3.5 w-3.5" />
                  Ulasan ({reviews.length})
                </TabsTrigger>
              </TabsList>

              {/* Products Tab */}
              <TabsContent value="products" className="mt-0">
                {isClosed && (
                  <div className="mb-3">
                    <MerchantClosedBanner
                      isManuallyOpen={merchant.is_open}
                      openTime={merchant.open_time}
                      closeTime={merchant.close_time}
                      merchantName={merchant.name}
                      hasQuota={hasActiveQuota}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5 pb-4">
                  {products.length > 0 ? (
                    products.map(product => (
                      <ProductCard key={product.id} product={product} />
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
                      Belum ada produk
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Info Tab */}
              <TabsContent value="info" className="mt-0 space-y-3 pb-4">
                {merchant.business_description && (
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <h3 className="font-semibold text-foreground text-sm mb-1.5">Tentang Toko</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {merchant.business_description}
                    </p>
                  </div>
                )}

                <div className="bg-card rounded-xl p-3 border border-border">
                  <h3 className="font-semibold text-foreground text-sm mb-1.5">Alamat</h3>
                  {merchant.address && (
                    <p className="text-xs text-muted-foreground mb-1">{merchant.address}</p>
                  )}
                  {(merchant.subdistrict || merchant.district || merchant.city) && (
                    <p className="text-xs text-muted-foreground">
                      {[merchant.subdistrict, merchant.district, merchant.city, merchant.province]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                  {merchant.villages?.name && (
                    <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5">
                      <Building className="h-3 w-3 text-primary" />
                      <span className="text-xs font-medium text-primary">Desa Wisata: {merchant.villages.name}</span>
                    </div>
                  )}
                </div>

                {merchant.classification_price && (
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <h3 className="font-semibold text-foreground text-sm mb-1.5">Kisaran Harga</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShoppingBag className="h-3 w-3" />
                      <span>{getPriceLabel(merchant.classification_price)}</span>
                    </div>
                  </div>
                )}

                {merchant.business_category && (
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <h3 className="font-semibold text-foreground text-sm mb-1.5">Kategori</h3>
                    <Badge variant="secondary" className="text-xs">{merchant.business_category}</Badge>
                  </div>
                )}
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews" className="mt-0 space-y-2.5 pb-4">
                {reviews.length > 0 ? (
                  reviews.map(review => (
                    <div key={review.id} className="bg-card rounded-xl p-3 border border-border">
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {(review.profiles as any)?.full_name || 'Pembeli'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString('id-ID')}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`h-3 w-3 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} 
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-xs text-muted-foreground">{review.comment}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Belum ada ulasan
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="absolute bottom-0 w-full bg-card border-t border-border p-3 px-4 shadow-lg z-20">
        <Button
          onClick={handleChatClick}
          className="w-full bg-primary text-primary-foreground shadow-brand font-bold"
          size="sm"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Chat Penjual
        </Button>
      </div>

      {/* Chat Modal */}
      {chatOrderId && merchant.user_id && (
        <OrderChat
          orderId={chatOrderId}
          otherUserId={merchant.user_id as string}
          otherUserName={merchant.name}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* Halal Certificate Modal */}
      <Dialog open={showHalalModal} onOpenChange={setShowHalalModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Sertifikat Halal
            </DialogTitle>
          </DialogHeader>
          {merchant.halal_certificate_url ? (
            <div className="relative aspect-[3/4] rounded-lg overflow-hidden border border-border">
              <img 
                src={merchant.halal_certificate_url} 
                alt="Sertifikat Halal" 
                className="object-contain w-full h-full"
              />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Check className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p>Produk toko ini telah tersertifikasi halal</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
