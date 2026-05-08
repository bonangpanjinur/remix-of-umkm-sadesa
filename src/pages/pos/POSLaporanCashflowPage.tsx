import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, ArrowUpCircle, ArrowDownCircle,
  Download, RefreshCw, DollarSign, Wallet, AlertCircle
} from 'lucide-react';
import {
  format, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, eachMonthOfInterval, parseISO, subMonths
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface CashflowData {
  totalMasuk: number;
  totalKeluar: number;
  netCashflow: number;
  saldoAwal: number;
  saldoAkhir: number;
  rincianMasuk: { category: string; label: string; amount: number }[];
  rincianKeluar: { category: string; label: string; amount: number }[];
  chartData: { label: string; masuk: number; keluar: number; net: number }[];
}

const PERIOD_OPTIONS = [
  { value: 'month', label: 'Bulan Ini' },
  { value: 'last_month', label: 'Bulan Lalu' },
  { value: 'quarter', label: '3 Bulan Terakhir' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Kustom' },
];

const INCOME_LABELS: Record<string, string> = {
  sales_cash: 'Penjualan Tunai',
  sales_qris: 'Penjualan QRIS',
  sales_transfer: 'Penjualan Transfer',
  sales_debit: 'Penjualan Debit',
  modal: 'Modal / Setoran',
  hutang_diterima: 'Pembayaran Piutang',
  lain_masuk: 'Pemasukan Lain-lain',
};

const EXPENSE_LABELS: Record<string, string> = {
  purchase: 'Pembelian Barang',
  operational: 'Biaya Operasional',
  gaji: 'Gaji / Upah',
  hutang_bayar: 'Bayar Hutang',
  lain_keluar: 'Pengeluaran Lain-lain',
};

const CustomTooltip = ({ active, payload, label, formatCurrency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function POSLaporanCashflowPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CashflowData>({
    totalMasuk: 0, totalKeluar: 0, netCashflow: 0, saldoAwal: 0, saldoAkhir: 0,
    rincianMasuk: [], rincianKeluar: [], chartData: [],
  });

  const getRange = useCallback(() => {
    const now = new Date();
    if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) };
    if (period === 'last_month') {
      const last = subMonths(now, 1);
      return { start: startOfMonth(last), end: endOfMonth(last) };
    }
    if (period === 'quarter') return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    if (period === 'year') return { start: startOfYear(now), end: endOfYear(now) };
    return { start: startOfDay(parseISO(customStart)), end: endOfDay(parseISO(customEnd)) };
  }, [period, customStart, customEnd]);

  const fetchReport = useCallback(async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    const { start, end } = getRange();

    try {
      // Fetch sales (cash inflow by payment method)
      const { data: sales } = await supabase
        .from('pos_sales' as any)
        .select('total, payment_method, created_at')
        .eq('tenant_id', tenant.id)
        .eq('outlet_id', activeOutlet.id)
        .eq('status', 'completed')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at');

      // Fetch cash mutations (all in/out)
      const { data: mutations } = await supabase
        .from('pos_cash_mutations' as any)
        .select('type, category, amount, description, created_at')
        .eq('tenant_id', tenant.id)
        .eq('outlet_id', activeOutlet.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at');

      // Fetch purchases (cash outflow)
      const { data: purchases } = await supabase
        .from('pos_purchase_orders' as any)
        .select('total_amount, status, created_at')
        .eq('tenant_id', tenant.id)
        .eq('outlet_id', activeOutlet.id)
        .in('status', ['received', 'completed'])
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at');

      const salesArr = (sales || []) as any[];
      const mutArr = (mutations || []) as any[];
      const purchArr = (purchases || []) as any[];

      // Build income breakdown by payment method
      const incomeByCat: Record<string, number> = {};
      salesArr.forEach((s: any) => {
        const key = `sales_${s.payment_method}`;
        incomeByCat[key] = (incomeByCat[key] || 0) + Number(s.total);
      });
      // Add cash mutations type=in
      mutArr.filter((m: any) => m.type === 'in').forEach((m: any) => {
        const key = m.category || 'lain_masuk';
        // skip sales_cash from mutations (already counted from sales)
        if (key !== 'sales_cash') {
          incomeByCat[key] = (incomeByCat[key] || 0) + Number(m.amount);
        }
      });

      // Build expense breakdown
      const expenseByCat: Record<string, number> = {};
      mutArr.filter((m: any) => m.type === 'out').forEach((m: any) => {
        const key = m.category || 'lain_keluar';
        expenseByCat[key] = (expenseByCat[key] || 0) + Number(m.amount);
      });
      purchArr.forEach((p: any) => {
        expenseByCat['purchase'] = (expenseByCat['purchase'] || 0) + Number(p.total_amount);
      });

      const totalMasuk = Object.values(incomeByCat).reduce((s, v) => s + v, 0);
      const totalKeluar = Object.values(expenseByCat).reduce((s, v) => s + v, 0);
      const netCashflow = totalMasuk - totalKeluar;

      const rincianMasuk = Object.entries(incomeByCat).map(([cat, amt]) => ({
        category: cat,
        label: INCOME_LABELS[cat] || cat,
        amount: amt,
      })).sort((a, b) => b.amount - a.amount);

      const rincianKeluar = Object.entries(expenseByCat).map(([cat, amt]) => ({
        category: cat,
        label: EXPENSE_LABELS[cat] || cat,
        amount: amt,
      })).sort((a, b) => b.amount - a.amount);

      // Build chart data per day (if <=31 days) or per month
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      let chartData: CashflowData['chartData'] = [];

      if (diffDays <= 31) {
        const days = eachDayOfInterval({ start, end });
        chartData = days.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayLabel = format(day, 'dd/MM', { locale: idLocale });
          const masuk = salesArr
            .filter((s: any) => format(new Date(s.created_at), 'yyyy-MM-dd') === dayStr)
            .reduce((sum: number, s: any) => sum + Number(s.total), 0)
            + mutArr.filter((m: any) => m.type === 'in' && m.category !== 'sales_cash' && format(new Date(m.created_at), 'yyyy-MM-dd') === dayStr)
              .reduce((sum: number, m: any) => sum + Number(m.amount), 0);
          const keluar = mutArr.filter((m: any) => m.type === 'out' && format(new Date(m.created_at), 'yyyy-MM-dd') === dayStr)
            .reduce((sum: number, m: any) => sum + Number(m.amount), 0)
            + purchArr.filter((p: any) => format(new Date(p.created_at), 'yyyy-MM-dd') === dayStr)
              .reduce((sum: number, p: any) => sum + Number(p.total_amount), 0);
          return { label: dayLabel, masuk, keluar, net: masuk - keluar };
        });
      } else {
        const months = eachMonthOfInterval({ start, end });
        chartData = months.map(month => {
          const mStart = startOfMonth(month);
          const mEnd = endOfMonth(month);
          const label = format(month, 'MMM yy', { locale: idLocale });
          const masuk = salesArr
            .filter((s: any) => { const d = new Date(s.created_at); return d >= mStart && d <= mEnd; })
            .reduce((sum: number, s: any) => sum + Number(s.total), 0)
            + mutArr.filter((m: any) => { const d = new Date(m.created_at); return m.type === 'in' && m.category !== 'sales_cash' && d >= mStart && d <= mEnd; })
              .reduce((sum: number, m: any) => sum + Number(m.amount), 0);
          const keluar = mutArr.filter((m: any) => { const d = new Date(m.created_at); return m.type === 'out' && d >= mStart && d <= mEnd; })
            .reduce((sum: number, m: any) => sum + Number(m.amount), 0)
            + purchArr.filter((p: any) => { const d = new Date(p.created_at); return d >= mStart && d <= mEnd; })
              .reduce((sum: number, p: any) => sum + Number(p.total_amount), 0);
          return { label, masuk, keluar, net: masuk - keluar };
        });
      }

      setData({
        totalMasuk, totalKeluar, netCashflow,
        saldoAwal: 0, saldoAkhir: netCashflow,
        rincianMasuk, rincianKeluar, chartData,
      });
    } catch (err) {
      console.error('Error fetching cashflow:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeOutlet, getRange]);

  useEffect(() => {
    if (tenant && activeOutlet) fetchReport();
  }, [tenant, activeOutlet, fetchReport]);

  const netPositive = data.netCashflow >= 0;

  const handleExport = () => {
    const rows = [
      ['Laporan Cashflow', ''],
      ['Periode', period],
      ['', ''],
      ['KAS MASUK', ''],
      ...data.rincianMasuk.map(r => [r.label, r.amount.toString()]),
      ['TOTAL KAS MASUK', data.totalMasuk.toString()],
      ['', ''],
      ['KAS KELUAR', ''],
      ...data.rincianKeluar.map(r => [r.label, r.amount.toString()]),
      ['TOTAL KAS KELUAR', data.totalKeluar.toString()],
      ['', ''],
      ['NET CASHFLOW', data.netCashflow.toString()],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-${period}-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <POSLayout
      title="Laporan Cashflow"
      subtitle="Arus kas masuk dan keluar usaha"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Period filter */}
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <Label className="text-xs text-muted-foreground">Periode</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 w-44 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {period === 'custom' && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Dari</Label>
                <Input type="date" className="h-9 mt-1" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Sampai</Label>
                <Input type="date" className="h-9 mt-1" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={fetchReport}>Terapkan</Button>
            </>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* KPI Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="border-0 shadow-sm bg-emerald-50 dark:bg-emerald-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium">Total Kas Masuk</p>
                    <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(data.totalMasuk)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{data.rincianMasuk.length} sumber pemasukan</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-red-50 dark:bg-red-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium">Total Kas Keluar</p>
                    <ArrowDownCircle className="h-4 w-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(data.totalKeluar)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{data.rincianKeluar.length} jenis pengeluaran</p>
                </CardContent>
              </Card>

              <Card className={`border-0 shadow-sm ${netPositive ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-orange-50 dark:bg-orange-950/30'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium">Net Cashflow</p>
                    {netPositive
                      ? <TrendingUp className="h-4 w-4 text-blue-600" />
                      : <TrendingDown className="h-4 w-4 text-orange-500" />
                    }
                  </div>
                  <p className={`text-2xl font-bold ${netPositive ? 'text-blue-700' : 'text-orange-600'}`}>
                    {netPositive ? '+' : ''}{formatCurrency(data.netCashflow)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {netPositive
                      ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Surplus</Badge>
                      : <Badge className="bg-red-100 text-red-700 border-0 text-xs">Defisit</Badge>
                    }
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alert jika defisit */}
            {!netPositive && (
              <Card className="border border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-orange-800 dark:text-orange-300">
                    Kas keluar melebihi kas masuk periode ini. Tinjau pengeluaran dan pastikan pemasukan mencukupi operasional.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Chart arus kas */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Grafik Arus Kas</CardTitle>
              </CardHeader>
              <CardContent>
                {data.chartData.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                    Tidak ada data untuk periode ini
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.chartData} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}jt` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}rb` : v} />
                      <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine y={0} stroke="#6b7280" />
                      <Bar dataKey="masuk" name="Kas Masuk" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="keluar" name="Kas Keluar" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Net cashflow trend */}
            {data.chartData.length > 1 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tren Net Cashflow</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={data.chartData}>
                      <defs>
                        <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}jt` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}rb` : String(v)} />
                      <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                      <Area dataKey="net" name="Net Cashflow" stroke="#3b82f6" fill="url(#netGrad)" strokeWidth={2} dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Rincian side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kas Masuk */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                    Rincian Kas Masuk
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.rincianMasuk.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada data</p>
                  ) : (
                    data.rincianMasuk.map(item => {
                      const pct = data.totalMasuk > 0 ? (item.amount / data.totalMasuk) * 100 : 0;
                      return (
                        <div key={item.category}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium text-emerald-700">{formatCurrency(item.amount)}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 text-right">{pct.toFixed(1)}%</p>
                        </div>
                      );
                    })
                  )}
                  {data.rincianMasuk.length > 0 && (
                    <div className="pt-2 border-t flex justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span className="text-emerald-700">{formatCurrency(data.totalMasuk)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Kas Keluar */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ArrowDownCircle className="h-4 w-4 text-red-500" />
                    Rincian Kas Keluar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.rincianKeluar.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada data</p>
                  ) : (
                    data.rincianKeluar.map(item => {
                      const pct = data.totalKeluar > 0 ? (item.amount / data.totalKeluar) * 100 : 0;
                      return (
                        <div key={item.category}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium text-red-600">{formatCurrency(item.amount)}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className="bg-red-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 text-right">{pct.toFixed(1)}%</p>
                        </div>
                      );
                    })
                  )}
                  {data.rincianKeluar.length > 0 && (
                    <div className="pt-2 border-t flex justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span className="text-red-600">{formatCurrency(data.totalKeluar)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Summary box */}
            <Card className={`border-2 ${netPositive ? 'border-emerald-200 bg-emerald-50/50' : 'border-orange-200 bg-orange-50/50'} shadow-sm`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold">Ringkasan Cashflow</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Kas Masuk</span>
                    <span className="font-medium text-emerald-700">+ {formatCurrency(data.totalMasuk)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Kas Keluar</span>
                    <span className="font-medium text-red-600">- {formatCurrency(data.totalKeluar)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold text-base">
                    <span>Net Cashflow</span>
                    <span className={netPositive ? 'text-blue-700' : 'text-orange-600'}>
                      {netPositive ? '+' : ''}{formatCurrency(data.netCashflow)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </POSLayout>
  );
}
