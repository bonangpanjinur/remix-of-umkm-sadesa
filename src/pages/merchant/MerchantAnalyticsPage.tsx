import { useState, useEffect } from 'react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { ProductAnalytics } from '@/components/merchant/ProductAnalytics';
import { MerchantAnalyticsChart } from '@/components/merchant/MerchantAnalyticsChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { AlertCircle, TrendingUp, ShoppingCart, Eye, Package } from 'lucide-react';

export default function MerchantAnalyticsPage() {
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalViews: 0,
    totalProducts: 0,
    conversionRate: 0
  });

  useEffect(() => {
    const fetchMerchant = async () => {
      if (!user) return;

      try {
        const { data } = await supabase
          .from('merchants')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (data?.id) {
          setMerchantId(data.id);
          await fetchStats(data.id);
        }
      } catch (error) {
        console.error('Error fetching merchant:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMerchant();
  }, [user]);

  const fetchStats = async (id: string) => {
    try {
      // Fetch orders stats
      const { data: orders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('merchant_id', id)
        .in('status', ['DONE', 'DELIVERED']);

      const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      const totalOrders = orders?.length || 0;

      // Fetch products stats
      const { data: products } = await supabase
        .from('products')
        .select('view_count, order_count')
        .eq('merchant_id', id);

      const totalViews = products?.reduce((sum, p) => sum + (p.view_count || 0), 0) || 0;
      const totalProductOrders = products?.reduce((sum, p) => sum + (p.order_count || 0), 0) || 0;
      const totalProducts = products?.length || 0;

      const conversionRate = totalViews > 0 ? (totalProductOrders / totalViews) * 100 : 0;

      setStats({
        totalRevenue,
        totalOrders,
        totalViews,
        totalProducts,
        conversionRate
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  if (loading) {
    return (
      <MerchantLayout title="Analitik" subtitle="Performa toko Anda">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  if (!merchantId) {
    return (
      <MerchantLayout title="Analitik" subtitle="Performa toko Anda">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Toko tidak ditemukan</p>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Analitik" subtitle="Performa toko Anda">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Pendapatan</p>
                <p className="font-bold text-lg">{formatPrice(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <ShoppingCart className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Pesanan</p>
                <p className="font-bold text-lg">{stats.totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Eye className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Views</p>
                <p className="font-bold text-lg">{stats.totalViews.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Package className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Konversi</p>
                <p className="font-bold text-lg">{stats.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chart">Grafik Penjualan</TabsTrigger>
          <TabsTrigger value="products">Performa Produk</TabsTrigger>
        </TabsList>

        <TabsContent value="chart">
          <MerchantAnalyticsChart merchantId={merchantId} />
        </TabsContent>

        <TabsContent value="products">
          <ProductAnalytics merchantId={merchantId} />
        </TabsContent>
      </Tabs>
    </MerchantLayout>
  );
}
