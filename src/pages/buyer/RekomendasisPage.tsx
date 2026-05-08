import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';
import { ArrowLeft, Sparkles, Star, ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

interface RecommendedProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image_url: string | null;
  category: string;
  merchant_name: string;
  rating_avg: number;
  sold_count: number;
  reason: string;
}

export default function RekomendasisPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart: addItem } = useCart();
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();
  }, [user]);

  const fetchRecommendations = async () => {
    try {
      const recommendations: RecommendedProduct[] = [];

      if (user) {
        // Get user's order history for personalization
        // Ambil order IDs milik user dulu, lalu order_items-nya
        const { data: userOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('buyer_id', user.id)
          .limit(30);

        const orderIds = (userOrders || []).map((o: any) => o.id);

        const { data: orderItems } = orderIds.length > 0
          ? await supabase
              .from('order_items')
              .select('product_id, products(category, merchant_id)')
              .in('order_id', orderIds)
              .limit(20)
          : { data: [] };

        const orderedCategories = new Set<string>();
        const orderedMerchants = new Set<string>();

        ((orderItems || []) as any[]).forEach(oi => {
          if (oi.products?.category) orderedCategories.add(oi.products.category);
          if (oi.products?.merchant_id) orderedMerchants.add(oi.products.merchant_id);
        });

        // Recommend from same categories
        if (orderedCategories.size > 0) {
          const cats = Array.from(orderedCategories).slice(0, 3);
          const { data: catProducts } = await supabase
            .from('products')
            .select('*, merchants(name)')
            .in('category', cats)
            .eq('is_active', true)
            .not('id', 'in', `(${(orderItems || []).map((oi: any) => oi.product_id).join(',') || "''"})`)
            .order('sold_count', { ascending: false })
            .limit(8);

          ((catProducts || []) as any[]).forEach(p => {
            recommendations.push({
              id: p.id,
              name: p.name,
              price: p.is_promo && p.discount_percent > 0 ? Math.round(p.price * (1 - p.discount_percent / 100)) : p.price,
              originalPrice: p.is_promo && p.discount_percent > 0 ? p.price : undefined,
              image_url: p.image_url,
              category: p.category,
              merchant_name: p.merchants?.name || '',
              rating_avg: p.rating_avg || 0,
              sold_count: p.sold_count || 0,
              reason: `Sesuai kategori favorit kamu`,
            });
          });
        }
      }

      // Fill with best sellers if needed
      if (recommendations.length < 12) {
        const { data: bestSellers } = await supabase
          .from('products')
          .select('*, merchants(name)')
          .eq('is_active', true)
          .order('sold_count', { ascending: false })
          .limit(12 - recommendations.length);

        ((bestSellers || []) as any[]).forEach(p => {
          if (!recommendations.find(r => r.id === p.id)) {
            recommendations.push({
              id: p.id,
              name: p.name,
              price: p.is_promo && p.discount_percent > 0 ? Math.round(p.price * (1 - p.discount_percent / 100)) : p.price,
              originalPrice: p.is_promo && p.discount_percent > 0 ? p.price : undefined,
              image_url: p.image_url,
              category: p.category,
              merchant_name: p.merchants?.name || '',
              rating_avg: p.rating_avg || 0,
              sold_count: p.sold_count || 0,
              reason: 'Paling banyak terjual',
            });
          }
        });
      }

      setProducts(recommendations);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (p: RecommendedProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image_url || '',
      merchantId: '',
      merchantName: p.merchant_name,
      stock: 99,
    } as any, 1);
    toast.success('Ditambahkan ke keranjang');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3">
          <ArrowLeft className="h-4 w-4 mr-2" />Kembali
        </Button>

        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="h-6 w-6 text-yellow-500" />
          <div>
            <h1 className="text-xl font-bold">Rekomendasi untuk Kamu</h1>
            <p className="text-sm text-muted-foreground">
              {user ? 'Dipersonalisasi berdasarkan riwayat belanjamu' : 'Produk terpopuler di DesaMart'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Belum ada rekomendasi</p>
            <Button className="mt-3" onClick={() => navigate('/')}>Jelajahi Produk</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => (
              <Card key={p.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/product/${p.id}`)}>
                <div className="relative">
                  <img src={p.image_url || '/placeholder.jpg'} alt={p.name} className="w-full h-36 object-cover" />
                  {p.originalPrice && (
                    <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs">
                      -{Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}%
                    </Badge>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />{p.reason}
                  </p>
                  <p className="font-medium text-sm line-clamp-2">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.merchant_name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs">{p.rating_avg > 0 ? p.rating_avg.toFixed(1) : 'Baru'}</span>
                    <span className="text-xs text-muted-foreground">• {p.sold_count} terjual</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <p className="font-bold text-emerald-600 text-sm">{formatPrice(p.price)}</p>
                      {p.originalPrice && <p className="text-xs text-muted-foreground line-through">{formatPrice(p.originalPrice)}</p>}
                    </div>
                    <button
                      onClick={e => handleAddToCart(p, e)}
                      className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center hover:bg-emerald-700 transition-colors"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
