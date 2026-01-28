import { Link } from 'react-router-dom';
import { Plus, Star, Zap } from 'lucide-react';
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
  kuliner: { label: 'Kuliner', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  fashion: { label: 'Fashion', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  kriya: { label: 'Kriya', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  wisata: { label: 'Wisata', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

export function ProductCard({ product, index = 0, showCategoryBadge = false }: ProductCardProps) {
  const { addToCart } = useCart();
  const { flashSale } = useProductFlashSale(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
  };

  const categoryInfo = categoryLabels[product.category] || { label: product.category, className: 'bg-muted text-muted-foreground' };

  const displayPrice = flashSale ? flashSale.flashPrice : product.price;
  const originalPrice = flashSale ? flashSale.originalPrice : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        to={`/product/${product.id}`}
        className="bg-card rounded-xl border border-border shadow-sm overflow-hidden relative group cursor-pointer block card-hover"
      >
        {/* Badges Container */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {flashSale ? (
            <FlashSaleBadge 
              endTime={flashSale.endTime} 
              discountPercent={flashSale.discountPercent} 
            />
          ) : product.isPromo ? (
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
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton productId={product.id} size="sm" />
        </div>
        
        <div className="h-32 bg-muted overflow-hidden relative">
          <OptimizedImage 
            src={product.image} 
            alt={product.name}
            className="w-full h-full group-hover:scale-105 transition duration-300"
            aspectRatio="auto"
            lazy
          />
        </div>
        
        <div className="p-2.5">
          <Link 
            to={`/store/${product.merchantId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[9px] text-muted-foreground mb-0.5 truncate flex items-center gap-1 hover:text-primary transition"
          >
            {product.merchantName}
            <Star className="h-2 w-2 text-amber-500 fill-amber-500" />
          </Link>
          <h3 className="font-bold text-xs text-card-foreground line-clamp-2 min-h-[2.5em]">
            {product.name}
          </h3>
          <div className="flex justify-between items-center mt-1.5">
            <div className="flex flex-col">
              {originalPrice && (
                <span className="text-[9px] text-muted-foreground line-through">
                  {formatPrice(originalPrice)}
                </span>
              )}
              <p className={cn(
                "font-bold text-xs",
                flashSale ? "text-destructive" : "text-primary"
              )}>
                {formatPrice(displayPrice)}
              </p>
            </div>
            <button
              onClick={handleAddToCart}
              className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
