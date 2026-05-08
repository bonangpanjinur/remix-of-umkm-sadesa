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
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import {
  Archive, Download, RefreshCw, AlertCircle, ArrowUp, ArrowDown,
  AlertTriangle, TrendingUp, TrendingDown, Search
} from 'lucide-react';
import {
  format, startOfDay, endOfDay, startOfMonth, endOfMonth, parseISO
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface StokSummary {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  currentStock: number;
  minStock: number;
  totalIn: number;
  totalOut: number;
  totalSales: number;
  totalPurchase: number;
  totalAdjust: number;
}

interface Mutation {
  id: string;
  type: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType: string;
  notes: string | null;
  createdAt: string;
  productName: string;
  productSku: string;
}

const MUTATION_TYPE_CONFIG: Record<string, { label: string; color: string; direction: 'in' | 'out' }> = {
  sale: { label: 'Penjualan', color: 'bg-red-100 text-red-700', direction: 'out' },
  purchase: { label: 'Pembelian', color: 'bg-emerald-100 text-emerald-700', direction: 'in' },
  return_in: { label: 'Retur Masuk', color: 'bg-blue-100 text-blue-700', direction: 'in' },
  return_out: { label: 'Retur Keluar', color: 'bg-orange-100 text-orange-700', direction: 'out' },
  adjustment_in: { label: 'Adjust Masuk', color: 'bg-teal-100 text-teal-700', direction: 'in' },
  adjustment_out: { label: 'Adjust Keluar', color: 'bg-purple-100 text-purple-700', direction: 'out' },
  adjustment: { label: 'Penyesuaian', color: 'bg-gray-100 text-gray-700', direction: 'in' },
  transfer_in: { label: 'Transfer Masuk', color: 'bg-indigo-100 text-indigo-700', direction: 'in' },
  transfer_out: { label: 'Transfer Keluar', color: 'bg-yellow-100 text-yellow-700', direction: 'out' },
};

export default function POSLaporanStokPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [dateStart, setDateStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [stokSummary, setStokSummary] = useState<StokSummary[]>([]);
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [lowStock, setLowStock] = useState<StokSummary[]>([]);
  const [activeTab, setActiveTab] = useState('summary');

  const fetchReport = useCallback(async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    const start = startOfDay(parseISO(dateStart));
    const end = endOfDay(parseISO(dateEnd));

    try {
      const [stockRes, mutRes] = await Promise.all([
        supabase.from('pos_stock' as any)
          .select('*, pos_products(id, name, sku, unit)')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id),
        supabase.from('pos_stock_mutations' as any)
          .select('*, pos_products(name, sku)')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      const stocks = (stockRes.data || []) as any[];
      const muts = (mutRes.data || []) as any[];

      const mutMap: Record<string, { in: number; out: number; sales: number; purchase: number; adjust: number }> = {};
      muts.forEach((m: any) => {
        const id = m.product_id;
        if (!mutMap[id]) mutMap[id] = { in: 0, out: 0, sales: 0, purchase: 0, adjust: 0 };
        const qty = Math.abs(Number(m.quantity));
        const cfg = MUTATION_TYPE_CONFIG[m.type];
        if (cfg?.direction === 'in') mutMap[id].in += qty;
        else mutMap[id].out += qty;
        if (m.type === 'sale') mutMap[id].sales += qty;
        if (m.type === 'purchase') mutMap[id].purchase += qty;
        if (m.type?.includes('adjust')) mutMap[id].adjust += qty;
      });

      const summary: StokSummary[] = stocks.map((s: any) => ({
        productId: s.product_id,
        productName: s.pos_products?.name || 'Produk Terhapus',
        sku: s.pos_products?.sku || '-',
        unit: s.pos_products?.unit || 'pcs',
        currentStock: Number(s.quantity),
        minStock: Number(s.min_stock || 0),
        totalIn: mutMap[s.product_id]?.in || 0,
        totalOut: mutMap[s.product_id]?.out || 0,
        totalSales: mutMap[s.product_id]?.sales || 0,
        totalPurchase: mutMap[s.product_id]?.purchase || 0,
        totalAdjust: mutMap[s.product_id]?.adjust || 0,
      })).sort((a, b) => b.totalSales - a.totalSales);

      setStokSummary(summary);
      setLowStock(summary.filter(s => s.currentStock <= s.minStock));
      setMutations(muts.map((m: any) => ({
        id: m.id,
        type: m.type,
        quantity: Number(m.quantity),
        quantityBefore: Number(m.quantity_before || 0),
        quantityAfter: Number(m.quantity_after || 0),
        referenceType: m.reference_type || '-',
        notes: m.notes,
        createdAt: m.created_at,
        productName: m.pos_products?.name || 'Produk Terhapus',
        productSku: m.pos_products?.sku || '-',
      })));
    } catch (err) {
      console.error('Error fetching stock report:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeOutlet, dateStart, dateEnd]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const filteredSummary = stokSummary.filter(s =>
    s.productName.toLowerCase().includes(search.toLowerCase()) ||
    s.sku.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMutations = mutations.filter(m => {
    const matchType = filterType === 'all' || m.type === filterType;
    const matchSearch = m.productName.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const topMoving = [...stokSummary].sort((a, b) => b.totalSales - a.totalSales).slice(0, 8);

  const exportCSV = () => {
    const rows = [
      ['Laporan Pergerakan Stok', `${dateStart} - ${dateEnd}`],
      ['Produk', 'SKU', 'Stok Saat Ini', 'Min Stok', 'Total Masuk', 'Total Keluar', 'Penjualan', 'Pembelian', 'Adjust', 'Status'],
      ...filteredSummary.map(s => [
        s.productName, s.sku, s.currentStock, s.minStock,
        s.totalIn, s.totalOut, s.totalSales, s.totalPurchase, s.totalAdjust,
        s.currentStock <= 0 ? 'Habis' : s.currentStock <= s.minStock ? 'Menipis' : 'Normal',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `laporan-stok-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  const totalIn = stokSummary.reduce((s, p) => s + p.totalIn, 0);
  const totalOut = stokSummary.reduce((s, p) => s + p.totalOut, 0);
  const totalItems = stokSummary.length;
  const outOfStock = stokSummary.filter(s => s.currentStock <= 0).length;

  if (!tenant) {
    return <POSLayout><div className="flex items-center justify-center h-64"><AlertCircle className="h-8 w-8 text-muted-foreground" /></div></POSLayout>;
  }

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Laporan Pergerakan Stok</h1>
            <p className="text-muted-foreground text-sm">Analisis mutasi & status stok produk</p>
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

        {/* Date Filter */}
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Dari</Label>
            <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-36 h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Sampai</Label>
            <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-36 h-9" />
          </div>
          <Button size="sm" onClick={fetchReport} className="bg-emerald-600 hover:bg-emerald-700">Tampilkan</Button>
        </div>

        {/* Alert Stok Menipis */}
        {lowStock.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-red-700">{lowStock.length} produk stok menipis atau habis</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStock.map(s => (
                  <Badge key={s.productId} className={`border-0 ${s.currentStock <= 0 ? 'bg-red-600 text-white' : 'bg-orange-100 text-orange-800'}`}>
                    {s.productName}: {s.currentStock} {s.unit}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Archive className="h-4 w-4 text-blue-600" /><span className="text-xs text-muted-foreground">Total Produk</span></div>
              <p className="font-bold text-2xl">{totalItems}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><ArrowUp className="h-4 w-4 text-emerald-600" /><span className="text-xs text-muted-foreground">Total Masuk</span></div>
              <p className="font-bold text-2xl text-emerald-600">{totalIn}</p>
              <p className="text-xs text-muted-foreground">unit (periode ini)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><ArrowDown className="h-4 w-4 text-red-500" /><span className="text-xs text-muted-foreground">Total Keluar</span></div>
              <p className="font-bold text-2xl text-red-500">{totalOut}</p>
              <p className="text-xs text-muted-foreground">unit (periode ini)</p>
            </CardContent>
          </Card>
          <Card className={outOfStock > 0 ? 'border-red-200' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle className={`h-4 w-4 ${outOfStock > 0 ? 'text-red-500' : 'text-muted-foreground'}`} /><span className="text-xs text-muted-foreground">Stok Habis</span></div>
              <p className={`font-bold text-2xl ${outOfStock > 0 ? 'text-red-500' : ''}`}>{outOfStock}</p>
              <p className="text-xs text-muted-foreground">produk</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="summary">Ringkasan Stok</TabsTrigger>
            <TabsTrigger value="mutations">Riwayat Mutasi</TabsTrigger>
            <TabsTrigger value="chart">Produk Paling Laku</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">Ringkasan Stok Per Produk</CardTitle>
                  <div className="relative w-48">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Cari produk..." value={search}
                      onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Memuat...</div>
                ) : filteredSummary.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Tidak ada data stok</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead className="text-right">Stok Saat Ini</TableHead>
                        <TableHead className="text-right">Masuk</TableHead>
                        <TableHead className="text-right">Keluar</TableHead>
                        <TableHead className="text-right">Terjual</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSummary.map(s => {
                        const status = s.currentStock <= 0 ? 'habis' : s.currentStock <= s.minStock ? 'menipis' : 'normal';
                        return (
                          <TableRow key={s.productId}>
                            <TableCell>
                              <p className="font-medium text-sm">{s.productName}</p>
                              {s.sku !== '-' && <p className="text-xs text-muted-foreground">SKU: {s.sku}</p>}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${status === 'habis' ? 'text-red-600' : status === 'menipis' ? 'text-orange-500' : 'text-emerald-600'}`}>
                              {s.currentStock} {s.unit}
                            </TableCell>
                            <TableCell className="text-right text-emerald-600">+{s.totalIn}</TableCell>
                            <TableCell className="text-right text-red-500">-{s.totalOut}</TableCell>
                            <TableCell className="text-right">{s.totalSales}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={`text-xs border-0 ${
                                status === 'habis' ? 'bg-red-100 text-red-700' :
                                status === 'menipis' ? 'bg-orange-100 text-orange-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {status === 'habis' ? 'Habis' : status === 'menipis' ? 'Menipis' : 'Normal'}
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
          </TabsContent>

          {/* Mutations Tab */}
          <TabsContent value="mutations">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">Riwayat Mutasi Stok</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative w-40">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Cari produk..." value={search}
                        onChange={e => setSearch(e.target.value)} className="pl-7 h-8 text-xs" />
                    </div>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Tipe</SelectItem>
                        {Object.entries(MUTATION_TYPE_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Memuat...</div>
                ) : filteredMutations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Tidak ada mutasi stok pada periode ini</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Produk</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead className="text-right">Sebelum</TableHead>
                        <TableHead className="text-right">Perubahan</TableHead>
                        <TableHead className="text-right">Sesudah</TableHead>
                        <TableHead>Keterangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMutations.map(m => {
                        const cfg = MUTATION_TYPE_CONFIG[m.type] || { label: m.type, color: 'bg-gray-100 text-gray-700', direction: 'in' };
                        const isIn = cfg.direction === 'in';
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(m.createdAt), 'dd/MM HH:mm', { locale: idLocale })}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{m.productName}</p>
                              {m.productSku !== '-' && <p className="text-xs text-muted-foreground">{m.productSku}</p>}
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs border-0 ${cfg.color}`}>{cfg.label}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm">{m.quantityBefore}</TableCell>
                            <TableCell className={`text-right font-bold text-sm ${isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                              {isIn ? '+' : '-'}{Math.abs(m.quantity)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">{m.quantityAfter}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-32 truncate">
                              {m.notes || '-'}
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

          {/* Chart Tab */}
          <TabsContent value="chart">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Top Produk Paling Banyak Terjual</CardTitle></CardHeader>
              <CardContent>
                {loading || topMoving.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    {loading ? 'Memuat...' : 'Tidak ada data'}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={topMoving} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="productName" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="totalSales" name="Terjual" radius={[0, 4, 4, 0]}>
                        {topMoving.map((_, idx) => (
                          <Cell key={idx} fill={idx === 0 ? '#10b981' : idx === 1 ? '#3b82f6' : idx === 2 ? '#f59e0b' : '#6b7280'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </POSLayout>
  );
}
