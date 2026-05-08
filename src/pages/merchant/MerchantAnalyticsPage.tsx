import { useState } from 'react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { ProductAnalytics } from '@/components/merchant/ProductAnalytics';
import { MerchantAnalyticsChart } from '@/components/merchant/MerchantAnalyticsChart';
import { SalesExport } from '@/components/merchant/SalesExport';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { AlertCircle, TrendingUp, ShoppingCart, Eye, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface AnalyticsStats {
  totalRevenue: number;
  totalOrders: number;
  totalViews: number;
  totalProducts: number;
  conversionRate: number;
}

export default function MerchantAnalyticsPage() {
  const { user } = useAuth();
  const { merchantId: guardMerchantId, merchantName: guardMerchantName, loading: guardLoading } = useMerchantGuard();

  const { data, isLoading: statsLoading } = useQuery<AnalyticsStats>({
    queryKey: ['merchant-analytics-stats', guardMerchantId],
    queryFn: async () => {
      const [ordersRes, productsRes] = await Promise.all([
        supabase.from('orders').select('total, status').eq('merchant_id', guardMerchantId!).in('status', ['DONE', 'DELIVERED']),
        supabase.from('products').select('view_count, order_count').eq('merchant_id', guardMerchantId!),
      ]);
      const orders = ordersRes.data || [];
      const products = productsRes.data || [];
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const totalOrders = orders.length;
      const totalViews = products.reduce((sum, p) => sum + (p.view_count || 0), 0);
      const totalProductOrders = products.reduce((sum, p) => sum + (p.order_count || 0), 0);
      const totalProducts = products.length;
      const conversionRate = totalViews > 0 ? (totalProductOrders / totalViews) * 100 : 0;
      return { totalRevenue, totalOrders, totalViews, totalProducts, conversionRate };
    },
    enabled: !!guardMerchantId && !guardLoading,
    staleTime: 60_000,
  });

  const loading = guardLoading || statsLoading;
  const merchantId = guardMerchantId;
  const merchantName = guardMerchantName;
  const stats = data ?? { totalRevenue: 0, totalOrders: 0, totalViews: 0, totalProducts: 0, conversionRate: 0 };

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
    <MerchantLayout title="Analitik" subtitle="Performa toko Anda" actions={<SalesExport merchantId={merchantId} merchantName={merchantName} />}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Pendapatan', value: formatPrice(stats.totalRevenue), icon: TrendingUp, color: 'bg-primary/10 text-primary' },
          { label: 'Total Pesanan', value: stats.totalOrders, icon: ShoppingCart, color: 'bg-success/10 text-success' },
          { label: 'Total Views', value: stats.totalViews.toLocaleString(), icon: Eye, color: 'bg-secondary' },
          { label: 'Konversi', value: `${stats.conversionRate.toFixed(1)}%`, icon: Package, color: 'bg-warning/10 text-warning' },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-bold text-lg">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
