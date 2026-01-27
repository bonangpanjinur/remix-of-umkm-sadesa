import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useWishlist } from '@/hooks/useWishlist';

interface WishlistButtonProps {
  productId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function WishlistButton({ productId, size = 'md', className }: WishlistButtonProps) {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const isWishlisted = isInWishlist(productId);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWishlist(productId);
  };

  return (
    <motion.button
      onClick={handleClick}
      whileTap={{ scale: 0.9 }}
      className={cn(
        'rounded-full flex items-center justify-center transition-all',
        isWishlisted
          ? 'bg-red-500 text-white'
          : 'bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-red-500',
        sizeClasses[size],
        className
      )}
    >
      <Heart
        className={cn(
          iconSizes[size],
          isWishlisted && 'fill-current'
        )}
      />
    </motion.button>
  );
}
