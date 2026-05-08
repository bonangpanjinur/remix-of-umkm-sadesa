import { useState, useEffect } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Download, TrendingUp, ShoppingCart, Package, CreditCard, Banknote, QrCode } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function POSLaporanPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOmzet: 0, totalTransactions: 0, avgBasket: 0, totalDiscount: 0,
    salesChart: [] as any[],
    topProducts: [] as any[],
    paymentMethods: [] as any[],
    periodLabel: '',
  });

  useEffect(() => {
    if (tenant && activeOutlet) fetchReport();
  }, [tenant, activeOutlet, period]);

  const getRange = () => {
    const now = new Date();
    switch (period) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year': return { start: startOfYear(now), end: endOfYear(now) };
      default: return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const fetchReport = async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    const { start, end } = getRange();

    try {
      const { data: salesData } = await supabase
        .from('pos_sales' as any)
        .select('*, pos_sale_items(*)')
        .eq('tenant_id', tenant.id)
        .eq('outlet_id', activeOutlet.id)
        .eq('status', 'completed')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at');

      const sales = (salesData || []) as any[];
      const totalOmzet = sales.reduce((s, r) => s + Number(r.total), 0);
      const totalTransactions = sales.length;
      const totalDiscount = sales.reduce((s, r) => s + Number(r.discount_amount), 0);
      const avgBasket = totalTransactions > 0 ? totalOmzet / totalTransactions : 0;

      // Payment methods breakdown
      const paymentMap: Record<string, number> = {};
      sales.forEach(s => { paymentMap[s.payment_method] = (paymentMap[s.payment_method] || 0) + Number(s.total); });
      const paymentLabels: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debit: 'Debit', credit: 'Kredit', split: 'Split' };
      const paymentMethods = Object.entries(paymentMap).map(([key, val]) => ({ name: paymentLabels[key] || key, value: val }));

      // Sales chart
      let salesChart: any[] = [];
      if (period === 'today') {
        for (let h = 0; h < 24; h++) {
          const hourSales = sales.filter(s => new Date(s.created_at).getHours() === h);
          salesChart.push({ label: `${h}:00`, total: hourSales.reduce((sum, s) => sum + Number(s.total), 0), count: hourSales.length });
        }
      } else if (period === 'week') {
        for (let i = 0; i < 7; i++) {
          const day = addDays(start, i);
          const daySales = sales.filter(s => format(new Date(s.created_at), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
          salesChart.push({ label: format(day, 'EEE', { locale: idLocale }), total: daySales.reduce((sum, s) => sum + Number(s.total), 0), count: daySales.length });
        }
      } else if (period === 'month') {
        const days = eachDayOfInterval({ start, end });
        salesChart = days.map(day => {
          const daySales = sales.filter(s => format(new Date(s.created_at), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
          return { label: format(day, 'd', { locale: idLocale }), total: daySales.reduce((sum, s) => sum + Number(s.total), 0), count: daySales.length };
        });
      } else {
        for (let m = 0; m < 12; m++) {
          const monthSales = sales.filter(s => new Date(s.created_at).getMonth() === m);
          salesChart.push({ label: format(new Date(2024, m, 1), 'MMM', { locale: idLocale }), total: monthSales.reduce((sum, s) => sum + Number(s.total), 0), count: monthSales.length });
        }
      }

      // Top products from sale items
      const productMap: Record<string, { name: string; qty: number; total: number }> = {};
      sales.forEach(s => {
        (s.pos_sale_items || []).forEach((item: any) => {
          const key = item.product_name;
          if (!productMap[key]) productMap[key] = { name: key, qty: 0, total: 0 };
          productMap[key].qty += Number(item.qty);
          productMap[key].total += Number(item.subtotal);
        });
      });
      const topProducts = Object.values(productMap).sort((a, b) => b.total - a.total).slice(0, 10);

      const periodLabels: Record<string, string> = { today: 'Hari Ini', week: 'Minggu Ini', month: 'Bulan Ini', year: 'Tahun Ini' };
      setStats({ totalOmzet, totalTransactions, avgBasket, totalDiscount, salesChart, topProducts, paymentMethods, periodLabel: periodLabels[period] });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  function addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  const exportCSV = () => {
    const rows = [['Metrik', 'Nilai']];
    rows.push(['Omzet', String(stats.totalOmzet)]);
    rows.push(['Jumlah Transaksi', String(stats.totalTransactions)]);
    rows.push(['Rata-rata per Transaksi', String(stats.avgBasket)]);
    rows.push(['Total Diskon', String(stats.totalDiscount)]);
    rows.push(['', '']);
    rows.push(['Produk Terlaris', '']);
    stats.topProducts.forEach(p => rows.push([p.name, `${p.qty}x = ${p.total}`]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `laporan-${period}.csv`; a.click();
  };

  return (
    <POSLayout title="Laporan Penjualan" subtitle={`${activeOutlet?.name || ''} • ${stats.periodLabel}`}
      actions={
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="week">Minggu Ini</SelectItem>
              <SelectItem value="month">Bulan Ini</SelectItem>
              <SelectItem value="year">Tahun Ini</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>
        </div>
      }>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-emerald-100 text-xs">Total Omzet</p>
                  <TrendingUp className="h-4 w-4 text-emerald-200" />
                </div>
                <p className="text-xl font-bold">{formatCurrency(stats.totalOmzet)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-muted-foreground text-xs">Jumlah Transaksi</p>
                  <ShoppingCart className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-xl font-bold">{stats.totalTransactions}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-muted-foreground text-xs">Rata-rata Transaksi</p>
                  <CreditCard className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-xl font-bold">{formatCurrency(stats.avgBasket)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-muted-foreground text-xs">Total Diskon</p>
                  <Package className="h-4 w-4 text-orange-500" />
                </div>
                <p className="text-xl font-bold text-red-500">{formatCurrency(stats.totalDiscount)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Grafik Penjualan</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.salesChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : v >= 1000 ? `${(v/1000).toFixed(0)}rb` : String(v)} />
                  <Tooltip formatter={(val: number) => formatCurrency(val)} />
                  <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Produk Terlaris</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada data penjualan</p>
                ) : (
                  <div className="space-y-2">
                    {stats.topProducts.map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (p.total / (stats.topProducts[0]?.total || 1)) * 100)}%` }} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-medium">{formatCurrency(p.total)}</p>
                          <p className="text-xs text-muted-foreground">{p.qty}x</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Metode Pembayaran</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.paymentMethods.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada data pembayaran</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <PieChart width={120} height={120}>
                      <Pie data={stats.paymentMethods} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value">
                        {stats.paymentMethods.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                    <div className="flex-1 space-y-2">
                      {stats.paymentMethods.map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-muted-foreground">{m.name}</span>
                          </div>
                          <span className="font-medium">{formatCurrency(m.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </POSLayout>
  );
}
