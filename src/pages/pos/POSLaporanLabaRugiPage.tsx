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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, LineChart, Line, ReferenceLine
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Download, Printer,
  DollarSign, ShoppingCart, Package, AlertCircle, RefreshCw, FileDown
} from 'lucide-react';
import {
  format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval,
  parseISO, eachMonthOfInterval
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface PLData {
  omzet: number;
  hpp: number;
  labaKotor: number;
  bebanOperasional: number;
  labaBersih: number;
  totalDiskon: number;
  totalRetur: number;
  jumlahTransaksi: number;
  chartData: { label: string; omzet: number; hpp: number; laba: number }[];
  topProducts: { name: string; qty: number; revenue: number; hpp: number; profit: number }[];
  biayaRincian: { category: string; amount: number }[];
}

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Kustom' },
];

const BIAYA_LABELS: Record<string, string> = {
  operational: 'Biaya Operasional',
  gaji: 'Gaji / Upah',
  purchase: 'Pembelian Barang',
  hutang_bayar: 'Bayar Hutang',
  lain_keluar: 'Lain-lain',
  other: 'Lain-lain',
};

export default function POSLaporanLabaRugiPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PLData>({
    omzet: 0, hpp: 0, labaKotor: 0, bebanOperasional: 0, labaBersih: 0,
    totalDiskon: 0, totalRetur: 0, jumlahTransaksi: 0,
    chartData: [], topProducts: [], biayaRincian: [],
  });

  const getRange = useCallback(() => {
    const now = new Date();
    if (period === 'today') return { start: startOfDay(now), end: endOfDay(now) };
    if (period === 'week') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) };
    if (period === 'year') return { start: startOfYear(now), end: endOfYear(now) };
    return { start: startOfDay(parseISO(customStart)), end: endOfDay(parseISO(customEnd)) };
  }, [period, customStart, customEnd]);

  const fetchReport = useCallback(async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    const { start, end } = getRange();

    try {
      const [salesRes, returRes, mutRes] = await Promise.all([
        supabase.from('pos_sales' as any)
          .select('id, total, discount_amount, created_at, pos_sale_items(qty, price, subtotal, cost_price)')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id)
          .eq('status', 'completed')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at'),
        supabase.from('pos_sale_returns' as any)
          .select('total_refund')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString()),
        supabase.from('pos_cash_mutations' as any)
          .select('type, category, amount')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id)
          .eq('type', 'out')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString()),
      ]);

      const sales = (salesRes.data || []) as any[];
      const returns = (returRes.data || []) as any[];
      const mutations = (mutRes.data || []) as any[];

      const omzet = sales.reduce((s: number, r: any) => s + Number(r.total), 0);
      const totalDiskon = sales.reduce((s: number, r: any) => s + Number(r.discount_amount || 0), 0);
      const totalRetur = returns.reduce((s: number, r: any) => s + Number(r.total_refund), 0);

      let hpp = 0;
      const productMap: Record<string, any> = {};
      sales.forEach((sale: any) => {
        (sale.pos_sale_items || []).forEach((item: any) => {
          const cp = Number(item.cost_price || 0);
          const qty = Number(item.qty || 0);
          const subtotal = Number(item.subtotal || 0);
          hpp += cp * qty;

          const key = (item as any).product_name || 'Produk Tidak Diketahui';
          if (!productMap[key]) productMap[key] = { name: key, qty: 0, revenue: 0, hpp: 0 };
          productMap[key].qty += qty;
          productMap[key].revenue += subtotal;
          productMap[key].hpp += cp * qty;
        });
      });

      const labaKotor = omzet - hpp - totalRetur;
      const bebanOperasional = mutations.reduce((s: number, m: any) => s + Number(m.amount), 0);
      const labaBersih = labaKotor - bebanOperasional;

      const biayaMap: Record<string, number> = {};
      mutations.forEach((m: any) => {
        const cat = m.category || 'other';
        biayaMap[cat] = (biayaMap[cat] || 0) + Number(m.amount);
      });
      const biayaRincian = Object.entries(biayaMap).map(([category, amount]) => ({ category, amount }));

      const topProducts = Object.values(productMap)
        .map((p: any) => ({ ...p, profit: p.revenue - p.hpp }))
        .sort((a: any, b: any) => b.profit - a.profit)
        .slice(0, 10);

      const isYear = period === 'year';
      const chartDays = isYear
        ? eachMonthOfInterval({ start, end })
        : eachDayOfInterval({ start, end }).filter((_, i, arr) => arr.length <= 31 || i % Math.ceil(arr.length / 30) === 0);

      const chartData = chartDays.map(day => {
        const dayStart = isYear ? startOfMonth(day) : startOfDay(day);
        const dayEnd = isYear ? endOfMonth(day) : endOfDay(day);
        const daySales = sales.filter((s: any) => {
          const d = new Date(s.created_at);
          return d >= dayStart && d <= dayEnd;
        });
        const dayOmzet = daySales.reduce((s: number, r: any) => s + Number(r.total), 0);
        const dayHpp = daySales.reduce((s: number, r: any) =>
          s + (r.pos_sale_items || []).reduce((ss: number, i: any) => ss + Number(i.cost_price || 0) * Number(i.qty || 0), 0), 0);
        return {
          label: isYear ? format(day, 'MMM', { locale: idLocale }) : format(day, 'dd/MM'),
          omzet: dayOmzet,
          hpp: dayHpp,
          laba: dayOmzet - dayHpp,
        };
      });

      setData({ omzet, hpp, labaKotor, bebanOperasional, labaBersih, totalDiskon, totalRetur, jumlahTransaksi: sales.length, chartData, topProducts, biayaRincian });
    } catch (err) {
      console.error('Error fetching P&L:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeOutlet, getRange, period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const printReport = () => window.print();

  const exportPDF = () => {
    const storeName = (tenant as any)?.name || 'Toko';
    const outletName = activeOutlet ? (activeOutlet as any).name : '';
    const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || period;
    const now = format(new Date(), 'dd MMMM yyyy HH:mm', { locale: idLocale });
    const fc = (n: number) => `Rp ${Math.abs(n).toLocaleString('id-ID')}`;

    const biayaRows = data.biayaRincian.map(b =>
      `<tr><td style="padding:3px 8px;color:#666">${BIAYA_LABELS[b.category] || b.category}</td><td style="text-align:right;color:#ef4444">(${fc(b.amount)})</td></tr>`
    ).join('');

    const topProdRows = data.topProducts.slice(0, 10).map((p, i) =>
      `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:4px 8px">${p.name}</td>
        <td style="text-align:right;padding:4px 8px">${p.qty}</td>
        <td style="text-align:right;padding:4px 8px">${fc(p.revenue)}</td>
        <td style="text-align:right;padding:4px 8px">${fc(p.hpp)}</td>
        <td style="text-align:right;padding:4px 8px;color:${p.profit >= 0 ? '#059669' : '#ef4444'}">${p.profit >= 0 ? '' : '('}${fc(p.profit)}${p.profit < 0 ? ')' : ''}</td>
      </tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Laporan Laba Rugi — ${storeName}</title>
    <style>
      @page { size: A4; margin: 15mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 2px; }
      h2 { font-size: 13px; color: #374151; border-bottom: 2px solid #10b981; padding-bottom: 4px; margin: 16px 0 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      th { background: #10b981; color: white; padding: 6px 8px; text-align: left; font-size: 11px; }
      .val { text-align: right; }
      .positive { color: #059669; font-weight: bold; }
      .negative { color: #ef4444; }
      .total-row td { font-weight: bold; border-top: 2px solid #111; padding-top: 6px; font-size: 13px; }
      .section-row td { font-weight: bold; background: #f0fdf4; padding: 5px 8px; color: #065f46; }
      .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
      .kpi-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; text-align: center; }
      .kpi-label { font-size: 10px; color: #6b7280; margin-bottom: 4px; }
      .kpi-value { font-size: 16px; font-weight: bold; }
      @media print { button { display: none; } }
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div>
        <h1>Laporan Laba Rugi</h1>
        <div style="color:#6b7280;font-size:11px">${storeName}${outletName ? ` — ${outletName}` : ''}</div>
        <div style="color:#6b7280;font-size:11px">Periode: ${periodLabel} &nbsp;|&nbsp; Dicetak: ${now}</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Omzet Penjualan</div><div class="kpi-value" style="color:#059669">${fc(data.omzet)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Laba Kotor</div><div class="kpi-value" style="color:#0891b2">${fc(data.labaKotor)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Laba Bersih</div><div class="kpi-value" style="color:${data.labaBersih >= 0 ? '#059669' : '#ef4444'}">${data.labaBersih < 0 ? '(' : ''}${fc(data.labaBersih)}${data.labaBersih < 0 ? ')' : ''}</div></div>
      <div class="kpi-card"><div class="kpi-label">HPP</div><div class="kpi-value" style="color:#dc2626">${fc(data.hpp)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Diskon</div><div class="kpi-value" style="color:#d97706">${fc(data.totalDiskon)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Jumlah Transaksi</div><div class="kpi-value">${data.jumlahTransaksi.toLocaleString('id-ID')}</div></div>
    </div>

    <h2>Laporan Laba Rugi</h2>
    <table>
      <tbody>
        <tr class="section-row"><td>PENDAPATAN</td><td></td></tr>
        <tr><td style="padding:3px 8px">Omzet Penjualan</td><td style="text-align:right" class="positive">${fc(data.omzet)}</td></tr>
        ${data.totalDiskon > 0 ? `<tr><td style="padding:3px 8px;color:#666">Total Diskon</td><td style="text-align:right;color:#ef4444">(${fc(data.totalDiskon)})</td></tr>` : ''}
        ${data.totalRetur > 0 ? `<tr><td style="padding:3px 8px;color:#666">Total Retur</td><td style="text-align:right;color:#ef4444">(${fc(data.totalRetur)})</td></tr>` : ''}
        <tr><td style="padding:3px 8px;color:#666">HPP (Harga Pokok Penjualan)</td><td style="text-align:right;color:#ef4444">(${fc(data.hpp)})</td></tr>
        <tr style="font-weight:bold;background:#f0fdf4"><td style="padding:5px 8px">LABA KOTOR</td><td style="text-align:right;padding:5px 8px;color:#0891b2">${fc(data.labaKotor)}</td></tr>

        <tr class="section-row"><td style="padding-top:8px">BEBAN OPERASIONAL</td><td></td></tr>
        ${biayaRows}
        <tr style="font-weight:bold"><td style="padding:3px 8px">Total Beban</td><td style="text-align:right;color:#ef4444">(${fc(data.bebanOperasional)})</td></tr>

        <tr class="total-row"><td style="padding:6px 8px">LABA BERSIH</td><td style="text-align:right;padding:6px 8px;color:${data.labaBersih >= 0 ? '#059669' : '#ef4444'}">${data.labaBersih < 0 ? '(' : ''}${fc(data.labaBersih)}${data.labaBersih < 0 ? ')' : ''}</td></tr>
      </tbody>
    </table>

    ${data.topProducts.length > 0 ? `
    <h2>Produk Terlaris (Top 10)</h2>
    <table>
      <thead><tr>
        <th>Produk</th><th style="text-align:right">Qty</th><th style="text-align:right">Omzet</th><th style="text-align:right">HPP</th><th style="text-align:right">Laba</th>
      </tr></thead>
      <tbody>${topProdRows}</tbody>
    </table>` : ''}
    </body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const exportCSV = () => {
    const rows = [
      ['Laporan Laba Rugi', format(new Date(), 'dd/MM/yyyy HH:mm')],
      [],
      ['PENDAPATAN', ''],
      ['Omzet Penjualan', data.omzet],
      ['Total Diskon', -data.totalDiskon],
      ['Total Retur', -data.totalRetur],
      ['HPP (Harga Pokok Penjualan)', -data.hpp],
      ['LABA KOTOR', data.labaKotor],
      [],
      ['BEBAN OPERASIONAL', ''],
      ...data.biayaRincian.map(b => [BIAYA_LABELS[b.category] || b.category, -b.amount]),
      ['Total Beban', -data.bebanOperasional],
      [],
      ['LABA BERSIH', data.labaBersih],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `laporan-laba-rugi-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  const profitMargin = data.omzet > 0 ? (data.labaBersih / data.omzet) * 100 : 0;
  const grossMargin = data.omzet > 0 ? (data.labaKotor / data.omzet) * 100 : 0;

  const PLRow = ({ label, value, bold, indent, positive, negative, separator }: {
    label: string; value?: number; bold?: boolean; indent?: boolean;
    positive?: boolean; negative?: boolean; separator?: boolean;
  }) => (
    <>
      {separator && <TableRow><TableCell colSpan={3}><Separator /></TableCell></TableRow>}
      <TableRow className={bold ? 'bg-muted/40 font-bold' : ''}>
        <TableCell className={indent ? 'pl-8 text-muted-foreground' : bold ? 'font-bold' : ''}>
          {label}
        </TableCell>
        <TableCell />
        <TableCell className={`text-right font-mono ${
          positive ? 'text-emerald-600' : negative ? 'text-red-500' : bold ? 'font-bold' : ''
        }`}>
          {value !== undefined ? (
            <span className={value < 0 ? 'text-red-500' : value > 0 && bold ? 'text-emerald-600' : ''}>
              {value < 0 ? `(${formatCurrency(-value)})` : formatCurrency(value)}
            </span>
          ) : ''}
        </TableCell>
      </TableRow>
    </>
  );

  if (!tenant) {
    return <POSLayout><div className="flex items-center justify-center h-64"><AlertCircle className="h-8 w-8 text-muted-foreground" /></div></POSLayout>;
  }

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Laporan Laba Rugi</h1>
            <p className="text-muted-foreground text-sm">Analisis profitabilitas usaha Anda</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} className="border-blue-400 text-blue-600 hover:bg-blue-50">
              <FileDown className="h-4 w-4 mr-1" /> Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={printReport}>
              <Printer className="h-4 w-4 mr-1" /> Cetak
            </Button>
          </div>
        </div>

        {/* Period Selector */}
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-muted-foreground">Omzet</span>
              </div>
              <p className="font-bold text-xl text-emerald-600">{formatCurrency(data.omzet)}</p>
              <p className="text-xs text-muted-foreground mt-1">{data.jumlahTransaksi} transaksi</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">HPP</span>
              </div>
              <p className="font-bold text-xl">{formatCurrency(data.hpp)}</p>
              <p className="text-xs text-muted-foreground mt-1">Gross margin: {grossMargin.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className={data.labaKotor >= 0 ? 'border-blue-200' : 'border-red-200'}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                {data.labaKotor >= 0 ? <TrendingUp className="h-4 w-4 text-blue-600" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                <span className="text-xs text-muted-foreground">Laba Kotor</span>
              </div>
              <p className={`font-bold text-xl ${data.labaKotor >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                {formatCurrency(data.labaKotor)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Setelah HPP & retur</p>
            </CardContent>
          </Card>
          <Card className={data.labaBersih >= 0 ? 'border-emerald-300 bg-emerald-50' : 'border-red-200 bg-red-50'}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                {data.labaBersih >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                <span className="text-xs text-muted-foreground">Laba Bersih</span>
              </div>
              <p className={`font-bold text-xl ${data.labaBersih >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatCurrency(data.labaBersih)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Margin: {profitMargin.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* P&L Statement */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Laporan Laba Rugi</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Memuat...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keterangan</TableHead>
                      <TableHead />
                      <TableHead className="text-right">Jumlah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell className="font-semibold text-emerald-700 py-1" colSpan={3}>PENDAPATAN</TableCell></TableRow>
                    <PLRow label="Omzet Penjualan" value={data.omzet} positive />
                    <PLRow label="Total Diskon Diberikan" value={-data.totalDiskon} indent />
                    <PLRow label="Total Retur Penjualan" value={-data.totalRetur} indent />
                    <PLRow label="HPP (Harga Pokok Penjualan)" value={-data.hpp} indent negative />
                    <PLRow label="LABA KOTOR" value={data.labaKotor} bold separator />

                    {data.biayaRincian.length > 0 && (
                      <>
                        <TableRow><TableCell className="font-semibold text-red-600 py-1 pt-3" colSpan={3}>BEBAN OPERASIONAL</TableCell></TableRow>
                        {data.biayaRincian.map(b => (
                          <PLRow key={b.category} label={BIAYA_LABELS[b.category] || b.category} value={-b.amount} indent negative />
                        ))}
                        <PLRow label="Total Beban Operasional" value={-data.bebanOperasional} bold separator />
                      </>
                    )}

                    <PLRow
                      label={data.labaBersih >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}
                      value={data.labaBersih}
                      bold separator
                    />
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Grafik Omzet vs HPP vs Laba</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">Memuat...</div>
              ) : data.chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">Tidak ada data</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : v >= 1000 ? `${(v/1000).toFixed(0)}rb` : v} />
                    <Tooltip formatter={(val: any) => formatCurrency(val)} />
                    <Legend />
                    <Bar dataKey="omzet" fill="#10b981" name="Omzet" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="hpp" fill="#f59e0b" name="HPP" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="laba" fill="#3b82f6" name="Laba Kotor" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Produk Berdasar Profit */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Produk berdasar Laba</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat...</div>
            ) : data.topProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Tidak ada data produk</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Qty Terjual</TableHead>
                    <TableHead className="text-right">Omzet</TableHead>
                    <TableHead className="text-right">HPP</TableHead>
                    <TableHead className="text-right">Laba</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProducts.map((p, i) => {
                    const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : '0.0';
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                        <TableCell className="text-right text-orange-600">{formatCurrency(p.hpp)}</TableCell>
                        <TableCell className={`text-right font-bold ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {formatCurrency(p.profit)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={`text-xs border-0 ${Number(margin) >= 30 ? 'bg-emerald-100 text-emerald-700' : Number(margin) >= 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {margin}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </POSLayout>
  );
}
