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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell
} from 'recharts';
import {
  UserCog, Download, RefreshCw, AlertCircle, Trophy, Clock, TrendingUp
} from 'lucide-react';
import {
  format, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  parseISO, eachHourOfInterval
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface KasirStat {
  kasirName: string;
  kasirId: string | null;
  totalTransaksi: number;
  totalOmzet: number;
  totalDiskon: number;
  avgBasket: number;
  totalItem: number;
}

interface SesiStat {
  sessionNumber: string;
  kasirName: string;
  openingBalance: number;
  closingBalance: number | null;
  difference: number | null;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  openedAt: string;
  closedAt: string | null;
}

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Kustom' },
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function POSLaporanKasirPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [kasirStats, setKasirStats] = useState<KasirStat[]>([]);
  const [sesiStats, setSesiStats] = useState<SesiStat[]>([]);
  const [selectedKasir, setSelectedKasir] = useState<string>('all');
  const [hourlyChart, setHourlyChart] = useState<{ hour: string; transaksi: number; omzet: number }[]>([]);

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
      const [salesRes, sesiRes] = await Promise.all([
        supabase.from('pos_sales' as any)
          .select('id, total, discount_amount, cashier_id, cashier_name, created_at, pos_sale_items(qty)')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id)
          .eq('status', 'completed')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at'),
        supabase.from('pos_cash_sessions' as any)
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id)
          .gte('opened_at', start.toISOString())
          .lte('opened_at', end.toISOString())
          .order('opened_at', { ascending: false }),
      ]);

      const sales = (salesRes.data || []) as any[];
      const sesi = (sesiRes.data || []) as any[];

      const kasirMap: Record<string, KasirStat> = {};
      sales.forEach((s: any) => {
        const key = s.cashier_name || 'Tidak Diketahui';
        if (!kasirMap[key]) {
          kasirMap[key] = {
            kasirName: key, kasirId: s.cashier_id,
            totalTransaksi: 0, totalOmzet: 0, totalDiskon: 0, avgBasket: 0, totalItem: 0,
          };
        }
        kasirMap[key].totalTransaksi++;
        kasirMap[key].totalOmzet += Number(s.total);
        kasirMap[key].totalDiskon += Number(s.discount_amount || 0);
        kasirMap[key].totalItem += (s.pos_sale_items || []).reduce((a: number, i: any) => a + Number(i.qty), 0);
      });

      const kasirList = Object.values(kasirMap).map(k => ({
        ...k,
        avgBasket: k.totalTransaksi > 0 ? k.totalOmzet / k.totalTransaksi : 0,
      })).sort((a, b) => b.totalOmzet - a.totalOmzet);

      setKasirStats(kasirList);
      setSesiStats(sesi.map((s: any) => ({
        sessionNumber: s.session_number,
        kasirName: s.cashier_name,
        openingBalance: Number(s.opening_balance),
        closingBalance: s.closing_balance !== null ? Number(s.closing_balance) : null,
        difference: s.difference !== null ? Number(s.difference) : null,
        cashSales: Number(s.cash_sales_total || 0),
        cashIn: Number(s.cash_in_total || 0),
        cashOut: Number(s.cash_out_total || 0),
        openedAt: s.opened_at,
        closedAt: s.closed_at,
      })));

      const filteredSales = selectedKasir === 'all' ? sales : sales.filter((s: any) => s.cashier_name === selectedKasir);
      const hourMap: Record<number, { transaksi: number; omzet: number }> = {};
      for (let h = 0; h < 24; h++) hourMap[h] = { transaksi: 0, omzet: 0 };
      filteredSales.forEach((s: any) => {
        const h = new Date(s.created_at).getHours();
        hourMap[h].transaksi++;
        hourMap[h].omzet += Number(s.total);
      });
      const operationalHours = Object.entries(hourMap)
        .filter(([_, v]) => v.transaksi > 0 || true)
        .slice(6, 23)
        .map(([h, v]) => ({ hour: `${h}:00`, ...v }));
      setHourlyChart(operationalHours);

    } catch (err) {
      console.error('Error fetching kasir report:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeOutlet, getRange, selectedKasir]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const exportCSV = () => {
    const rows = [
      ['Laporan Per Kasir'],
      ['Kasir', 'Total Transaksi', 'Total Omzet', 'Total Diskon', 'Rata-rata Transaksi', 'Total Item'],
      ...kasirStats.map(k => [k.kasirName, k.totalTransaksi, k.totalOmzet, k.totalDiskon, k.avgBasket.toFixed(0), k.totalItem]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `laporan-kasir-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  const grandTotal = kasirStats.reduce((a, k) => a + k.totalOmzet, 0);
  const bestKasir = kasirStats[0];

  if (!tenant) {
    return <POSLayout><div className="flex items-center justify-center h-64"><AlertCircle className="h-8 w-8 text-muted-foreground" /></div></POSLayout>;
  }

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Laporan Per Kasir</h1>
            <p className="text-muted-foreground text-sm">Performa penjualan per kasir & sesi</p>
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

        {/* Period */}
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

        {/* Best Kasir Banner */}
        {bestKasir && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-center gap-4">
              <Trophy className="h-8 w-8 text-amber-500 shrink-0" />
              <div>
                <p className="text-xs text-amber-700 font-medium">Kasir Terbaik Periode Ini</p>
                <p className="font-bold text-lg">{bestKasir.kasirName}</p>
                <p className="text-sm text-amber-700">{formatCurrency(bestKasir.totalOmzet)} dari {bestKasir.totalTransaksi} transaksi</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-amber-700">Kontribusi</p>
                <p className="font-bold text-xl text-amber-600">
                  {grandTotal > 0 ? ((bestKasir.totalOmzet / grandTotal) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="kasir">
          <TabsList>
            <TabsTrigger value="kasir">Per Kasir</TabsTrigger>
            <TabsTrigger value="hourly">Jam Sibuk</TabsTrigger>
            <TabsTrigger value="sesi">Riwayat Sesi</TabsTrigger>
          </TabsList>

          {/* Per Kasir Tab */}
          <TabsContent value="kasir">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Performa Kasir</CardTitle></CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Memuat...</div>
                  ) : kasirStats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Tidak ada data transaksi</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Kasir</TableHead>
                          <TableHead className="text-right">Transaksi</TableHead>
                          <TableHead className="text-right">Omzet</TableHead>
                          <TableHead className="text-right">Avg/Trx</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {kasirStats.map((k, i) => (
                          <TableRow key={k.kasirName} className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedKasir(selectedKasir === k.kasirName ? 'all' : k.kasirName)}>
                            <TableCell>
                              {i === 0 ? <Trophy className="h-4 w-4 text-amber-500" /> : <span className="text-muted-foreground text-sm">{i + 1}</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <UserCog className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{k.kasirName}</span>
                                {selectedKasir === k.kasirName && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Dipilih</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{k.totalTransaksi}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(k.totalOmzet)}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(k.avgBasket)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Grafik Omzet Per Kasir</CardTitle></CardHeader>
                <CardContent>
                  {loading || kasirStats.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      {loading ? 'Memuat...' : 'Tidak ada data'}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={kasirStats} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : `${(v/1000).toFixed(0)}rb`} />
                        <YAxis type="category" dataKey="kasirName" tick={{ fontSize: 11 }} width={60} />
                        <Tooltip formatter={(val: any) => formatCurrency(val)} />
                        <Bar dataKey="totalOmzet" name="Omzet" radius={[0, 4, 4, 0]}>
                          {kasirStats.map((_, idx) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Detail kasir terpilih */}
              {selectedKasir !== 'all' && kasirStats.find(k => k.kasirName === selectedKasir) && (
                <Card className="lg:col-span-2 border-emerald-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Detail Kasir: {selectedKasir}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const k = kasirStats.find(kk => kk.kasirName === selectedKasir)!;
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Total Transaksi</p>
                            <p className="font-bold text-xl">{k.totalTransaksi}</p>
                          </div>
                          <div className="text-center p-3 bg-emerald-50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Total Omzet</p>
                            <p className="font-bold text-xl text-emerald-600">{formatCurrency(k.totalOmzet)}</p>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Rata-rata / Transaksi</p>
                            <p className="font-bold text-xl">{formatCurrency(k.avgBasket)}</p>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Total Item Terjual</p>
                            <p className="font-bold text-xl">{k.totalItem}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Hourly Tab */}
          <TabsContent value="hourly">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Jam Sibuk Transaksi</CardTitle>
                  <Select value={selectedKasir} onValueChange={setSelectedKasir}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kasir</SelectItem>
                      {kasirStats.map(k => <SelectItem key={k.kasirName} value={k.kasirName}>{k.kasirName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">Memuat...</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hourlyChart} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : `${(v/1000).toFixed(0)}rb`} />
                      <Tooltip formatter={(val: any, name: any) => name === 'Transaksi' ? val : formatCurrency(val)} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="transaksi" fill="#10b981" name="Transaksi" radius={[2, 2, 0, 0]} />
                      <Bar yAxisId="right" dataKey="omzet" fill="#3b82f6" name="Omzet" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sesi Tab */}
          <TabsContent value="sesi">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Riwayat Sesi Kasir</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Memuat...</div>
                ) : sesiStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Tidak ada sesi kasir pada periode ini</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sesi</TableHead>
                        <TableHead>Kasir</TableHead>
                        <TableHead>Dibuka</TableHead>
                        <TableHead>Ditutup</TableHead>
                        <TableHead className="text-right">Saldo Awal</TableHead>
                        <TableHead className="text-right">Saldo Akhir</TableHead>
                        <TableHead className="text-right">Selisih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sesiStats.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{s.sessionNumber}</TableCell>
                          <TableCell>{s.kasirName}</TableCell>
                          <TableCell className="text-xs">{format(new Date(s.openedAt), 'dd/MM HH:mm', { locale: idLocale })}</TableCell>
                          <TableCell className="text-xs">
                            {s.closedAt ? format(new Date(s.closedAt), 'dd/MM HH:mm', { locale: idLocale }) : (
                              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Aktif</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(s.openingBalance)}</TableCell>
                          <TableCell className="text-right">{s.closingBalance !== null ? formatCurrency(s.closingBalance) : '-'}</TableCell>
                          <TableCell className={`text-right font-bold ${(s.difference || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {s.difference !== null ? (
                              <>{(s.difference || 0) >= 0 ? '+' : ''}{formatCurrency(s.difference || 0)}</>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </POSLayout>
  );
}
