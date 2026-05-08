import { useState, useEffect } from 'react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line
} from 'recharts';
import { TrendingUp, ShoppingBag, Store, RefreshCw, Download } from 'lucide-react';
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { formatPrice } from '@/lib/utils';

export default function DesaEkonomiPage() {
  const { user } = useAuth();
  const [villageId, setVillageId] = useState<string | null>(null);
  const [period, setPeriod] = useState('6');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalOmzet: 0, totalTransaksi: 0, activeMerchants: 0, avgOrder: 0 });
  const [monthlyData, setMonthlyData] = useState<{ month: string; omzet: number; transaksi: number }[]>([]);
  const [topMerchants, setTopMerchants] = useState<{ name: string; omzet: number; transaksi: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ category: string; omzet: number }[]>([]);

  useEffect(() => {
    const fetchVillage = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('user_villages')
        .select('village_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.village_id) setVillageId(data.village_id);
    };
    fetchVillage();
  }, [user]);

  useEffect(() => {
    if (villageId) fetchData();
  }, [villageId, period]);

  const fetchData = async () => {
    if (!villageId) return;
    setLoading(true);
    try {
      const startDate = subMonths(new Date(), Number(period));

      const [merchantsRes, ordersRes] = await Promise.all([
        supabase.from('merchants').select('id, name, business_category').eq('village_id', villageId).eq('registration_status', 'APPROVED'),
        supabase.from('orders').select('total, created_at, merchant_id, merchants(name, business_category, village_id)').gte('created_at', startDate.toISOString()).eq('status', 'COMPLETED'),
      ] as const);

      const merchants = merchantsRes.data || [];
      const orders = ((ordersRes.data || []) as any[]).filter(o => o.merchants?.village_id === villageId);

      const totalOmzet = orders.reduce((s: number, o: any) => s + (o.total || 0), 0);
      setStats({
        totalOmzet,
        totalTransaksi: orders.length,
        activeMerchants: merchants.length,
        avgOrder: orders.length > 0 ? Math.round(totalOmzet / orders.length) : 0,
      });

      // Monthly data
      const monthly: Record<string, { omzet: number; transaksi: number }> = {};
      for (let i = Number(period) - 1; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const key = format(d, 'MMM yy', { locale: idLocale });
        monthly[key] = { omzet: 0, transaksi: 0 };
      }
      orders.forEach((o: any) => {
        const key = format(new Date(o.created_at), 'MMM yy', { locale: idLocale });
        if (monthly[key]) {
          monthly[key].omzet += o.total || 0;
          monthly[key].transaksi += 1;
        }
      });
      setMonthlyData(Object.entries(monthly).map(([month, v]) => ({ month, ...v })));

      // Top merchants
      const merchantMap: Record<string, { name: string; omzet: number; transaksi: number }> = {};
      orders.forEach((o: any) => {
        const mid = o.merchant_id;
        const name = o.merchants?.name || 'Unknown';
        if (!merchantMap[mid]) merchantMap[mid] = { name, omzet: 0, transaksi: 0 };
        merchantMap[mid].omzet += o.total || 0;
        merchantMap[mid].transaksi += 1;
      });
      setTopMerchants(Object.values(merchantMap).sort((a, b) => b.omzet - a.omzet).slice(0, 5));

      // By category
      const catMap: Record<string, number> = {};
      merchants.forEach((m: any) => { catMap[m.business_category || 'Lainnya'] = 0; });
      orders.forEach((o: any) => {
        const cat = o.merchants?.business_category || 'Lainnya';
        catMap[cat] = (catMap[cat] || 0) + (o.total || 0);
      });
      setCategoryData(Object.entries(catMap).map(([category, omzet]) => ({ category, omzet })).sort((a, b) => b.omzet - a.omzet));
    } catch (err) {
      console.error('Error fetching ekonomi data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DesaLayout title="Laporan Ekonomi Desa" subtitle="Ringkasan omzet UMKM dan transaksi">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div />
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Bulan</SelectItem>
                <SelectItem value="6">6 Bulan</SelectItem>
                <SelectItem value="12">12 Bulan</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Omzet', value: formatPrice(stats.totalOmzet), icon: TrendingUp, color: 'text-emerald-600' },
            { label: 'Total Transaksi', value: stats.totalTransaksi.toLocaleString('id-ID'), icon: ShoppingBag, color: 'text-blue-600' },
            { label: 'UMKM Aktif', value: stats.activeMerchants, icon: Store, color: 'text-purple-600' },
            { label: 'Rata-rata Order', value: formatPrice(stats.avgOrder), icon: TrendingUp, color: 'text-orange-600' },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                  <s.icon className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Monthly Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tren Omzet Bulanan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}jt`} />
                <Tooltip formatter={(v: number) => [formatPrice(v), 'Omzet']} />
                <Line type="monotone" dataKey="omzet" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Merchants */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 5 UMKM</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topMerchants.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada data transaksi</p>
                ) : (
                  topMerchants.map((m, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.transaksi} transaksi</p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-600 shrink-0">{formatPrice(m.omzet)}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* By Category */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Omzet per Kategori</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={categoryData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}jt`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v: number) => [formatPrice(v), 'Omzet']} />
                  <Bar dataKey="omzet" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DesaLayout>
  );
}
