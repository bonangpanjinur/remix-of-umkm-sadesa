import { Link } from 'react-router-dom';
import { Plus, Star, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Product } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { formatPrice, cn } from '@/lib/utils';

interface ProductCardHorizontalProps {
  product: Product;
  index?: number;
}

export function ProductCardHorizontal({ product, index = 0 }: ProductCardHorizontalProps) {
  const { addToCart } = useCart();

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

  // Get unavailability reason
  const getUnavailableReason = () => {
    if (!hasQuota) return 'Toko Tutup';
    if (!isMerchantOpen) return 'Toko Tutup';
    return 'Tidak Tersedia';
  };

  const CardContent = (
    <div
      className={cn(
        "flex gap-3 bg-card rounded-xl p-3 border border-border shadow-sm relative overflow-hidden",
        isAvailable ? "hover:shadow-md transition-shadow group cursor-pointer" : "cursor-not-allowed"
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

      <div className={cn(
        "w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 relative",
        !isAvailable && "grayscale"
      )}>
        <img 
          src={product.image} 
          alt={product.name}
          className={cn(
            "w-full h-full object-cover transition duration-500",
            isAvailable && "group-hover:scale-110"
          )}
        />
        {product.isPromo && isAvailable && (
          <div className="absolute top-1 left-1">
            <span className="bg-destructive text-destructive-foreground text-[7px] font-bold px-1.5 py-0.5 rounded">
              PROMO
            </span>
          </div>
        )}
      </div>
      
      <div className={cn(
        "flex-1 min-w-0 flex flex-col justify-between py-0.5",
        !isAvailable && "opacity-60"
      )}>
        <div>
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-0.5">
            <span className="truncate">{product.merchantName}</span>
            <Star className="h-2 w-2 text-gold fill-gold flex-shrink-0" />
          </div>
          <h3 className={cn(
            "font-bold text-sm text-card-foreground line-clamp-2 transition",
            isAvailable && "group-hover:text-primary"
          )}>
            {product.name}
          </h3>
        </div>
        
        <div className="flex items-center justify-between mt-1">
          <p className="text-primary font-bold text-sm">
            {formatPrice(product.price)}
          </p>
          {isAvailable && (
            <button
              onClick={handleAddToCart}
              className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
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
