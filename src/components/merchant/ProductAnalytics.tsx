import { useState, useEffect } from 'react';
import { BarChart3, Eye, ShoppingCart, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';

interface ProductAnalytic {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  stock: number;
  view_count: number;
  order_count: number;
  conversion_rate: number;
  revenue: number;
}

interface ProductAnalyticsProps {
  merchantId: string;
}

export function ProductAnalytics({ merchantId }: ProductAnalyticsProps) {
  const [products, setProducts] = useState<ProductAnalytic[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'views' | 'orders' | 'conversion' | 'revenue'>('orders');

  useEffect(() => {
    fetchAnalytics();
  }, [merchantId]);

  const fetchAnalytics = async () => {
    try {
      // Fetch products
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, image_url, price, stock, view_count, order_count')
        .eq('merchant_id', merchantId)
        .eq('is_active', true);

      if (productError) throw productError;

      // Calculate analytics
      const analytics: ProductAnalytic[] = (productData || []).map(p => {
        const viewCount = p.view_count || 0;
        const orderCount = p.order_count || 0;
        const conversionRate = viewCount > 0 ? (orderCount / viewCount) * 100 : 0;
        
        return {
          id: p.id,
          name: p.name,
          image_url: p.image_url,
          price: p.price,
          stock: p.stock,
          view_count: viewCount,
          order_count: orderCount,
          conversion_rate: conversionRate,
          revenue: orderCount * p.price,
        };
      });

      setProducts(analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'views':
        return b.view_count - a.view_count;
      case 'orders':
        return b.order_count - a.order_count;
      case 'conversion':
        return b.conversion_rate - a.conversion_rate;
      case 'revenue':
        return b.revenue - a.revenue;
      default:
        return 0;
    }
  });

  const totals = {
    views: products.reduce((sum, p) => sum + p.view_count, 0),
    orders: products.reduce((sum, p) => sum + p.order_count, 0),
    revenue: products.reduce((sum, p) => sum + p.revenue, 0),
    avgConversion: products.length > 0 
      ? products.reduce((sum, p) => sum + p.conversion_rate, 0) / products.length 
      : 0,
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analitik Produk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 bg-muted rounded" />
              ))}
            </div>
            <div className="h-64 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analitik Produk
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div 
            className={`p-4 rounded-lg border cursor-pointer transition-colors ${sortBy === 'views' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
            onClick={() => setSortBy('views')}
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-xs">Total Views</span>
            </div>
            <p className="text-2xl font-bold">{totals.views.toLocaleString()}</p>
          </div>

          <div 
            className={`p-4 rounded-lg border cursor-pointer transition-colors ${sortBy === 'orders' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
            onClick={() => setSortBy('orders')}
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs">Total Orders</span>
            </div>
            <p className="text-2xl font-bold">{totals.orders.toLocaleString()}</p>
          </div>

          <div 
            className={`p-4 rounded-lg border cursor-pointer transition-colors ${sortBy === 'conversion' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
            onClick={() => setSortBy('conversion')}
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Avg Conversion</span>
            </div>
            <p className="text-2xl font-bold">{totals.avgConversion.toFixed(1)}%</p>
          </div>

          <div 
            className={`p-4 rounded-lg border cursor-pointer transition-colors ${sortBy === 'revenue' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
            onClick={() => setSortBy('revenue')}
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold">{formatPrice(totals.revenue)}</p>
          </div>
        </div>

        {/* Products Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-center">Views</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead className="text-center">Conversion</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Belum ada data produk
                  </TableCell>
                </TableRow>
              ) : (
                sortedProducts.slice(0, 10).map((product, index) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm w-5">
                          {index + 1}
                        </span>
                        <div className="w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
                          {product.image_url ? (
                            <img 
                              src={product.image_url} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              📦
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(product.price)} · Stok: {product.stock}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Eye className="h-3 w-3 text-muted-foreground" />
                        {product.view_count.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                        {product.order_count.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={product.conversion_rate >= 5 ? 'default' : 'secondary'}
                        className={product.conversion_rate >= 5 ? 'bg-green-500' : ''}
                      >
                        {product.conversion_rate >= 5 ? (
                          <ArrowUpRight className="h-3 w-3 mr-1" />
                        ) : product.conversion_rate < 1 ? (
                          <ArrowDownRight className="h-3 w-3 mr-1" />
                        ) : null}
                        {product.conversion_rate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(product.revenue)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
