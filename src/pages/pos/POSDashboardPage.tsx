import { useEffect, useState } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, ShoppingCart, Package, Users, AlertTriangle,
  ArrowRight, BarChart3, Calendar, CreditCard
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  weekSales: number;
  monthSales: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockCount: number;
  topProducts: { name: string; qty: number; total: number }[];
  salesChart: { label: string; total: number }[];
}

export default function POSDashboardPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant || !activeOutlet) return;
    fetchStats();
  }, [tenant, activeOutlet]);

  const fetchStats = async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

      const [todaySalesRes, weekSalesRes, monthSalesRes, productsRes, customersRes, stockRes, topProductsRes] = await Promise.all([
        supabase.from('pos_sales' as any).select('total').eq('tenant_id', tenant.id).eq('outlet_id', activeOutlet.id).eq('status', 'completed').gte('created_at', todayStart).lte('created_at', todayEnd),
        supabase.from('pos_sales' as any).select('total').eq('tenant_id', tenant.id).eq('outlet_id', activeOutlet.id).eq('status', 'completed').gte('created_at', weekStart).lte('created_at', weekEnd),
        supabase.from('pos_sales' as any).select('total').eq('tenant_id', tenant.id).eq('outlet_id', activeOutlet.id).eq('status', 'completed').gte('created_at', monthStart).lte('created_at', monthEnd),
        supabase.from('pos_products' as any).select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('is_active', true),
        supabase.from('pos_customers' as any).select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        supabase.from('pos_stock' as any).select('quantity, min_stock, product_id').eq('outlet_id', activeOutlet.id),
        supabase.from('pos_sale_items' as any).select('product_name, qty, subtotal').eq('sale_id', supabase.from('pos_sales' as any).select('id').eq('tenant_id', tenant.id).eq('outlet_id', activeOutlet.id).eq('status', 'completed').gte('created_at', monthStart)),
      ]);

      const todaySales = (todaySalesRes.data || []).reduce((s: number, r: any) => s + parseFloat(r.total), 0);
      const todayTransactions = todaySalesRes.data?.length || 0;
      const weekSales = (weekSalesRes.data || []).reduce((s: number, r: any) => s + parseFloat(r.total), 0);
      const monthSales = (monthSalesRes.data || []).reduce((s: number, r: any) => s + parseFloat(r.total), 0);
      const totalProducts = productsRes.count || 0;
      const totalCustomers = customersRes.count || 0;
      const lowStockCount = (stockRes.data || []).filter((s: any) => s.quantity <= (s.min_stock || 5)).length;

      // Grafik 7 hari terakhir
      const salesChart = [];
      for (let i = 6; i >= 0; i--) {
        const day = subDays(now, i);
        const start = startOfDay(day).toISOString();
        const end = endOfDay(day).toISOString();
        const { data } = await supabase.from('pos_sales' as any).select('total').eq('tenant_id', tenant.id).eq('outlet_id', activeOutlet.id).eq('status', 'completed').gte('created_at', start).lte('created_at', end);
        const total = (data || []).reduce((s: number, r: any) => s + parseFloat(r.total), 0);
        salesChart.push({ label: format(day, 'EEE', { locale: idLocale }), total });
      }

      setStats({ todaySales, todayTransactions, weekSales, monthSales, totalProducts, totalCustomers, lowStockCount, topProducts: [], salesChart });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <POSLayout title="Dashboard" subtitle={`${activeOutlet?.name || ''} • ${format(new Date(), 'EEEE, dd MMMM yyyy', { locale: idLocale })}`}>
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {stats?.lowStockCount ? (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">{stats.lowStockCount} produk stok menipis</span>
              <Button variant="ghost" size="sm" className="ml-auto text-amber-700 h-7" onClick={() => navigate('/pos/stok')}>
                Lihat <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          ) : null}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-emerald-100 text-xs font-medium">Omzet Hari Ini</p>
                  <TrendingUp className="h-4 w-4 text-emerald-200" />
                </div>
                <p className="text-xl font-bold">{formatCurrency(stats?.todaySales || 0)}</p>
                <p className="text-emerald-200 text-xs mt-1">{stats?.todayTransactions || 0} transaksi</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-muted-foreground text-xs font-medium">Omzet Minggu Ini</p>
                  <Calendar className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-xl font-bold">{formatCurrency(stats?.weekSales || 0)}</p>
                <p className="text-muted-foreground text-xs mt-1">7 hari terakhir</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-muted-foreground text-xs font-medium">Omzet Bulan Ini</p>
                  <CreditCard className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-xl font-bold">{formatCurrency(stats?.monthSales || 0)}</p>
                <p className="text-muted-foreground text-xs mt-1">{format(new Date(), 'MMMM yyyy', { locale: idLocale })}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-muted-foreground text-xs font-medium">Jumlah Produk</p>
                  <Package className="h-4 w-4 text-orange-500" />
                </div>
                <p className="text-xl font-bold">{stats?.totalProducts || 0}</p>
                <p className="text-muted-foreground text-xs mt-1">Produk aktif</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  Penjualan 7 Hari Terakhir
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats?.salesChart || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : v >= 1000 ? `${(v/1000).toFixed(0)}rb` : v} />
                    <Tooltip formatter={(val: number) => formatCurrency(val)} labelFormatter={l => `Hari: ${l}`} />
                    <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Customer</p>
                      <p className="text-lg font-bold">{stats?.totalCustomers || 0}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => navigate('/pos/customer')}>
                    Kelola Customer <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Menu Cepat</p>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-9 text-sm" onClick={() => navigate('/pos/kasir')}>
                    <ShoppingCart className="h-4 w-4 mr-2" /> Buka Kasir
                  </Button>
                  <Button variant="outline" className="w-full h-9 text-sm" onClick={() => navigate('/pos/produk')}>
                    <Package className="h-4 w-4 mr-2" /> Tambah Produk
                  </Button>
                  <Button variant="outline" className="w-full h-9 text-sm" onClick={() => navigate('/pos/laporan')}>
                    <BarChart3 className="h-4 w-4 mr-2" /> Lihat Laporan
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </POSLayout>
  );
}
