import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Download, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { useQuery } from '@tanstack/react-query';
import { formatPrice } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, getMonth, getYear } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface MonthlyData {
  month: string;
  revenue: number;
  orders: number;
  platformFee: number;
  netRevenue: number;
}

interface OrderFinance {
  id: string;
  total: number;
  subtotal: number;
  platform_fee: number;
  shipping_cost: number;
  voucher_discount: number;
  status: string;
  created_at: string;
}

const PLATFORM_FEE_PERCENT = 3;

function generateMonthlyData(orders: OrderFinance[], months: number): MonthlyData[] {
  const result: MonthlyData[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const monthOrders = orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= monthStart && d <= monthEnd && ['DONE', 'DELIVERED'].includes(o.status);
    });

    const revenue = monthOrders.reduce((sum, o) => sum + (o.subtotal || o.total || 0), 0);
    const platformFee = Math.round(revenue * PLATFORM_FEE_PERCENT / 100);
    const netRevenue = revenue - platformFee;

    result.push({
      month: format(date, 'MMM yy', { locale: idLocale }),
      revenue,
      orders: monthOrders.length,
      platformFee,
      netRevenue,
    });
  }
  return result;
}

export default function MerchantFinancePage() {
  const { merchantId, merchantName, loading: guardLoading } = useMerchantGuard();
  const [period, setPeriod] = useState<'3' | '6' | '12'>('6');

  const { data: orders = [], isLoading } = useQuery<OrderFinance[]>({
    queryKey: ['merchant-finance-orders', merchantId],
    queryFn: async () => {
      const since = subMonths(new Date(), 12);
      const { data } = await supabase
        .from('orders')
        .select('id, total, subtotal, platform_fee, shipping_cost, voucher_discount, status, created_at')
        .eq('merchant_id', merchantId!)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });
      return (data || []) as OrderFinance[];
    },
    enabled: !!merchantId && !guardLoading,
    staleTime: 60_000,
  });

  const monthlyData = generateMonthlyData(orders, parseInt(period));

  const currentMonth = monthlyData[monthlyData.length - 1] || { revenue: 0, orders: 0, platformFee: 0, netRevenue: 0, month: '' };
  const prevMonth = monthlyData[monthlyData.length - 2] || { revenue: 0, orders: 0, platformFee: 0, netRevenue: 0, month: '' };

  const revenueChange = prevMonth.revenue > 0 ? ((currentMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100 : 0;
  const ordersChange = prevMonth.orders > 0 ? ((currentMonth.orders - prevMonth.orders) / prevMonth.orders) * 100 : 0;

  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const totalNet = monthlyData.reduce((s, m) => s + m.netRevenue, 0);
  const totalOrders = monthlyData.reduce((s, m) => s + m.orders, 0);
  const totalFee = monthlyData.reduce((s, m) => s + m.platformFee, 0);

  const handleExportCSV = () => {
    const headers = ['Bulan', 'Omzet', 'Pesanan', 'Biaya Platform (3%)', 'Pendapatan Bersih'];
    const rows = monthlyData.map(m => [
      m.month,
      m.revenue,
      m.orders,
      m.platformFee,
      m.netRevenue,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-keuangan-${merchantName || 'toko'}-${format(new Date(), 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (guardLoading || isLoading) {
    return (
      <MerchantLayout title="Laporan Keuangan" subtitle="Rekap laba rugi toko Anda">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout
      title="Laporan Keuangan"
      subtitle="Rekap omzet, biaya platform, dan pendapatan bersih"
      actions={
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      }
    >
      <div className="space-y-6 max-w-4xl">
        {/* Period selector */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground font-medium">Tampilkan:</span>
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Bulan</SelectItem>
              <SelectItem value="6">6 Bulan</SelectItem>
              <SelectItem value="12">12 Bulan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Total Omzet</span>
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xl font-bold">{formatPrice(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{period} bulan terakhir</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Pendapatan Bersih</span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-xl font-bold text-emerald-600">{formatPrice(totalNet)}</p>
              <p className="text-xs text-muted-foreground mt-1">Setelah biaya platform</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Total Pesanan</span>
                <ShoppingCart className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-xl font-bold">{totalOrders}</p>
              <p className="text-xs text-muted-foreground mt-1">Pesanan selesai</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Biaya Platform</span>
                <TrendingDown className="h-4 w-4 text-red-400" />
              </div>
              <p className="text-xl font-bold text-red-500">{formatPrice(totalFee)}</p>
              <p className="text-xs text-muted-foreground mt-1">{PLATFORM_FEE_PERCENT}% dari omzet</p>
            </CardContent>
          </Card>
        </div>

        {/* This month vs last month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bulan Ini vs Bulan Lalu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Omzet Bulan Ini</p>
                <p className="text-lg font-bold">{formatPrice(currentMonth.revenue)}</p>
                <div className="flex items-center gap-1">
                  {revenueChange >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span className={`text-xs font-medium ${revenueChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {Math.abs(revenueChange).toFixed(1)}% vs bulan lalu
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pesanan Bulan Ini</p>
                <p className="text-lg font-bold">{currentMonth.orders} pesanan</p>
                <div className="flex items-center gap-1">
                  {ordersChange >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span className={`text-xs font-medium ${ordersChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {Math.abs(ordersChange).toFixed(1)}% vs bulan lalu
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-5 w-5" />
              Grafik Omzet Bulanan
            </CardTitle>
            <CardDescription>Omzet kotor vs pendapatan bersih (setelah biaya platform)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(val: number) => formatPrice(val)} />
                <Bar dataKey="revenue" name="Omzet" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="netRevenue" name="Bersih" fill="hsl(var(--chart-2, 160 60% 45%))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tren Jumlah Pesanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="orders"
                  name="Pesanan"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly breakdown table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rincian Per Bulan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground">Bulan</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Pesanan</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Omzet</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Biaya Platform</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Bersih</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 font-medium">
                        {row.month}
                        {i === monthlyData.length - 1 && (
                          <Badge variant="secondary" className="ml-2 text-xs">Bulan ini</Badge>
                        )}
                      </td>
                      <td className="py-2.5 text-right">{row.orders}</td>
                      <td className="py-2.5 text-right">{formatPrice(row.revenue)}</td>
                      <td className="py-2.5 text-right text-red-500">-{formatPrice(row.platformFee)}</td>
                      <td className="py-2.5 text-right font-semibold text-emerald-600">{formatPrice(row.netRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="pt-3">Total</td>
                    <td className="pt-3 text-right">{totalOrders}</td>
                    <td className="pt-3 text-right">{formatPrice(totalRevenue)}</td>
                    <td className="pt-3 text-right text-red-500">-{formatPrice(totalFee)}</td>
                    <td className="pt-3 text-right text-emerald-600">{formatPrice(totalNet)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MerchantLayout>
  );
}
