import { Link } from 'react-router-dom';
import { Plus, Star, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Product } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { formatPrice, cn } from '@/lib/utils';
import { WishlistButton } from '@/components/WishlistButton';
import { useProductFlashSale } from '@/hooks/useFlashSales';
import { FlashSaleBadge } from '@/components/FlashSaleTimer';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

interface ProductCardProps {
  product: Product;
  index?: number;
  showCategoryBadge?: boolean;
}

const categoryLabels: Record<string, { label: string; className: string }> = {
  kuliner: { label: 'Kuliner', className: 'bg-warning/10 text-warning dark:bg-warning/20' },
  fashion: { label: 'Fashion', className: 'bg-primary/10 text-primary dark:bg-primary/20' },
  kriya: { label: 'Kriya', className: 'bg-info/10 text-info dark:bg-info/20' },
  wisata: { label: 'Wisata', className: 'bg-success/10 text-success dark:bg-success/20' },
};

const defaultCategoryStyle = { className: 'bg-muted text-muted-foreground' };

export function ProductCard({ product, index = 0, showCategoryBadge = false }: ProductCardProps) {
  const { addToCart } = useCart();
  const { flashSale } = useProductFlashSale(product.id);

  // Check availability - default to true for backwards compatibility
  const isAvailable = product.isAvailable !== false;
  const isMerchantOpen = product.isMerchantOpen !== false;
  const hasQuota = product.hasQuota !== false;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAvailable) return;
    addToCart(product, 1);
  };

  const categoryInfo = categoryLabels[product.category] || { label: product.category, className: 'bg-muted text-muted-foreground' };

  const displayPrice = flashSale ? flashSale.flashPrice : product.price;
  const originalPrice = flashSale ? flashSale.originalPrice : null;

  // Get unavailability reason
  const getUnavailableReason = () => {
    if (!hasQuota) return 'Toko Tutup';
    if (!isMerchantOpen) return 'Toko Tutup';
    return 'Tidak Tersedia';
  };

  const CardContent = (
    <div
      className={cn(
        "bg-card rounded-xl border border-border shadow-sm overflow-hidden relative group",
        isAvailable ? "cursor-pointer card-hover" : "cursor-not-allowed"
      )}
    >
      {/* Unavailable Overlay */}
      {!isAvailable && (
        <div className="absolute inset-0 z-20 bg-background/70 backdrop-blur-[1px] flex items-center justify-center">
          <div className="bg-muted/90 px-3 py-2 rounded-lg flex items-center gap-2 shadow-lg border border-border">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">
              {getUnavailableReason()}
            </span>
          </div>
        </div>
      )}

      {/* Badges Container */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {flashSale && isAvailable ? (
          <FlashSaleBadge 
            endTime={flashSale.endTime} 
            discountPercent={flashSale.discountPercent} 
          />
        ) : product.isPromo && isAvailable ? (
          <span className="bg-destructive text-destructive-foreground text-[8px] font-bold px-1.5 py-0.5 rounded">
            PROMO
          </span>
        ) : null}
        {showCategoryBadge && (
          <span className={cn("text-[8px] font-medium px-1.5 py-0.5 rounded", categoryInfo.className)}>
            {categoryInfo.label}
          </span>
        )}
      </div>
      
      {/* Wishlist Button */}
      {isAvailable && (
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton productId={product.id} size="sm" />
        </div>
      )}
      
      <div className={cn(
        "h-32 bg-muted overflow-hidden relative",
        !isAvailable && "grayscale"
      )}>
        <OptimizedImage 
          src={product.image} 
          alt={product.name}
          className={cn(
            "w-full h-full transition duration-300",
            isAvailable && "group-hover:scale-105"
          )}
          aspectRatio="auto"
          lazy
        />
      </div>
      
      <div className={cn("p-2.5", !isAvailable && "opacity-60")}>
        <div
          className="text-[9px] text-muted-foreground mb-0.5 truncate flex items-center gap-1"
        >
          {product.merchantName}
          <Star className="h-2 w-2 text-gold fill-gold" />
        </div>
        <h3 className="font-bold text-xs text-card-foreground line-clamp-2 min-h-[2.5em]">
          {product.name}
        </h3>
        <div className="flex justify-between items-center mt-1.5">
          <div className="flex flex-col">
            {originalPrice && isAvailable && (
              <span className="text-[9px] text-muted-foreground line-through">
                {formatPrice(originalPrice)}
              </span>
            )}
            <p className={cn(
              "font-bold text-xs",
              flashSale && isAvailable ? "text-destructive" : "text-primary"
            )}>
              {formatPrice(displayPrice)}
            </p>
          </div>
          {isAvailable && (
            <button
              onClick={handleAddToCart}
              className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      {isAvailable ? (
        <Link to={`/product/${product.id}`} className="block">
          {CardContent}
        </Link>
      ) : (
        CardContent
      )}
    </motion.div>
  );
}
