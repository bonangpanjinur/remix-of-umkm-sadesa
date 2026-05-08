import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Cell
} from 'recharts';
import { Store, Download, RefreshCw, AlertCircle, Trophy, TrendingUp } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfYear, endOfYear,
  startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface OutletStat {
  outletId: string;
  outletName: string;
  totalOmzet: number;
  totalTransaksi: number;
  avgBasket: number;
  totalItem: number;
  totalDiskon: number;
  uniqueCustomers: number;
  cashSales: number;
  nonCashSales: number;
}

interface ComparisonPoint {
  name: string;
  [key: string]: number | string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Kustom' },
];

export default function POSLaporanOutletPage() {
  const { tenant, outlets, formatCurrency } = usePOS();
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [outletStats, setOutletStats] = useState<OutletStat[]>([]);
  const [dailyChart, setDailyChart] = useState<ComparisonPoint[]>([]);

  const getRange = useCallback(() => {
    const now = new Date();
    if (period === 'today') return { start: startOfDay(now), end: endOfDay(now) };
    if (period === 'week') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) };
    if (period === 'year') return { start: startOfYear(now), end: endOfYear(now) };
    return { start: startOfDay(parseISO(customStart)), end: endOfDay(parseISO(customEnd)) };
  }, [period, customStart, customEnd]);

  const fetchReport = useCallback(async () => {
    if (!tenant || outlets.length === 0) return;
    setLoading(true);
    const { start, end } = getRange();

    try {
      const { data: salesData } = await supabase.from('pos_sales' as any)
        .select('id, total, discount_amount, payment_method, customer_id, outlet_id, created_at, pos_sale_items(qty)')
        .eq('tenant_id', tenant.id)
        .eq('status', 'completed')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at');

      const sales = (salesData || []) as any[];
      const statsMap: Record<string, OutletStat> = {};

      outlets.forEach(o => {
        statsMap[o.id] = {
          outletId: o.id, outletName: o.name, totalOmzet: 0, totalTransaksi: 0,
          avgBasket: 0, totalItem: 0, totalDiskon: 0, uniqueCustomers: 0,
          cashSales: 0, nonCashSales: 0,
        };
      });

      const customerSets: Record<string, Set<string>> = {};
      outlets.forEach(o => { customerSets[o.id] = new Set(); });

      sales.forEach((s: any) => {
        const oid = s.outlet_id;
        if (!statsMap[oid]) return;
        statsMap[oid].totalOmzet += Number(s.total);
        statsMap[oid].totalTransaksi++;
        statsMap[oid].totalDiskon += Number(s.discount_amount || 0);
        statsMap[oid].totalItem += (s.pos_sale_items || []).reduce((a: number, i: any) => a + Number(i.qty), 0);
        if (s.payment_method === 'cash') statsMap[oid].cashSales += Number(s.total);
        else statsMap[oid].nonCashSales += Number(s.total);
        if (s.customer_id && customerSets[oid]) customerSets[oid].add(s.customer_id);
      });

      const statsArr = Object.values(statsMap).map(s => ({
        ...s,
        avgBasket: s.totalTransaksi > 0 ? s.totalOmzet / s.totalTransaksi : 0,
        uniqueCustomers: customerSets[s.outletId]?.size || 0,
      })).sort((a, b) => b.totalOmzet - a.totalOmzet);

      setOutletStats(statsArr);

      // Daily chart (up to 30 days)
      const days: ComparisonPoint[] = [];
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const step = Math.max(1, Math.ceil(diff / 30));

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + step)) {
        const dayStart = startOfDay(new Date(d));
        const dayEnd = endOfDay(new Date(d));
        const point: ComparisonPoint = { name: format(dayStart, diff <= 7 ? 'EEE dd/MM' : 'dd/MM', { locale: idLocale }) };
        outlets.forEach(o => {
          const daySales = sales.filter((s: any) =>
            s.outlet_id === o.id && new Date(s.created_at) >= dayStart && new Date(s.created_at) <= dayEnd
          );
          point[o.name] = daySales.reduce((sum: number, s: any) => sum + Number(s.total), 0);
        });
        days.push(point);
      }
      setDailyChart(days);
    } catch (err) {
      console.error('Error fetching outlet comparison:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant, outlets, getRange]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const exportCSV = () => {
    const rows = [
      ['Laporan Perbandingan Outlet', `Periode: ${period}`],
      ['Outlet', 'Total Omzet', 'Transaksi', 'Avg/Trx', 'Total Item', 'Diskon', 'Pelanggan Unik', 'Tunai', 'Non-Tunai'],
      ...outletStats.map(s => [
        s.outletName, s.totalOmzet, s.totalTransaksi, s.avgBasket.toFixed(0),
        s.totalItem, s.totalDiskon, s.uniqueCustomers, s.cashSales, s.nonCashSales,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `laporan-outlet-${format(new Date(), 'yyyyMMdd')}.csv`; a.click();
  };

  const grandTotal = outletStats.reduce((s, o) => s + o.totalOmzet, 0);
  const bestOutlet = outletStats[0];
  const maxOmzet = Math.max(...outletStats.map(o => o.totalOmzet), 1);

  if (!tenant) return (
    <POSLayout><div className="flex items-center justify-center h-64"><AlertCircle className="h-8 w-8 text-muted-foreground" /></div></POSLayout>
  );

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Laporan Perbandingan Outlet</h1>
            <p className="text-muted-foreground text-sm">Bandingkan performa seluruh cabang</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Period Filter */}
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Periode</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {period === 'custom' && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Dari</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-36 h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Sampai</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-36 h-9" />
              </div>
              <Button size="sm" onClick={fetchReport} className="bg-emerald-600 hover:bg-emerald-700">Tampilkan</Button>
            </>
          )}
        </div>

        {/* Best Outlet Banner */}
        {bestOutlet && bestOutlet.totalOmzet > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-center gap-4 flex-wrap">
              <Trophy className="h-8 w-8 text-amber-500 shrink-0" />
              <div>
                <p className="text-xs text-amber-700 font-medium">Outlet Terbaik Periode Ini</p>
                <p className="font-bold text-lg">{bestOutlet.outletName}</p>
                <p className="text-sm text-amber-700">{formatCurrency(bestOutlet.totalOmzet)} dari {bestOutlet.totalTransaksi} transaksi</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-amber-700">Kontribusi</p>
                <p className="font-bold text-2xl text-amber-600">
                  {grandTotal > 0 ? ((bestOutlet.totalOmzet / grandTotal) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Outlet Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {outletStats.map((outlet, idx) => (
            <Card key={outlet.outletId} className={idx === 0 && outlet.totalOmzet > 0 ? 'border-amber-300 border-2' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-base">{outlet.outletName}</CardTitle>
                  </div>
                  {idx === 0 && outlet.totalOmzet > 0 && <Trophy className="h-4 w-4 text-amber-500" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Omzet</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(outlet.totalOmzet)}</span>
                  </div>
                  <Progress value={maxOmzet > 0 ? (outlet.totalOmzet / maxOmzet) * 100 : 0} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right mt-0.5">
                    {grandTotal > 0 ? ((outlet.totalOmzet / grandTotal) * 100).toFixed(1) : 0}% dari total
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-xs text-muted-foreground">Transaksi</p>
                    <p className="font-bold">{outlet.totalTransaksi}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-xs text-muted-foreground">Avg/Trx</p>
                    <p className="font-bold">{formatCurrency(outlet.avgBasket)}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-xs text-muted-foreground">Pelanggan</p>
                    <p className="font-bold">{outlet.uniqueCustomers}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-xs text-muted-foreground">Item Terjual</p>
                    <p className="font-bold">{outlet.totalItem}</p>
                  </div>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tunai:</span>
                    <span>{formatCurrency(outlet.cashSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Non-tunai:</span>
                    <span>{formatCurrency(outlet.nonCashSales)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Grafik Omzet Harian per Outlet</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">Memuat...</div>
              ) : dailyChart.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">Tidak ada data</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyChart} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}jt` : `${(v/1000).toFixed(0)}rb`} />
                    <Tooltip formatter={(val: any) => formatCurrency(val)} />
                    <Legend />
                    {outlets.map((o, idx) => (
                      <Bar key={o.id} dataKey={o.name} fill={COLORS[idx % COLORS.length]}
                        name={o.name} radius={[2, 2, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Tabel Perbandingan Lengkap</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Memuat...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Outlet</TableHead>
                      <TableHead className="text-right">Omzet</TableHead>
                      <TableHead className="text-right">Trx</TableHead>
                      <TableHead className="text-right">Porsi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outletStats.map((o, idx) => (
                      <TableRow key={o.outletId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span className="font-medium text-sm">{o.outletName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 text-sm">{formatCurrency(o.totalOmzet)}</TableCell>
                        <TableCell className="text-right text-sm">{o.totalTransaksi}</TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-gray-100 text-gray-700 border-0 text-xs">
                            {grandTotal > 0 ? ((o.totalOmzet / grandTotal) * 100).toFixed(1) : 0}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 font-bold bg-muted/30">
                      <TableCell>Total Semua Outlet</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatCurrency(grandTotal)}</TableCell>
                      <TableCell className="text-right">{outletStats.reduce((s, o) => s + o.totalTransaksi, 0)}</TableCell>
                      <TableCell className="text-right">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {outlets.length < 2 && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Tambahkan lebih dari satu outlet</p>
              <p className="text-sm">Perbandingan outlet tersedia saat Anda memiliki minimal 2 outlet aktif.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </POSLayout>
  );
}
