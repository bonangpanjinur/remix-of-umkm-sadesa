import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, ShoppingCart, Eye, Package, Loader2 } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';

interface MerchantAnalyticsChartProps {
  merchantId: string;
}

interface DailyStats {
  date: string;
  orders: number;
  revenue: number;
  views: number;
}

interface CategoryStats {
  name: string;
  value: number;
  color: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function MerchantAnalyticsChart({ merchantId }: MerchantAnalyticsChartProps) {
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [totals, setTotals] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalViews: 0,
    avgOrderValue: 0,
  });
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    if (merchantId) {
      fetchAnalytics();
    }
  }, [merchantId, period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = startOfDay(subDays(new Date(), days));

      // Fetch orders for the period
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total, created_at, status')
        .eq('merchant_id', merchantId)
        .gte('created_at', startDate.toISOString())
        .in('status', ['NEW', 'PROCESSED', 'SENT', 'DONE', 'DELIVERED']);

      if (ordersError) throw ordersError;

      // Fetch products for views and categories
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, category, view_count, order_count, price')
        .eq('merchant_id', merchantId)
        .eq('is_active', true);

      if (productsError) throw productsError;

      // Calculate daily stats
      const dailyMap = new Map<string, DailyStats>();
      
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        dailyMap.set(date, { date, orders: 0, revenue: 0, views: 0 });
      }

      (orders || []).forEach(order => {
        const date = format(new Date(order.created_at), 'yyyy-MM-dd');
        const existing = dailyMap.get(date);
        if (existing) {
          existing.orders += 1;
          existing.revenue += order.total;
        }
      });

      // Calculate category distribution
      const categoryMap = new Map<string, number>();
      let totalViews = 0;

      (products || []).forEach(product => {
        const category = product.category || 'lainnya';
        const current = categoryMap.get(category) || 0;
        categoryMap.set(category, current + (product.order_count || 0));
        totalViews += product.view_count || 0;
      });

      const categoryData: CategoryStats[] = Array.from(categoryMap.entries())
        .map(([name, value], index) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          color: COLORS[index % COLORS.length],
        }))
        .filter(c => c.value > 0);

      // Calculate totals
      const totalRevenue = (orders || []).reduce((sum, o) => sum + o.total, 0);
      const totalOrders = orders?.length || 0;

      setDailyStats(
        Array.from(dailyMap.values())
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(d => ({
            ...d,
            date: format(new Date(d.date), 'dd MMM', { locale: id }),
          }))
      );

      setCategoryStats(categoryData);
      setTotals({
        totalRevenue,
        totalOrders,
        totalViews,
        avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendapatan</p>
                <p className="text-lg font-bold">{formatPrice(totals.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-chart-2/10">
                <ShoppingCart className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pesanan</p>
                <p className="text-lg font-bold">{totals.totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-chart-3/10">
                <Eye className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pengunjung</p>
                <p className="text-lg font-bold">{totals.totalViews.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-chart-4/10">
                <Package className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rata-rata Order</p>
                <p className="text-lg font-bold">{formatPrice(totals.avgOrderValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tren Penjualan</CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <TabsList className="h-8">
              <TabsTrigger value="7d" className="text-xs px-2">7 Hari</TabsTrigger>
              <TabsTrigger value="30d" className="text-xs px-2">30 Hari</TabsTrigger>
              <TabsTrigger value="90d" className="text-xs px-2">90 Hari</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStats}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatPrice(value), 'Pendapatan']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Orders Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jumlah Pesanan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="orders" 
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Penjualan per Kategori</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {categoryStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Belum ada data penjualan
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
