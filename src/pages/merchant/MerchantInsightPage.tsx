import { useState } from 'react';
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, Star, Clock,
  Package, BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw, Trophy, AlertCircle
} from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { useQuery } from '@tanstack/react-query';
import { formatPrice } from '@/lib/utils';
import {
  startOfDay, endOfDay, subDays, startOfWeek, endOfWeek,
  format, getHours, eachDayOfInterval, isSameDay
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Order {
  id: string;
  total: number;
  status: string;
  created_at: string;
  delivery_phone: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  view_count: number | null;
  order_count: number | null;
  is_active: boolean;
  category: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const HOURS_LABEL = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

function DeltaBadge({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const positive = value >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

export default function MerchantInsightPage() {
  const { merchantId, loading: guardLoading } = useMerchantGuard();
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');

  const days = period === '7d' ? 7 : 30;
  const periodStart = subDays(new Date(), days).toISOString();
  const prevPeriodStart = subDays(new Date(), days * 2).toISOString();

  // All orders in period + previous period
  const { data: allOrders = [], isLoading: ordersLoading, refetch } = useQuery<Order[]>({
    queryKey: ['merchant-insight-orders', merchantId, period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, status, created_at, delivery_phone')
        .eq('merchant_id', merchantId!)
        .gte('created_at', prevPeriodStart)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as Order[];
    },
    enabled: !!merchantId && !guardLoading,
    staleTime: 60_000,
  });

  // Products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['merchant-insight-products', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, stock, view_count, order_count, is_active, category')
        .eq('merchant_id', merchantId!)
        .order('order_count', { ascending: false });
      if (error) throw error;
      return (data || []) as Product[];
    },
    enabled: !!merchantId && !guardLoading,
    staleTime: 60_000,
  });

  const loading = ordersLoading || productsLoading || guardLoading;

  // Computed stats
  const doneStatuses = ['DONE', 'DELIVERED'];
  const currentOrders = allOrders.filter(o => new Date(o.created_at) >= new Date(periodStart) && doneStatuses.includes(o.status));
  const prevOrders = allOrders.filter(o => new Date(o.created_at) < new Date(periodStart) && doneStatuses.includes(o.status));

  const currentRevenue = currentOrders.reduce((s, o) => s + o.total, 0);
  const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0);
  const revenueDelta = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const currentCount = currentOrders.length;
  const prevCount = prevOrders.length;
  const ordersDelta = prevCount > 0 ? ((currentCount - prevCount) / prevCount) * 100 : 0;

  const currentAOV = currentCount > 0 ? currentRevenue / currentCount : 0;
  const prevAOV = prevCount > 0 ? prevRevenue / prevCount : 0;
  const aovDelta = prevAOV > 0 ? ((currentAOV - prevAOV) / prevAOV) * 100 : 0;

  // Unique buyers
  const currentBuyers = new Set(currentOrders.map(o => o.delivery_phone).filter(Boolean)).size;
  const prevBuyers = new Set(prevOrders.map(o => o.delivery_phone).filter(Boolean)).size;
  const buyersDelta = prevBuyers > 0 ? ((currentBuyers - prevBuyers) / prevBuyers) * 100 : 0;

  // Repeat buyers
  const allBuyerPhones = allOrders.filter(o => doneStatuses.includes(o.status)).map(o => o.delivery_phone).filter(Boolean) as string[];
  const phoneCounts = allBuyerPhones.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {} as Record<string, number>);
  const repeatBuyers = Object.values(phoneCounts).filter(c => c > 1).length;
  const totalUniqueBuyers = Object.keys(phoneCounts).length;
  const repeatRate = totalUniqueBuyers > 0 ? (repeatBuyers / totalUniqueBuyers) * 100 : 0;

  // Daily revenue chart
  const dayInterval = eachDayOfInterval({ start: new Date(periodStart), end: new Date() });
  const dailyData = dayInterval.map(day => {
    const dayOrders = currentOrders.filter(o => isSameDay(new Date(o.created_at), day));
    return {
      date: format(day, 'd MMM', { locale: idLocale }),
      omzet: dayOrders.reduce((s, o) => s + o.total, 0),
      pesanan: dayOrders.length,
    };
  });

  // Peak hours
  const hourCounts = Array(24).fill(0);
  for (const o of allOrders.filter(o => doneStatuses.includes(o.status))) {
    hourCounts[getHours(new Date(o.created_at))]++;
  }
  const peakHourData = hourCounts.map((count, hour) => ({
    jam: `${hour.toString().padStart(2, '0')}`,
    pesanan: count,
  })).filter(d => d.pesanan > 0 || (d.jam >= '07' && d.jam <= '22'));

  // Top products
  const topProducts = [...products].sort((a, b) => (b.order_count || 0) - (a.order_count || 0)).slice(0, 5);
  const worstProducts = [...products]
    .filter(p => p.is_active && (p.view_count || 0) > 0)
    .sort((a, b) => {
      const convA = ((a.order_count || 0) / Math.max(a.view_count || 1, 1));
      const convB = ((b.order_count || 0) / Math.max(b.view_count || 1, 1));
      return convA - convB;
    })
    .slice(0, 5);

  // Revenue by day of week
  const dayOfWeekData = DAYS_ID.map((label, idx) => {
    const dayOrders = allOrders.filter(o => new Date(o.created_at).getDay() === idx && doneStatuses.includes(o.status));
    return { hari: label, pesanan: dayOrders.length, omzet: dayOrders.reduce((s, o) => s + o.total, 0) };
  });

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  for (const p of products) {
    categoryMap[p.category] = (categoryMap[p.category] || 0) + (p.order_count || 0);
  }
  const categoryData = Object.entries(categoryMap)
    .map(([cat, count]) => ({ name: cat, value: count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const peakHour = peakHourData.reduce((max, h) => h.pesanan > max.pesanan ? h : max, { jam: '-', pesanan: 0 });
  const peakDay = dayOfWeekData.reduce((max, d) => d.pesanan > max.pesanan ? d : max, { hari: '-', pesanan: 0, omzet: 0 });

  if (guardLoading) {
    return (
      <MerchantLayout title="Insight Bisnis" subtitle="Analisis mendalam performa toko">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Insight Bisnis" subtitle="Analisis mendalam: tren, jam ramai, produk terlaris">
      <div className="space-y-6">

        {/* Period Selector */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={period === '7d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('7d')}
            >7 Hari</Button>
            <Button
              variant={period === '30d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('30d')}
            >30 Hari</Button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Omzet</span>
              </div>
              <p className="text-xl font-bold">{formatPrice(currentRevenue)}</p>
              <DeltaBadge value={revenueDelta} />
              <p className="text-xs text-muted-foreground mt-0.5">vs {days} hari sebelumnya</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total Order</span>
              </div>
              <p className="text-xl font-bold">{currentCount}</p>
              <DeltaBadge value={ordersDelta} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Rata-rata/Order</span>
              </div>
              <p className="text-xl font-bold">{formatPrice(currentAOV)}</p>
              <DeltaBadge value={aovDelta} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Pelanggan Unik</span>
              </div>
              <p className="text-xl font-bold">{currentBuyers}</p>
              <DeltaBadge value={buyersDelta} />
            </CardContent>
          </Card>
        </div>

        {/* Highlight Boxes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Jam Ramai</p>
            <p className="font-bold text-lg text-green-700 dark:text-green-400">{peakHour.jam}:00</p>
            <p className="text-xs text-muted-foreground">{peakHour.pesanan} order</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Hari Terbaik</p>
            <p className="font-bold text-lg text-blue-700 dark:text-blue-400">{peakDay.hari}</p>
            <p className="text-xs text-muted-foreground">{peakDay.pesanan} order</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Pelanggan Repeat</p>
            <p className="font-bold text-lg text-purple-700 dark:text-purple-400">{repeatRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">{repeatBuyers} dari {totalUniqueBuyers}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Produk Aktif</p>
            <p className="font-bold text-lg text-orange-700 dark:text-orange-400">{products.filter(p => p.is_active).length}</p>
            <p className="text-xs text-muted-foreground">dari {products.length} produk</p>
          </div>
        </div>

        <Tabs defaultValue="tren">
          <TabsList className="w-full">
            <TabsTrigger value="tren" className="flex-1">Tren Omzet</TabsTrigger>
            <TabsTrigger value="jam" className="flex-1">Jam Ramai</TabsTrigger>
            <TabsTrigger value="produk" className="flex-1">Produk</TabsTrigger>
            <TabsTrigger value="pelanggan" className="flex-1">Pelanggan</TabsTrigger>
          </TabsList>

          {/* TREN OMZET */}
          <TabsContent value="tren" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Omzet Harian</CardTitle>
                <CardDescription>Tren pendapatan {days} hari terakhir</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-56 flex items-center justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient id="colorOmzet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : v} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [formatPrice(v), 'Omzet']} />
                      <Area type="monotone" dataKey="omzet" stroke="#10b981" fill="url(#colorOmzet)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Omzet per Hari dalam Seminggu</CardTitle>
                <CardDescription>Hari mana yang paling ramai secara historis</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dayOfWeekData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="hari" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : String(v)} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [formatPrice(v), 'Omzet']} />
                    <Bar dataKey="omzet" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {categoryData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Penjualan per Kategori</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* JAM RAMAI */}
          <TabsContent value="jam" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  Jam Ramai Pesanan
                </CardTitle>
                <CardDescription>
                  Jam paling banyak order masuk. Gunakan untuk menentukan jam promosi & jadwal buka toko.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-48 flex items-center justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={peakHourData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="jam" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(v: number) => [v, 'Pesanan']} labelFormatter={l => `Jam ${l}:00`} />
                      <Bar dataKey="pesanan" radius={[4, 4, 0, 0]}>
                        {peakHourData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.pesanan === peakHour.pesanan ? '#10b981' : '#3b82f6'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {peakHour.pesanan > 0 && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-sm">
                    <p className="font-medium text-green-700 dark:text-green-400">
                      💡 Jam paling ramai: <strong>{peakHour.jam}:00 – {peakHour.jam}:59</strong> dengan {peakHour.pesanan} pesanan
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Disarankan aktifkan promo / flash sale 30 menit sebelum jam ini untuk memaksimalkan penjualan.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pesanan per Hari</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dayOfWeekData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="hari" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [v, 'Pesanan']} />
                    <Bar dataKey="pesanan" radius={[4, 4, 0, 0]}>
                      {dayOfWeekData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.pesanan === peakDay.pesanan ? '#10b981' : '#94a3b8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {peakDay.pesanan > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                    <p className="font-medium text-blue-700 dark:text-blue-400">
                      💡 Hari terbaik: <strong>{peakDay.hari}</strong> dengan {peakDay.pesanan} pesanan ({formatPrice(peakDay.omzet)})
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRODUK */}
          <TabsContent value="produk" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Top 5 Produk Terlaris
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada data produk</p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((p, i) => {
                      const maxOrders = topProducts[0].order_count || 1;
                      const pct = ((p.order_count || 0) / maxOrders) * 100;
                      return (
                        <div key={p.id} className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-sm font-bold w-5 shrink-0 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                                #{i + 1}
                              </span>
                              <span className="text-sm font-medium truncate">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-muted-foreground">{formatPrice(p.price)}</span>
                              <Badge variant="secondary" className="text-xs">{p.order_count || 0}x terjual</Badge>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${i === 0 ? 'bg-yellow-500' : 'bg-primary'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">{p.view_count || 0} dilihat • {((p.order_count || 0) / Math.max(p.view_count || 1, 1) * 100).toFixed(1)}% konversi</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {worstProducts.length > 0 && (
              <Card className="border-orange-200 dark:border-orange-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    Produk Perlu Perhatian
                  </CardTitle>
                  <CardDescription>Produk yang banyak dilihat tapi jarang dibeli — pertimbangkan turunkan harga atau ubah deskripsi</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {worstProducts.map(p => {
                      const conv = ((p.order_count || 0) / Math.max(p.view_count || 1, 1)) * 100;
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 p-2.5 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.view_count || 0} dilihat • {p.order_count || 0} terjual</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-orange-600">{conv.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">konversi</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Stok Menipis</CardTitle>
              </CardHeader>
              <CardContent>
                {products.filter(p => p.stock <= 5 && p.is_active).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Semua stok aman ✅</p>
                ) : (
                  <div className="space-y-2">
                    {products.filter(p => p.stock <= 5 && p.is_active).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm font-medium">{p.name}</p>
                        <Badge variant="destructive" className="text-xs">
                          Sisa {p.stock}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PELANGGAN */}
          <TabsContent value="pelanggan" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <Users className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pelanggan Unik</p>
                      <p className="text-2xl font-bold">{totalUniqueBuyers}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Semua pelanggan yang pernah order dari toko Anda</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Star className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tingkat Pelanggan Repeat</p>
                      <p className="text-2xl font-bold">{repeatRate.toFixed(1)}%</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{repeatBuyers} dari {totalUniqueBuyers} pelanggan order lebih dari sekali</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Interpretasi & Rekomendasi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {repeatRate >= 30 ? (
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-sm">
                    <p className="font-medium text-green-700 dark:text-green-400">✅ Loyalitas pelanggan sangat baik ({repeatRate.toFixed(0)}%)</p>
                    <p className="text-xs text-muted-foreground mt-1">Pertahankan kualitas produk dan layanan. Pertimbangkan program loyalitas atau voucher khusus pelanggan repeat.</p>
                  </div>
                ) : repeatRate >= 15 ? (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg text-sm">
                    <p className="font-medium text-yellow-700 dark:text-yellow-400">⚠️ Loyalitas pelanggan perlu ditingkatkan ({repeatRate.toFixed(0)}%)</p>
                    <p className="text-xs text-muted-foreground mt-1">Coba kirim broadcast promo ke pelanggan lama, atau aktifkan voucher diskon untuk order berikutnya.</p>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm">
                    <p className="font-medium text-red-700 dark:text-red-400">🔴 Pelanggan jarang balik lagi ({repeatRate.toFixed(0)}%)</p>
                    <p className="text-xs text-muted-foreground mt-1">Tingkatkan kualitas produk atau layanan. Aktifkan fitur broadcast WA untuk mengajak pelanggan kembali berbelanja.</p>
                  </div>
                )}

                {currentAOV > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                    <p className="font-medium text-blue-700 dark:text-blue-400">💡 Rata-rata belanja: {formatPrice(currentAOV)}/order</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentAOV < 50000
                        ? 'Coba bundling produk atau tambah minimum order untuk gratis ongkir untuk naikan AOV.'
                        : currentAOV < 150000
                          ? 'AOV cukup baik. Tambah produk premium atau paket bundling untuk terus naikan nilai belanja.'
                          : 'AOV sangat baik! Pelanggan Anda berbelanja dalam jumlah besar.'}
                    </p>
                  </div>
                )}

                {peakHour.pesanan > 0 && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-sm">
                    <p className="font-medium text-purple-700 dark:text-purple-400">⏰ Jadwalkan promosi sebelum jam {peakHour.jam}:00</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aktifkan Flash Sale atau broadcast WA 30 menit sebelum jam ramai untuk memaksimalkan konversi.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MerchantLayout>
  );
}
