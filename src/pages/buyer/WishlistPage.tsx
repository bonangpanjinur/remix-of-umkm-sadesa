import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart, Trash2, Loader2, Store } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

interface FavoriteMerchant {
  id: string;
  merchant_id: string;
  merchants: {
    id: string;
    name: string;
    image_url: string | null;
    rating_avg: number | null;
    rating_count: number | null;
    is_open: boolean;
  } | null;
}

export default function WishlistPage() {
  const { addToCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [wishlist, setWishlist] = useState<WishlistItemData[]>([]);
  const [favorites, setFavorites] = useState<FavoriteMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [favLoading, setFavLoading] = useState(true);

  const fetchWishlist = useCallback(async () => {
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
  }, [user]);

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('merchant_favorites')
        .select(`
          id,
          merchant_id,
          merchants (
            id,
            name,
            image_url,
            rating_avg,
            rating_count,
            is_open
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites((data || []) as FavoriteMerchant[]);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setFavLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchWishlist();
      fetchFavorites();
    } else if (!authLoading) {
      setLoading(false);
      setFavLoading(false);
    }
  }, [user, authLoading, fetchWishlist, fetchFavorites]);

  const removeFromWishlist = async (wishlistId: string) => {
    try {
      const { error } = await supabase
        .from('wishlists' as any)
        .delete()
        .eq('id', wishlistId);
      if (error) throw error;
      setWishlist(wishlist.filter(item => item.id !== wishlistId));
      toast.success('Dihapus dari wishlist');
    } catch {
      toast.error('Gagal menghapus dari wishlist');
    }
  };

  const removeFromFavorites = async (favoriteId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('merchant_favorites')
        .delete()
        .eq('id', favoriteId);
      if (error) throw error;
      setFavorites(favorites.filter(f => f.id !== favoriteId));
      toast.success('Dihapus dari favorit');
    } catch {
      toast.error('Gagal menghapus dari favorit');
    }
  };

  const handleAddToCart = async (item: WishlistItemData) => {
    if (!item.products) return;
    try {
      const { data: productData, error } = await supabase
        .from('products')
        .select('stock, is_active, merchant_id')
        .eq('id', item.products.id)
        .maybeSingle();

      if (error || !productData) { toast.error('Gagal memuat data produk'); return; }
      if (!productData.is_active) { toast.error('Produk sudah tidak tersedia'); return; }
      if (productData.stock <= 0) { toast.error('Stok produk habis'); return; }

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
    } catch {
      toast.error('Gagal menambahkan ke keranjang');
    }
  };

  if (authLoading) {
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
          <Link to="/auth"><Button>Masuk</Button></Link>
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
          <h1 className="text-xl font-bold mb-4">Wishlist & Favorit</h1>

          <Tabs defaultValue="products">
            <TabsList className="w-full grid grid-cols-2 mb-4">
              <TabsTrigger value="products" className="gap-1.5">
                <Heart className="h-3.5 w-3.5" />
                Produk
                {wishlist.length > 0 && (
                  <span className="ml-1 bg-primary/10 text-primary text-xs rounded-full px-1.5">
                    {wishlist.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="merchants" className="gap-1.5">
                <Store className="h-3.5 w-3.5" />
                Toko Favorit
                {favorites.length > 0 && (
                  <span className="ml-1 bg-primary/10 text-primary text-xs rounded-full px-1.5">
                    {favorites.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Product Wishlist */}
            <TabsContent value="products">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : wishlist.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Heart className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h2 className="font-bold text-lg mb-1">Wishlist Kosong</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Simpan produk favorit Anda di sini
                  </p>
                  <Link to="/"><Button>Mulai Belanja</Button></Link>
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
            </TabsContent>

            {/* Merchant Favorites */}
            <TabsContent value="merchants">
              {favLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : favorites.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Store className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h2 className="font-bold text-lg mb-1">Belum Ada Toko Favorit</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Tap ikon ❤️ di halaman toko untuk menyimpannya
                  </p>
                  <Button onClick={() => navigate('/shops')}>Jelajahi Toko</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {favorites.map((fav, index) => {
                    if (!fav.merchants) return null;
                    const m = fav.merchants;
                    return (
                      <motion.div
                        key={fav.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-card rounded-xl border border-border flex items-center gap-3 p-3"
                      >
                        <button
                          onClick={() => navigate(`/merchant/${m.id}`)}
                          className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0"
                        >
                          {m.image_url ? (
                            <img src={m.image_url} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Store className="h-7 w-7 text-muted-foreground" />
                            </div>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => navigate(`/merchant/${m.id}`)}
                            className="text-left"
                          >
                            <h3 className="font-semibold text-sm truncate hover:text-primary transition">
                              {m.name}
                            </h3>
                          </button>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-xs font-medium ${m.is_open ? 'text-green-600' : 'text-red-500'}`}>
                              {m.is_open ? 'Buka' : 'Tutup'}
                            </span>
                            {m.rating_avg && (
                              <>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="text-xs text-muted-foreground">
                                  ⭐ {m.rating_avg.toFixed(1)} ({m.rating_count || 0})
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            className="text-xs h-8 rounded-full px-3"
                            onClick={() => navigate(`/merchant/${m.id}`)}
                          >
                            Kunjungi
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-8 rounded-full px-3 text-destructive hover:text-destructive"
                            onClick={() => removeFromFavorites(fav.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
