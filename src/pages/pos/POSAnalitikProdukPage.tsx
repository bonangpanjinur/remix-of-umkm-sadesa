import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import { TrendingDown, Package, AlertTriangle, RefreshCw, Download, TrendingUp, BarChart2 } from 'lucide-react';
import { subDays, subMonths, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ProductStat {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
  price: number;
  cost_price: number;
  stock: number;
  qtySold: number;
  revenue: number;
  cogs: number;
  margin: number;
  marginPct: number;
  turnoverDays: number;
  lastSoldAt: string | null;
  daysSinceLastSale: number;
  status: 'fast' | 'medium' | 'slow' | 'dead';
}

const STATUS_CONFIG = {
  fast:   { label: 'Fast Moving',   color: 'bg-emerald-100 text-emerald-800', bar: '#10b981', minTurnover: 0,  maxTurnover: 7  },
  medium: { label: 'Medium Moving', color: 'bg-blue-100 text-blue-800',       bar: '#3b82f6', minTurnover: 8,  maxTurnover: 30 },
  slow:   { label: 'Slow Moving',   color: 'bg-yellow-100 text-yellow-800',   bar: '#f59e0b', minTurnover: 31, maxTurnover: 90 },
  dead:   { label: 'Dead Stock',    color: 'bg-red-100 text-red-800',         bar: '#ef4444', minTurnover: 91, maxTurnover: 9999 },
};

function classifyProduct(daysSinceLastSale: number, qtySold: number, stock: number): ProductStat['status'] {
  if (qtySold === 0 && stock > 0) return 'dead';
  if (daysSinceLastSale > 90) return 'dead';
  if (daysSinceLastSale > 30) return 'slow';
  if (daysSinceLastSale > 7) return 'medium';
  return 'fast';
}

export default function POSAnalitikProdukPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [period, setPeriod] = useState('90');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductStat[]>([]);
  const [activeTab, setActiveTab] = useState('all');

  const fetchReport = useCallback(async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    try {
      const startDate = subDays(new Date(), Number(period));

      const [prodRes, salesRes, stockRes] = await Promise.all([
        supabase.from('pos_products' as any)
          .select('id, name, sku, unit, price, cost_price, pos_categories(name)')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true),
        supabase.from('pos_sale_items' as any)
          .select('product_id, qty, price, cost_price, subtotal, pos_sales(created_at, status, outlet_id)')
          .gte('pos_sales.created_at' as any, startDate.toISOString()),
        supabase.from('pos_stock' as any)
          .select('product_id, quantity')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id),
      ]);

      const prods = (prodRes.data || []) as any[];
      const saleItems = ((salesRes.data || []) as any[]).filter(i =>
        i.pos_sales?.status === 'completed' && i.pos_sales?.outlet_id === activeOutlet.id
      );
      const stocks = (stockRes.data || []) as any[];

      const stockMap: Record<string, number> = {};
      stocks.forEach((s: any) => { stockMap[s.product_id] = s.quantity; });

      const salesMap: Record<string, { qty: number; revenue: number; cogs: number; lastDate: string }> = {};
      saleItems.forEach((item: any) => {
        if (!salesMap[item.product_id]) {
          salesMap[item.product_id] = { qty: 0, revenue: 0, cogs: 0, lastDate: '' };
        }
        salesMap[item.product_id].qty += item.qty;
        salesMap[item.product_id].revenue += item.subtotal;
        salesMap[item.product_id].cogs += (item.cost_price || 0) * item.qty;
        const d = item.pos_sales?.created_at || '';
        if (d > salesMap[item.product_id].lastDate) salesMap[item.product_id].lastDate = d;
      });

      const now = new Date();
      const stats: ProductStat[] = prods.map((p: any) => {
        const sale = salesMap[p.id] || { qty: 0, revenue: 0, cogs: 0, lastDate: '' };
        const stock = stockMap[p.id] ?? 0;
        const margin = sale.revenue - sale.cogs;
        const marginPct = sale.revenue > 0 ? Math.round((margin / sale.revenue) * 100) : 0;
        const daysSinceLastSale = sale.lastDate
          ? Math.floor((now.getTime() - new Date(sale.lastDate).getTime()) / 86400000)
          : Number(period) + 1;
        const turnoverDays = sale.qty > 0 && stock > 0
          ? Math.round((stock / sale.qty) * Number(period))
          : stock > 0 ? 999 : 0;

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: (p.pos_categories as any)?.name || 'Uncategorized',
          unit: p.unit,
          price: p.price,
          cost_price: p.cost_price,
          stock,
          qtySold: sale.qty,
          revenue: sale.revenue,
          cogs: sale.cogs,
          margin,
          marginPct,
          turnoverDays: Math.min(turnoverDays, 999),
          lastSoldAt: sale.lastDate || null,
          daysSinceLastSale,
          status: classifyProduct(daysSinceLastSale, sale.qty, stock),
        };
      });

      stats.sort((a, b) => b.revenue - a.revenue);
      setProducts(stats);
    } catch (err) {
      console.error('Error fetching product analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeOutlet, period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const filtered = activeTab === 'all' ? products : products.filter(p => p.status === activeTab);

  const summary = {
    fast:   products.filter(p => p.status === 'fast').length,
    medium: products.filter(p => p.status === 'medium').length,
    slow:   products.filter(p => p.status === 'slow').length,
    dead:   products.filter(p => p.status === 'dead').length,
  };

  const topRevenueChart = products.slice(0, 10).map(p => ({ name: p.name.substring(0, 16), revenue: p.revenue }));
  const deadStockValue = products.filter(p => p.status === 'dead').reduce((s, p) => s + p.stock * p.cost_price, 0);

  const exportCSV = () => {
    const headers = ['Produk', 'SKU', 'Kategori', 'Stok', 'Terjual', 'Pendapatan', 'Margin %', 'Turnover (hari)', 'Status', 'Terakhir Terjual'];
    const rows = filtered.map(p => [
      p.name, p.sku || '', p.category, p.stock, p.qtySold,
      p.revenue, p.marginPct + '%', p.turnoverDays === 999 ? 'N/A' : p.turnoverDays,
      STATUS_CONFIG[p.status].label,
      p.lastSoldAt ? format(new Date(p.lastSoldAt), 'dd MMM yyyy', { locale: idLocale }) : '-'
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `analitik-produk-${period}hari.csv`;
    a.click();
  };

  return (
    <POSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Analitik Produk</h1>
            <p className="text-sm text-muted-foreground">Slow-moving, dead stock, dan turnover rate</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 Hari</SelectItem>
                <SelectItem value="60">60 Hari</SelectItem>
                <SelectItem value="90">90 Hari</SelectItem>
                <SelectItem value="180">6 Bulan</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(['fast', 'medium', 'slow', 'dead'] as const).map(status => {
            const cfg = STATUS_CONFIG[status];
            const icons = { fast: TrendingUp, medium: BarChart2, slow: TrendingDown, dead: AlertTriangle };
            const Icon = icons[status];
            return (
              <Card
                key={status}
                className={`cursor-pointer border-2 transition-all ${activeTab === status ? 'border-primary shadow-md' : 'border-transparent'}`}
                onClick={() => setActiveTab(prev => prev === status ? 'all' : status)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{cfg.label}</p>
                      <p className="text-3xl font-bold mt-1">{summary[status]}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">produk</p>
                    </div>
                    <Icon className="h-5 w-5 text-muted-foreground mt-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {deadStockValue > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="font-medium text-red-800">Nilai Dead Stock: {formatCurrency(deadStockValue)}</p>
              <p className="text-sm text-red-600">{summary.dead} produk tidak terjual dalam {period} hari terakhir. Pertimbangkan diskon atau return ke supplier.</p>
            </div>
          </div>
        )}

        {/* Chart */}
        {topRevenueChart.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 10 Produk Terlaris (Pendapatan)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topRevenueChart} margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Pendapatan']} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {topRevenueChart.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#10b981' : i < 3 ? '#3b82f6' : '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                {activeTab === 'all' ? 'Semua Produk' : STATUS_CONFIG[activeTab as keyof typeof STATUS_CONFIG]?.label}
                <Badge variant="secondary">{filtered.length}</Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="text-right">Terjual</TableHead>
                    <TableHead className="text-right">Pendapatan</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Turnover</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">Tidak ada data produk</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(p => {
                      const cfg = STATUS_CONFIG[p.status];
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.sku || p.category}</p>
                              {p.lastSoldAt && (
                                <p className="text-xs text-muted-foreground">
                                  Terakhir: {format(new Date(p.lastSoldAt), 'dd MMM', { locale: idLocale })}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">{p.stock} {p.unit}</TableCell>
                          <TableCell className="text-right text-sm">{p.qtySold}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(p.revenue)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`text-sm font-medium ${p.marginPct >= 20 ? 'text-emerald-600' : p.marginPct >= 10 ? 'text-blue-600' : 'text-red-600'}`}>
                              {p.marginPct}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {p.turnoverDays === 999 || p.turnoverDays === 0 ? '-' : `${p.turnoverDays}h`}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </POSLayout>
  );
}
