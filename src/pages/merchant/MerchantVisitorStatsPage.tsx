import { useState, useEffect } from 'react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { ProductStats } from '@/components/merchant/ProductStats';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Eye, Users, TrendingUp, ShoppingBag } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface DailyView {
  date: string;
  views: number;
  unique: number;
}

interface TopProduct {
  name: string;
  views: number;
}

export default function MerchantVisitorStatsPage() {
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');
  const [dailyViews, setDailyViews] = useState<DailyView[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [uniqueVisitors, setUniqueVisitors] = useState(0);
  const [storeViews, setStoreViews] = useState(0);

  useEffect(() => {
    const fetchMerchant = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('merchants')
          .select('id')
          .eq('user_id', user.id)
          .single();
        setMerchantId(data?.id || null);
      } catch (error) {
        console.error('Error fetching merchant:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMerchant();
  }, [user]);

  useEffect(() => {
    if (!merchantId) return;
    fetchViewStats();
  }, [merchantId, period]);

  const fetchViewStats = async () => {
    if (!merchantId) return;

    const days = period === '7d' ? 7 : 30;
    const startDate = startOfDay(subDays(new Date(), days));

    try {
      // Fetch all page views for this merchant
      const { data: views } = await supabase
        .from('page_views')
        .select('id, product_id, viewer_id, page_type, created_at')
        .eq('merchant_id', merchantId)
        .gte('created_at', startDate.toISOString());

      if (!views) return;

      // Calculate daily views
      const dailyMap = new Map<string, { views: number; viewers: Set<string> }>();
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        dailyMap.set(date, { views: 0, viewers: new Set() });
      }

      const allViewers = new Set<string>();
      let storeViewCount = 0;
      const productViewMap = new Map<string, number>();

      views.forEach(v => {
        const date = format(new Date(v.created_at), 'yyyy-MM-dd');
        const entry = dailyMap.get(date);
        if (entry) {
          entry.views++;
          if (v.viewer_id) {
            entry.viewers.add(v.viewer_id);
            allViewers.add(v.viewer_id);
          }
        }
        if (v.page_type === 'store') storeViewCount++;
        if (v.product_id) {
          productViewMap.set(v.product_id, (productViewMap.get(v.product_id) || 0) + 1);
        }
      });

      // Get product names for top products
      const topProductIds = Array.from(productViewMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      let topProductsData: TopProduct[] = [];
      if (topProductIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name')
          .in('id', topProductIds.map(([id]) => id));

        const nameMap = new Map((products || []).map(p => [p.id, p.name]));
        topProductsData = topProductIds.map(([id, count]) => ({
          name: nameMap.get(id) || 'Unknown',
          views: count,
        }));
      }

      setDailyViews(
        Array.from(dailyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, data]) => ({
            date: format(new Date(date), 'dd MMM', { locale: idLocale }),
            views: data.views,
            unique: data.viewers.size,
          }))
      );
      setTopProducts(topProductsData);
      setTotalViews(views.length);
      setUniqueVisitors(allViewers.size);
      setStoreViews(storeViewCount);
    } catch (error) {
      console.error('Error fetching view stats:', error);
    }
  };

  if (loading) {
    return (
      <MerchantLayout title="Statistik Pengunjung" subtitle="Lihat performa produk">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  if (!merchantId) {
    return (
      <MerchantLayout title="Statistik Pengunjung" subtitle="Lihat performa produk">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Toko tidak ditemukan</p>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Statistik Pengunjung" subtitle="Lihat performa produk">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Views</p>
                <p className="font-bold text-lg">{totalViews.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-2/10">
                <Users className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pengunjung Unik</p>
                <p className="font-bold text-lg">{uniqueVisitors.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-3/10">
                <ShoppingBag className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Views Toko</p>
                <p className="font-bold text-lg">{storeViews.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-4/10">
                <TrendingUp className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Views Produk</p>
                <p className="font-bold text-lg">{(totalViews - storeViews).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trend" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="trend">Tren Pengunjung</TabsTrigger>
            <TabsTrigger value="products">Performa Produk</TabsTrigger>
            <TabsTrigger value="top">Top Produk</TabsTrigger>
          </TabsList>
          <div className="flex gap-1">
            <button
              onClick={() => setPeriod('7d')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                period === '7d' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                period === '30d' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              30 Hari
            </button>
          </div>
        </div>

        <TabsContent value="trend">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tren Pengunjung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyViews}>
                    <defs>
                      <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorViews)" strokeWidth={2} name="Total Views" />
                    <Area type="monotone" dataKey="unique" stroke="hsl(var(--chart-2))" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" name="Pengunjung Unik" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <ProductStats merchantId={merchantId} />
        </TabsContent>

        <TabsContent value="top">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produk Paling Dilihat</CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis dataKey="name" type="category" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Views" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Belum ada data pengunjung</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MerchantLayout>
  );
}
