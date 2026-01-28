import { useState, useEffect } from 'react';
import { Eye, ShoppingCart, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface ProductStat {
  id: string;
  name: string;
  image_url: string | null;
  view_count: number;
  order_count: number;
  price: number;
}

interface ProductStatsProps {
  merchantId: string;
}

export function ProductStats({ merchantId }: ProductStatsProps) {
  const [products, setProducts] = useState<ProductStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'views' | 'orders'>('views');

  useEffect(() => {
    if (merchantId) {
      fetchProductStats();
    }
  }, [merchantId]);

  const fetchProductStats = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, image_url, view_count, order_count, price')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .order('view_count', { ascending: false })
        .limit(20);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching product stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === 'views') {
      return (b.view_count || 0) - (a.view_count || 0);
    }
    return (b.order_count || 0) - (a.order_count || 0);
  });

  const totalViews = products.reduce((sum, p) => sum + (p.view_count || 0), 0);
  const totalOrders = products.reduce((sum, p) => sum + (p.order_count || 0), 0);
  const conversionRate = totalViews > 0 ? ((totalOrders / totalViews) * 100).toFixed(1) : '0';

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="h-5 w-5 mx-auto text-chart-2 mb-1" />
            <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Views</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ShoppingCart className="h-5 w-5 mx-auto text-chart-3 mb-1" />
            <p className="text-2xl font-bold">{totalOrders.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-chart-4 mb-1" />
            <p className="text-2xl font-bold">{conversionRate}%</p>
            <p className="text-xs text-muted-foreground">Konversi</p>
          </CardContent>
        </Card>
      </div>

      {/* Sort Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSortBy('views')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            sortBy === 'views'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          Views Tertinggi
        </button>
        <button
          onClick={() => setSortBy('orders')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            sortBy === 'orders'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          Orders Tertinggi
        </button>
      </div>

      {/* Product List */}
      <div className="space-y-2">
        {sortedProducts.map((product, index) => {
          const viewRatio = totalViews > 0 ? (product.view_count || 0) / totalViews : 0;
          
          return (
            <Card key={product.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4">
                  {index + 1}
                </span>
                <div className="w-10 h-10 bg-muted rounded overflow-hidden flex-shrink-0">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      N/A
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {(product.view_count || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3" />
                      {(product.order_count || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">
                    {((product.order_count || 0) / Math.max(product.view_count || 1, 1) * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">konversi</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {products.length === 0 && (
        <div className="text-center py-8">
          <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Belum ada data statistik</p>
        </div>
      )}
    </div>
  );
}
