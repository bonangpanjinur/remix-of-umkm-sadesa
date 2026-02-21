import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart, Trash2, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WishlistItemData {
  id: string;
  product_id: string;
  products: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    merchants: {
      name: string;
    } | null;
  } | null;
}

export default function WishlistPage() {
  const { addToCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const [wishlist, setWishlist] = useState<WishlistItemData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWishlist();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchWishlist = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase
        .from('wishlists' as any)
        .select(`
          id,
          product_id,
          products (
            id,
            name,
            price,
            image_url,
            merchants (
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }));

      if (error) throw error;
      setWishlist((data || []) as unknown as WishlistItemData[]);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (wishlistId: string) => {
    try {
      const { error } = await supabase
        .from('wishlists' as any)
        .delete()
        .eq('id', wishlistId);

      if (error) throw error;

      setWishlist(wishlist.filter(item => item.id !== wishlistId));
      toast.success('Dihapus dari wishlist');
    } catch (error) {
      toast.error('Gagal menghapus dari wishlist');
    }
  };

  const handleAddToCart = async (item: WishlistItemData) => {
    if (!item.products) return;
    
    try {
      // Fetch actual stock and merchant_id from products table
      const { data: productData, error } = await supabase
        .from('products')
        .select('stock, is_active, merchant_id')
        .eq('id', item.products.id)
        .maybeSingle();

      if (error || !productData) {
        toast.error('Gagal memuat data produk');
        return;
      }

      if (!productData.is_active) {
        toast.error('Produk sudah tidak tersedia');
        return;
      }

      if (productData.stock <= 0) {
        toast.error('Stok produk habis');
        return;
      }

      addToCart({
        id: item.products.id,
        merchantId: productData.merchant_id || '',
        merchantName: item.products.merchants?.name || 'Toko',
        name: item.products.name,
        description: '',
        price: item.products.price,
        stock: productData.stock,
        image: item.products.image_url || '',
        category: 'kuliner',
        isActive: productData.is_active,
      });
      toast.success('Ditambahkan ke keranjang');
    } catch (err) {
      toast.error('Gagal menambahkan ke keranjang');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mobile-shell bg-background flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mobile-shell bg-background flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Heart className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="font-bold text-lg mb-2">Belum Login</h2>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Masuk untuk melihat wishlist Anda
          </p>
          <Link to="/auth">
            <Button>Masuk</Button>
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

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
              <p className="text-sm text-muted-foreground mb-4">
                Simpan produk favorit Anda di sini
              </p>
              <Link to="/">
                <Button>Mulai Belanja</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {wishlist.map((item, index) => {
                if (!item.products) return null;
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-card rounded-xl p-4 border border-border flex gap-4"
                  >
                    <Link to={`/product/${item.product_id}`}>
                      <img
                        src={item.products.image_url || '/placeholder.svg'}
                        alt={item.products.name}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                    </Link>
                    <div className="flex-1">
                      <Link to={`/product/${item.product_id}`}>
                        <h3 className="font-medium text-sm line-clamp-1 hover:text-primary transition">
                          {item.products.name}
                        </h3>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {item.products.merchants?.name || 'Toko'}
                      </p>
                      <p className="font-bold text-primary mt-1">
                        {formatPrice(item.products.price)}
                      </p>
                      
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
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
