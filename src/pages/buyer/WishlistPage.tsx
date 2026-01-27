import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';

// For now, we'll use localStorage for wishlist
// In production, this should be stored in Supabase

interface WishlistItem {
  id: string;
  name: string;
  price: number;
  image: string;
  merchantName: string;
}

export default function WishlistPage() {
  const { addToCart } = useCart();
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => {
    const saved = localStorage.getItem('wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  const removeFromWishlist = (productId: string) => {
    const updated = wishlist.filter(item => item.id !== productId);
    setWishlist(updated);
    localStorage.setItem('wishlist', JSON.stringify(updated));
    toast.success('Dihapus dari wishlist');
  };

  const handleAddToCart = (item: WishlistItem) => {
    addToCart({
      id: item.id,
      merchantId: '',
      merchantName: item.merchantName,
      name: item.name,
      description: '',
      price: item.price,
      stock: 99,
      image: item.image,
      category: 'kuliner',
      isActive: true,
    });
    toast.success('Ditambahkan ke keranjang');
  };

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-5 py-4">
          <h1 className="text-xl font-bold mb-1">Wishlist Saya</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {wishlist.length} produk tersimpan
          </p>

          {wishlist.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="font-bold text-lg mb-1">Wishlist Kosong</h2>
              <p className="text-sm text-muted-foreground">
                Simpan produk favorit Anda di sini
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {wishlist.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card rounded-xl p-4 border border-border flex gap-4"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-sm line-clamp-1">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">{item.merchantName}</p>
                    <p className="font-bold text-primary mt-1">{formatPrice(item.price)}</p>
                    
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" onClick={() => handleAddToCart(item)}>
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Keranjang
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => removeFromWishlist(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
