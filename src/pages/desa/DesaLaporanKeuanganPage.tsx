import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Users, Store, Download, BarChart2, Mountain } from 'lucide-react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { formatPrice } from '@/lib/utils';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface MonthlyStats {
  month: string;
  merchant_orders: number;
  merchant_revenue: number;
  tourism_bookings: number;
  tourism_revenue: number;
  commission: number;
}

const COMMISSION_RATE = 0.03;

export default function DesaLaporanKeuanganPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'3' | '6' | '12'>('6');

  const { data: villageId } = useQuery<string | null>({
    queryKey: ['desa-village-id', user?.id],
    queryFn: async () => {
      const { data: uv } = await supabase.from('user_villages').select('village_id').eq('user_id', user!.id).maybeSingle();
      return uv?.village_id ?? null;
    },
    enabled: !!user,
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ['desa-laporan-keuangan', villageId, period],
    queryFn: async () => {
      if (!villageId) return null;
      const since = subMonths(new Date(), parseInt(period));

      const [merchantsRes, ordersRes, bookingsRes, tourismViewsRes] = await Promise.all([
        supabase.from('merchants').select('id, name').eq('village_id', villageId).eq('registration_status', 'APPROVED'),
        supabase.from('orders').select('id, total, status, created_at, merchant_id')
          .in('merchant_id', (await supabase.from('merchants').select('id').eq('village_id', villageId)).data?.map((m: any) => m.id) || [])
          .gte('created_at', since.toISOString())
          .in('status', ['DONE', 'DELIVERED']),
        supabase.from('tourism_bookings').select('id, total_price, status, created_at, visit_date, persons, contact_name')
          .eq('village_id', villageId)
          .gte('created_at', since.toISOString()),
        supabase.from('tourism').select('id, name, view_count, is_active').eq('village_id', villageId),
      ]);

      const merchants = merchantsRes.data || [];
      const orders = ordersRes.data || [];
      const bookings = bookingsRes.data || [];
      const tourismSpots = tourismViewsRes.data || [];

      // Build monthly data
      const months: MonthlyStats[] = [];
      for (let i = parseInt(period) - 1; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const mStart = startOfMonth(date);
        const mEnd = endOfMonth(date);

        const mOrders = orders.filter(o => new Date(o.created_at) >= mStart && new Date(o.created_at) <= mEnd);
        const mBookings = bookings.filter(b => new Date(b.created_at) >= mStart && new Date(b.created_at) <= mEnd);
        const mRevenue = mOrders.reduce((s, o) => s + (o.total || 0), 0);
        const mTourism = mBookings.filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED').reduce((s, b) => s + (b.total_price || 0), 0);

        months.push({
          month: format(date, 'MMM yy', { locale: idLocale }),
          merchant_orders: mOrders.length,
          merchant_revenue: mRevenue,
          tourism_bookings: mBookings.length,
          tourism_revenue: mTourism,
          commission: Math.round(mRevenue * COMMISSION_RATE),
        });
      }

      const totalMerchantRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
      const confirmedBookings = bookings.filter(b => ['CONFIRMED', 'COMPLETED'].includes(b.status));
      const totalTourismRevenue = confirmedBookings.reduce((s, b) => s + (b.total_price || 0), 0);
      const totalCommission = Math.round(totalMerchantRevenue * COMMISSION_RATE);
      const totalViews = tourismSpots.reduce((s, t) => s + (t.view_count || 0), 0);

      return {
        months,
        totalMerchantRevenue,
        totalTourismRevenue,
        totalCommission,
        totalViews,
        merchantCount: merchants.length,
        tourismCount: tourismSpots.length,
        pendingBookings: bookings.filter(b => b.status === 'PENDING').length,
        recentBookings: bookings.slice(0, 5),
      };
    },
    enabled: !!villageId,
    staleTime: 60_000,
  });

  const handleExportCSV = () => {
    if (!stats) return;
    const headers = ['Bulan', 'Pesanan Merchant', 'Omzet Merchant', 'Komisi Desa (3%)', 'Booking Wisata', 'Pendapatan Wisata'];
    const rows = (stats.months || []).map(m => [
      m.month, m.merchant_orders, m.merchant_revenue, m.commission, m.tourism_bookings, m.tourism_revenue,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-keuangan-desa-${format(new Date(), 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DesaLayout
      title="Laporan Keuangan Desa"
      subtitle="Rekap pendapatan merchant, wisata, dan komisi desa"
      actions={
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!stats}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      }
    >
      <div className="space-y-6 max-w-5xl">
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

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : !stats ? (
          <div className="text-center py-16 text-muted-foreground">
            <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Data belum tersedia</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Omzet Merchant</span>
                    <Store className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xl font-bold">{formatPrice(stats.totalMerchantRevenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.merchantCount} merchant aktif</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Komisi Desa (3%)</span>
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="text-xl font-bold text-emerald-600">{formatPrice(stats.totalCommission)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Dari transaksi marketplace</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Pendapatan Wisata</span>
                    <Mountain className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-xl font-bold">{formatPrice(stats.totalTourismRevenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.tourismCount} destinasi</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Total Kunjungan</span>
                    <Users className="h-4 w-4 text-purple-500" />
                  </div>
                  <p className="text-xl font-bold">{stats.totalViews.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.pendingBookings > 0 && <Badge variant="destructive" className="text-xs">{stats.pendingBookings} booking pending</Badge>}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Merchant revenue chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-5 w-5" /> Omzet Merchant & Komisi Desa
                </CardTitle>
                <CardDescription>Rekap transaksi marketplace merchant di desa ini</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.months} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: number) => formatPrice(v)} />
                    <Bar dataKey="merchant_revenue" name="Omzet Merchant" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="commission" name="Komisi Desa" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tourism trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mountain className="h-5 w-5" /> Tren Booking Wisata
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={stats.months} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="tourism_bookings" name="Booking" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly table */}
            <Card>
              <CardHeader><CardTitle className="text-base">Rincian Per Bulan</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-muted-foreground">Bulan</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Pesanan</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Omzet Merchant</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Komisi Desa</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Booking Wisata</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Pend. Wisata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.months.map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2.5 font-medium">
                            {row.month}
                            {i === stats.months.length - 1 && <Badge variant="secondary" className="ml-2 text-xs">Bulan ini</Badge>}
                          </td>
                          <td className="py-2.5 text-right">{row.merchant_orders}</td>
                          <td className="py-2.5 text-right">{formatPrice(row.merchant_revenue)}</td>
                          <td className="py-2.5 text-right text-emerald-600 font-medium">{formatPrice(row.commission)}</td>
                          <td className="py-2.5 text-right">{row.tourism_bookings}</td>
                          <td className="py-2.5 text-right">{formatPrice(row.tourism_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold">
                        <td className="pt-3">Total</td>
                        <td className="pt-3 text-right">{stats.months.reduce((s, m) => s + m.merchant_orders, 0)}</td>
                        <td className="pt-3 text-right">{formatPrice(stats.totalMerchantRevenue)}</td>
                        <td className="pt-3 text-right text-emerald-600">{formatPrice(stats.totalCommission)}</td>
                        <td className="pt-3 text-right">{stats.months.reduce((s, m) => s + m.tourism_bookings, 0)}</td>
                        <td className="pt-3 text-right">{formatPrice(stats.totalTourismRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DesaLayout>
  );
}
