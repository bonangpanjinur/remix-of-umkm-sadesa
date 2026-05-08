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
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import {
  Users, Download, RefreshCw, AlertCircle, Crown, Star, UserCheck,
  TrendingUp, ShoppingCart, Calendar, Repeat
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, subMonths, parseISO,
  startOfDay, endOfDay, differenceInDays
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface CustomerStat {
  customerId: string | null;
  customerName: string;
  phone: string;
  totalBelanja: number;
  jumlahTransaksi: number;
  avgTransaksi: number;
  lastVisit: string;
  firstVisit: string;
  daysSinceLastVisit: number;
  frequency: number;
  rfmScore: string;
  rfmLabel: string;
}

interface MonthlyCustomer {
  month: string;
  newCustomers: number;
  returningCustomers: number;
  total: number;
}

const RFM_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  champions: { label: 'Champions', color: 'bg-emerald-100 text-emerald-800', desc: 'Beli sering, nilai tinggi, baru saja beli' },
  loyal: { label: 'Pelanggan Setia', color: 'bg-blue-100 text-blue-800', desc: 'Beli rutin dengan nilai yang baik' },
  potential: { label: 'Potensi Loyal', color: 'bg-teal-100 text-teal-800', desc: 'Baru mulai beli sering' },
  new: { label: 'Pelanggan Baru', color: 'bg-indigo-100 text-indigo-800', desc: 'Baru pertama belanja' },
  at_risk: { label: 'Perlu Perhatian', color: 'bg-yellow-100 text-yellow-800', desc: 'Dulu sering, sekarang jarang' },
  lost: { label: 'Hilang', color: 'bg-red-100 text-red-800', desc: 'Sudah lama tidak belanja' },
  others: { label: 'Lainnya', color: 'bg-gray-100 text-gray-700', desc: 'Pelanggan umum' },
};

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

function classifyRFM(daysSince: number, frequency: number, totalBelanja: number, avgAll: number): string {
  const isRecent = daysSince <= 30;
  const isFrequent = frequency >= 3;
  const isHighValue = totalBelanja >= avgAll;

  if (isRecent && isFrequent && isHighValue) return 'champions';
  if (isFrequent && isHighValue) return 'loyal';
  if (isRecent && isFrequent) return 'potential';
  if (isRecent && frequency === 1) return 'new';
  if (!isRecent && isFrequent) return 'at_risk';
  if (daysSince > 90) return 'lost';
  return 'others';
}

export default function POSAnalitikPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [months, setMonths] = useState('6');
  const [loading, setLoading] = useState(true);
  const [customerStats, setCustomerStats] = useState<CustomerStat[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyCustomer[]>([]);
  const [rfmDist, setRfmDist] = useState<{ name: string; value: number; color: string }[]>([]);
  const [paymentDist, setPaymentDist] = useState<{ method: string; count: number; total: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);

  const fetchReport = useCallback(async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    const endDate = new Date();
    const startDate = subMonths(endDate, Number(months));

    try {
      const [salesRes, prodRes] = await Promise.all([
        supabase.from('pos_sales' as any)
          .select('id, total, payment_method, customer_id, customer_name, created_at')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id)
          .eq('status', 'completed')
          .gte('created_at', startDate.toISOString())
          .order('created_at'),
        supabase.from('pos_sale_items' as any)
          .select('product_name, qty, subtotal, pos_sales(created_at, outlet_id, status, tenant_id)')
          .eq('pos_sales.tenant_id' as any, tenant.id)
          .eq('pos_sales.outlet_id' as any, activeOutlet.id)
          .eq('pos_sales.status' as any, 'completed')
          .gte('pos_sales.created_at' as any, startDate.toISOString())
          .limit(2000),
      ]);

      const sales = (salesRes.data || []) as any[];

      // Customer stats
      const custMap: Record<string, any> = {};
      const knownCustomers = new Set<string>();
      sales.forEach((s: any) => {
        const key = s.customer_id || s.customer_name || 'walk-in';
        const name = s.customer_name || 'Pelanggan Umum';
        if (!custMap[key]) {
          custMap[key] = {
            customerId: s.customer_id, customerName: name, phone: '',
            totalBelanja: 0, jumlahTransaksi: 0, firstVisit: s.created_at, lastVisit: s.created_at,
          };
        }
        custMap[key].totalBelanja += Number(s.total);
        custMap[key].jumlahTransaksi++;
        if (new Date(s.created_at) > new Date(custMap[key].lastVisit)) custMap[key].lastVisit = s.created_at;
        if (new Date(s.created_at) < new Date(custMap[key].firstVisit)) custMap[key].firstVisit = s.created_at;
        if (s.customer_id) knownCustomers.add(s.customer_id);
      });

      const avgBelanja = Object.values(custMap).reduce((s: number, c: any) => s + c.totalBelanja, 0) / Math.max(Object.keys(custMap).length, 1);
      const statsArr: CustomerStat[] = Object.values(custMap).map((c: any) => {
        const daysSince = differenceInDays(new Date(), new Date(c.lastVisit));
        const totalDays = Math.max(differenceInDays(new Date(c.lastVisit), new Date(c.firstVisit)), 1);
        const frequency = c.jumlahTransaksi;
        const rfmScore = classifyRFM(daysSince, frequency, c.totalBelanja, avgBelanja);
        return {
          ...c,
          avgTransaksi: c.jumlahTransaksi > 0 ? c.totalBelanja / c.jumlahTransaksi : 0,
          daysSinceLastVisit: daysSince,
          frequency,
          rfmScore,
          rfmLabel: RFM_CONFIG[rfmScore]?.label || 'Lainnya',
        };
      }).sort((a, b) => b.totalBelanja - a.totalBelanja);

      setCustomerStats(statsArr);

      // RFM Distribution
      const rfmMap: Record<string, number> = {};
      statsArr.forEach(c => { rfmMap[c.rfmScore] = (rfmMap[c.rfmScore] || 0) + 1; });
      setRfmDist(Object.entries(rfmMap).map(([k, v], i) => ({
        name: RFM_CONFIG[k]?.label || k, value: v,
        color: COLORS[i % COLORS.length],
      })));

      // Monthly new vs returning
      const monthlyMap: Record<string, { new: Set<string>; returning: Set<string>; all: number }> = {};
      const seenCustomers = new Set<string>();
      sales.forEach((s: any) => {
        const monthKey = format(new Date(s.created_at), 'yyyy-MM');
        if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { new: new Set(), returning: new Set(), all: 0 };
        const cId = s.customer_id || s.customer_name || 'walk-in';
        if (seenCustomers.has(cId)) {
          monthlyMap[monthKey].returning.add(cId);
        } else {
          monthlyMap[monthKey].new.add(cId);
          seenCustomers.add(cId);
        }
        monthlyMap[monthKey].all++;
      });

      setMonthlyData(Object.entries(monthlyMap).sort().map(([k, v]) => ({
        month: format(parseISO(k + '-01'), 'MMM yy', { locale: idLocale }),
        newCustomers: v.new.size,
        returningCustomers: v.returning.size,
        total: v.all,
      })));

      // Payment distribution
      const pmMap: Record<string, { count: number; total: number }> = {};
      sales.forEach((s: any) => {
        const pm = s.payment_method || 'other';
        if (!pmMap[pm]) pmMap[pm] = { count: 0, total: 0 };
        pmMap[pm].count++;
        pmMap[pm].total += Number(s.total);
      });
      setPaymentDist(Object.entries(pmMap).map(([method, v]) => ({ method, ...v })).sort((a, b) => b.total - a.total));

      // Top products (best effort)
      const prodRes2 = await supabase.from('pos_sale_items' as any)
        .select('product_name, qty, subtotal')
        .gte('created_at' as any, startDate.toISOString());

      const prodMap: Record<string, { qty: number; revenue: number }> = {};
      ((prodRes2.data || []) as any[]).forEach((item: any) => {
        const key = item.product_name || 'Tidak Diketahui';
        if (!prodMap[key]) prodMap[key] = { qty: 0, revenue: 0 };
        prodMap[key].qty += Number(item.qty || 0);
        prodMap[key].revenue += Number(item.subtotal || 0);
      });
      setTopProducts(Object.entries(prodMap)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8));

    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeOutlet, months]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const exportCSV = () => {
    const rows = [
      ['Analitik Pelanggan'],
      ['Nama', 'Total Belanja', 'Jumlah Transaksi', 'Rata-rata/Trx', 'Kunjungan Terakhir', 'Segmen'],
      ...customerStats.map(c => [c.customerName, c.totalBelanja, c.jumlahTransaksi, c.avgTransaksi.toFixed(0), c.lastVisit, c.rfmLabel]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `analitik-pelanggan-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  const totalCustomers = customerStats.length;
  const totalRevenue = customerStats.reduce((s, c) => s + c.totalBelanja, 0);
  const championsCount = customerStats.filter(c => c.rfmScore === 'champions').length;
  const atRiskCount = customerStats.filter(c => c.rfmScore === 'at_risk' || c.rfmScore === 'lost').length;
  const avgPerCustomer = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debit: 'Kartu Debit', other: 'Lainnya'
  };

  if (!tenant) {
    return <POSLayout><div className="flex items-center justify-center h-64"><AlertCircle className="h-8 w-8 text-muted-foreground" /></div></POSLayout>;
  }

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Analitik Pelanggan</h1>
            <p className="text-muted-foreground text-sm">Segmentasi RFM, tren pelanggan & metode pembayaran</p>
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
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground">Periode:</Label>
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Bulan Terakhir</SelectItem>
              <SelectItem value="3">3 Bulan Terakhir</SelectItem>
              <SelectItem value="6">6 Bulan Terakhir</SelectItem>
              <SelectItem value="12">12 Bulan Terakhir</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-blue-600" /><span className="text-xs text-muted-foreground">Total Pelanggan</span></div>
              <p className="font-bold text-2xl">{totalCustomers}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Crown className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Champions</span></div>
              <p className="font-bold text-2xl text-amber-500">{championsCount}</p>
              <p className="text-xs text-muted-foreground">{totalCustomers > 0 ? ((championsCount/totalCustomers)*100).toFixed(0) : 0}% dari total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-emerald-600" /><span className="text-xs text-muted-foreground">Rata-rata Belanja</span></div>
              <p className="font-bold text-xl text-emerald-600">{formatCurrency(avgPerCustomer)}</p>
              <p className="text-xs text-muted-foreground">per pelanggan</p>
            </CardContent>
          </Card>
          <Card className={atRiskCount > 0 ? 'border-red-200' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><AlertCircle className={`h-4 w-4 ${atRiskCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} /><span className="text-xs text-muted-foreground">Perlu Perhatian</span></div>
              <p className={`font-bold text-2xl ${atRiskCount > 0 ? 'text-red-500' : ''}`}>{atRiskCount}</p>
              <p className="text-xs text-muted-foreground">at risk / hilang</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="top">
          <TabsList>
            <TabsTrigger value="top">Top Pelanggan</TabsTrigger>
            <TabsTrigger value="rfm">Segmentasi RFM</TabsTrigger>
            <TabsTrigger value="trend">Tren & Pembayaran</TabsTrigger>
          </TabsList>

          {/* Top Customers Tab */}
          <TabsContent value="top">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Top 20 Pelanggan berdasar Nilai Belanja</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Memuat...</div>
                ) : customerStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Tidak ada data pelanggan</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Nama Pelanggan</TableHead>
                        <TableHead className="text-right">Total Belanja</TableHead>
                        <TableHead className="text-right">Transaksi</TableHead>
                        <TableHead className="text-right">Avg/Trx</TableHead>
                        <TableHead>Terakhir Belanja</TableHead>
                        <TableHead>Segmen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerStats.slice(0, 20).map((c, i) => {
                        const rfm = RFM_CONFIG[c.rfmScore] || RFM_CONFIG.others;
                        return (
                          <TableRow key={i}>
                            <TableCell>
                              {i === 0 ? <Crown className="h-4 w-4 text-amber-500" /> :
                               i === 1 ? <Star className="h-4 w-4 text-gray-400" /> :
                               i === 2 ? <Star className="h-4 w-4 text-amber-700" /> :
                               <span className="text-muted-foreground text-sm">{i + 1}</span>}
                            </TableCell>
                            <TableCell className="font-medium">{c.customerName}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(c.totalBelanja)}</TableCell>
                            <TableCell className="text-right">{c.jumlahTransaksi}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(c.avgTransaksi)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(c.lastVisit), 'dd MMM yyyy', { locale: idLocale })}
                              {c.daysSinceLastVisit > 0 && (
                                <span className={`ml-1 ${c.daysSinceLastVisit > 60 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                  ({c.daysSinceLastVisit}h lalu)
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs border-0 ${rfm.color}`}>{rfm.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RFM Tab */}
          <TabsContent value="rfm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Distribusi Segmen RFM</CardTitle></CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">Memuat...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={rfmDist} cx="50%" cy="50%" outerRadius={100}
                          dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}>
                          {rfmDist.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Detail Segmen</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(RFM_CONFIG).map(([key, cfg]) => {
                    const count = customerStats.filter(c => c.rfmScore === key).length;
                    const pct = totalCustomers > 0 ? (count / totalCustomers) * 100 : 0;
                    if (count === 0) return null;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs border-0 ${cfg.color}`}>{cfg.label}</Badge>
                            <span className="text-xs text-muted-foreground">{cfg.desc}</span>
                          </div>
                          <span className="text-sm font-bold">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trend Tab */}
          <TabsContent value="trend">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Pelanggan Baru vs Kembali per Bulan</CardTitle></CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">Memuat...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="newCustomers" fill="#10b981" name="Pelanggan Baru" radius={[2, 2, 0, 0]} stackId="a" />
                        <Bar dataKey="returningCustomers" fill="#3b82f6" name="Pelanggan Kembali" radius={[2, 2, 0, 0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Distribusi Metode Pembayaran</CardTitle></CardHeader>
                <CardContent>
                  {loading || paymentDist.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      {loading ? 'Memuat...' : 'Tidak ada data'}
                    </div>
                  ) : (
                    <div className="space-y-3 mt-2">
                      {paymentDist.map((p, i) => {
                        const totalAllPayments = paymentDist.reduce((s, pp) => s + pp.total, 0);
                        const pct = totalAllPayments > 0 ? (p.total / totalAllPayments) * 100 : 0;
                        return (
                          <div key={p.method}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-sm font-medium">{PAYMENT_LABELS[p.method] || p.method}</span>
                                <span className="text-xs text-muted-foreground">{p.count} transaksi</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-bold">{formatCurrency(p.total)}</span>
                                <span className="text-xs text-muted-foreground ml-2">{pct.toFixed(1)}%</span>
                              </div>
                            </div>
                            <Progress value={pct} className="h-2" style={{ '--progress-fill': COLORS[i % COLORS.length] } as any} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-3"><CardTitle className="text-base">Top Produk (Berdasar Omzet)</CardTitle></CardHeader>
                <CardContent>
                  {loading || topProducts.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      {loading ? 'Memuat...' : 'Tidak ada data'}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 120 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : `${(v/1000).toFixed(0)}rb`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                        <Tooltip formatter={(val: any) => formatCurrency(val)} />
                        <Bar dataKey="revenue" name="Omzet" radius={[0, 4, 4, 0]}>
                          {topProducts.map((_, idx) => (
                            <Cell key={idx} fill={idx < 3 ? COLORS[idx] : '#6b7280'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </POSLayout>
  );
}
