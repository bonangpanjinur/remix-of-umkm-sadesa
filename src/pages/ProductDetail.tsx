import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Minus, 
  Plus,
  ShoppingCart,
  Star,
  Store,
  MapPin,
  BadgeCheck,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchProduct, checkMerchantHasActiveQuota } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/lib/utils';
import { WishlistButton } from '@/components/WishlistButton';
import { ShareProduct } from '@/components/product/ShareProduct';
import { MerchantClosedBanner, MerchantStatusBadge } from '@/components/merchant/MerchantClosedBanner';
import { getMerchantOperatingStatus, formatTime } from '@/lib/merchantOperatingHours';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Product } from '@/types';

interface MerchantInfo {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  ratingAvg: number;
  ratingCount: number;
  badge: string | null;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  villageName: string | null;
  isVerified: boolean;
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActiveQuota, setHasActiveQuota] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const productData = await fetchProduct(id);
        setProduct(productData);
        
        if (productData) {
          // Fetch merchant with operating hours
          const { data: merchantData } = await supabase
            .from('merchants')
            .select(`
              id,
              name,
              phone,
              address,
              rating_avg,
              rating_count,
              badge,
              is_open,
              open_time,
              close_time,
              is_verified,
              villages (name)
            `)
            .eq('id', productData.merchantId)
            .maybeSingle();
          
          if (merchantData) {
            setMerchant({
              id: merchantData.id,
              name: merchantData.name,
              phone: merchantData.phone,
              address: merchantData.address,
              ratingAvg: Number(merchantData.rating_avg) || 0,
              ratingCount: merchantData.rating_count || 0,
              badge: merchantData.badge,
              isOpen: merchantData.is_open,
              openTime: merchantData.open_time,
              closeTime: merchantData.close_time,
              villageName: merchantData.villages?.name || null,
              isVerified: merchantData.is_verified || false,
            });
            
            // Check if merchant has active quota
            const quotaActive = await checkMerchantHasActiveQuota(merchantData.id);
            setHasActiveQuota(quotaActive);
          }
        }
      } catch (error) {
        console.error('Error loading product:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  // Get merchant operating status
  const merchantStatus = merchant 
    ? getMerchantOperatingStatus(merchant.isOpen, merchant.openTime, merchant.closeTime)
    : null;
  
  if (loading) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Produk tidak ditemukan</p>
          <Button onClick={() => navigate('/')}>Kembali</Button>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    // Check if merchant has active quota
    if (!hasActiveQuota) {
      toast({
        title: 'Toko tidak dapat menerima pesanan',
        description: 'Toko ini tidak memiliki kuota aktif',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if merchant is open
    if (merchantStatus && !merchantStatus.isCurrentlyOpen) {
      toast({
        title: 'Toko sedang tutup',
        description: merchantStatus.reason,
        variant: 'destructive',
      });
      return;
    }
    
    addToCart(product, quantity);
    navigate('/cart');
  };

  const canOrder = hasActiveQuota && merchantStatus?.isCurrentlyOpen !== false;

  return (
    <div className="mobile-shell bg-card flex flex-col min-h-screen relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-36">
        {/* Product Image */}
        <div className="relative h-72 bg-muted">
          <img 
            src={product.image} 
            alt={product.name}
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
            <div className="flex items-center gap-2">
              <WishlistButton productId={id || ''} size="md" />
              <div className="w-10 h-10 bg-foreground/20 backdrop-blur rounded-full flex items-center justify-center text-primary-foreground hover:bg-foreground/40 transition border border-primary-foreground/20">
                <ShareProduct 
                  productId={id || ''} 
                  productName={product?.name || ''} 
                  productImage={product?.image}
                />
              </div>
            </div>
          </div>
          
          {product.isPromo && (
            <div className="absolute bottom-4 left-4">
              <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded">
                PROMO
              </span>
            </div>
          )}
        </div>
        
        {/* Content */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 pt-4"
        >
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-xl font-bold text-foreground leading-tight flex-1">
              {product.name}
            </h2>
            <span className="bg-brand-light text-primary text-xs font-bold px-2 py-1 rounded-lg ml-2">
              Stok: {product.stock}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mb-4">
            <p className="text-2xl font-bold text-primary">
              {formatPrice(product.price)}
            </p>
            <div className="flex items-center gap-0.5 text-gold ml-2">
              <Star className="h-4 w-4 fill-current" />
              <span className="text-xs font-medium text-foreground">4.8</span>
            </div>
          </div>

          {/* Merchant No Quota Banner */}
          {merchant && !hasActiveQuota && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-destructive text-sm">Toko Tidak Dapat Menerima Pesanan</p>
                  <p className="text-xs text-destructive/80 mt-1">
                    Toko ini tidak memiliki kuota aktif. Silakan cari produk serupa dari toko lain.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Merchant Closed Banner */}
          {merchant && hasActiveQuota && !merchantStatus?.isCurrentlyOpen && (
            <div className="mb-4">
              <MerchantClosedBanner
                isManuallyOpen={merchant.isOpen}
                openTime={merchant.openTime}
                closeTime={merchant.closeTime}
                merchantName={merchant.name}
              />
            </div>
          )}
          
          {/* Merchant Info - Clickable to Store */}
          {merchant && (
            <Link 
              to={`/store/${merchant.id}`}
              className="block mb-6 p-3 bg-secondary rounded-xl border border-border hover:border-primary/30 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition">
                      {merchant.name}
                    </p>
                    {(merchant.badge === 'VERIFIED' || merchant.isVerified) && (
                      <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                    <MerchantStatusBadge
                      isManuallyOpen={merchant.isOpen}
                      openTime={merchant.openTime}
                      closeTime={merchant.closeTime}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    {merchant.villageName && (
                      <>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {merchant.villageName}
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 fill-gold text-gold" />
                      {merchant.ratingAvg.toFixed(1)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatTime(merchant.openTime || '08:00')} - {formatTime(merchant.closeTime || '17:00')}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground group-hover:text-primary transition">
                  Lihat Toko →
                </div>
              </div>
            </Link>
          )}

          <h3 className="font-bold text-sm text-foreground mb-2">Deskripsi</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {product.description}
          </p>
        </motion.div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="absolute bottom-0 w-full bg-card border-t border-border p-4 shadow-lg z-20">
        <div className="flex items-center gap-4 mb-3">
          {/* Quantity Selector */}
          <div className="flex items-center border border-border rounded-xl h-10 px-2">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-full text-muted-foreground hover:text-primary transition"
              disabled={!canOrder}
            >
              <Minus className="h-4 w-4 mx-auto" />
            </button>
            <span className="w-10 text-center font-bold text-foreground">
              {quantity}
            </span>
            <button 
              onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
              className="w-8 h-full text-muted-foreground hover:text-primary transition"
              disabled={!canOrder}
            >
              <Plus className="h-4 w-4 mx-auto" />
            </button>
          </div>
          
          <div className="flex-1 text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-primary">
              {formatPrice(product.price * quantity)}
            </p>
          </div>
        </div>
        
        <Button
          onClick={handleAddToCart}
          className="w-full shadow-brand"
          size="lg"
          disabled={!canOrder}
        >
          {!hasActiveQuota ? (
            <>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Tidak Dapat Memesan
            </>
          ) : canOrder ? (
            <>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Tambah ke Keranjang
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 mr-2" />
              Toko Sedang Tutup
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
