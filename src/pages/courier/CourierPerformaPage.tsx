import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { ArrowLeft, Star, Clock, TrendingUp, Package, CheckCircle, AlertCircle, Award } from 'lucide-react';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface DailyStat {
  date: string;
  deliveries: number;
  earnings: number;
  onTime: number;
}

export default function CourierPerformaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const [courierId, setCourierId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    completedDeliveries: 0,
    onTimeDeliveries: 0,
    totalEarnings: 0,
    avgRating: 0,
    ratingCount: 0,
    completionRate: 0,
    onTimeRate: 0,
    bestDay: '',
  });
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, period]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: courier } = await supabase
        .from('couriers')
        .select('id, registration_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!courier || courier.registration_status !== 'APPROVED') {
        navigate('/courier');
        return;
      }
      setCourierId(courier.id);

      const startDate = subDays(new Date(), Number(period));

      const [ordersRes, earningsRes] = await Promise.all([
        supabase.from('orders')
          .select('id, status, created_at, assigned_at, delivered_at, total')
          .eq('courier_id', courier.id)
          .gte('created_at', startDate.toISOString()),
        supabase.from('courier_earnings')
          .select('amount, created_at, status')
          .eq('courier_id', courier.id)
          .gte('created_at', startDate.toISOString()),
      ]);

      const orders = (ordersRes.data || []) as any[];
      const earnings = (earningsRes.data || []) as any[];

      const completed = orders.filter(o => o.status === 'DELIVERED' || o.status === 'COMPLETED');
      const totalEarnings = earnings.reduce((s, e) => s + e.amount, 0);

      // On-time: delivered within 2 hours of assignment
      const onTime = completed.filter(o => {
        if (!o.assigned_at || !o.delivered_at) return false;
        const diff = new Date(o.delivered_at).getTime() - new Date(o.assigned_at).getTime();
        return diff <= 2 * 3600 * 1000;
      }).length;

      // Daily stats
      const dailyMap: Record<string, DailyStat> = {};
      for (let i = Math.min(Number(period), 30) - 1; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const key = format(d, 'dd/MM');
        dailyMap[key] = { date: key, deliveries: 0, earnings: 0, onTime: 0 };
      }

      completed.forEach(o => {
        const key = format(new Date(o.created_at), 'dd/MM');
        if (dailyMap[key]) {
          dailyMap[key].deliveries += 1;
        }
      });

      earnings.forEach(e => {
        const key = format(new Date(e.created_at), 'dd/MM');
        if (dailyMap[key]) {
          dailyMap[key].earnings += e.amount;
        }
      });

      const daily = Object.values(dailyMap);
      const bestDay = daily.reduce((best, d) => d.deliveries > best.deliveries ? d : best, daily[0] || { date: '-', deliveries: 0, earnings: 0, onTime: 0 });

      setDailyStats(daily);
      setStats({
        totalDeliveries: orders.length,
        completedDeliveries: completed.length,
        onTimeDeliveries: onTime,
        totalEarnings,
        avgRating: 0,
        ratingCount: 0,
        completionRate: orders.length > 0 ? Math.round((completed.length / orders.length) * 100) : 0,
        onTimeRate: completed.length > 0 ? Math.round((onTime / completed.length) * 100) : 0,
        bestDay: bestDay?.date || '-',
      });
    } catch (err) {
      console.error('Error fetching performa:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPerformaBadge = (rate: number) => {
    if (rate >= 90) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-800' };
    if (rate >= 75) return { label: 'Good', color: 'bg-blue-100 text-blue-800' };
    if (rate >= 60) return { label: 'Average', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Perlu Perbaikan', color: 'bg-red-100 text-red-800' };
  };

  const completionBadge = getPerformaBadge(stats.completionRate);
  const onTimeBadge = getPerformaBadge(stats.onTimeRate);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/courier')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Kembali
          </Button>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Hari</SelectItem>
              <SelectItem value="14">14 Hari</SelectItem>
              <SelectItem value="30">30 Hari</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <h1 className="text-xl font-bold">Laporan Performa</h1>
          <p className="text-sm text-muted-foreground">{period} hari terakhir</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Performance Badge */}
            <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Award className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Skor Performa</p>
                    <p className="text-3xl font-bold text-emerald-700">
                      {Math.round((stats.completionRate + stats.onTimeRate) / 2)}%
                    </p>
                    <Badge className={`text-xs mt-1 ${completionBadge.color}`}>{completionBadge.label}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Pengiriman', value: stats.totalDeliveries, icon: Package, sub: `${stats.completedDeliveries} selesai` },
                { label: 'Total Pendapatan', value: formatPrice(stats.totalEarnings), icon: TrendingUp, sub: 'periode ini' },
                { label: 'Tingkat Selesai', value: `${stats.completionRate}%`, icon: CheckCircle, sub: completionBadge.label },
                { label: 'Tepat Waktu', value: `${stats.onTimeRate}%`, icon: Clock, sub: onTimeBadge.label },
              ].map((s, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <s.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Progress Bars */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Detail Performa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span>Tingkat Penyelesaian</span>
                    <span className="font-semibold">{stats.completionRate}%</span>
                  </div>
                  <Progress value={stats.completionRate} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span>Ketepatan Waktu (≤2 jam)</span>
                    <span className="font-semibold">{stats.onTimeRate}%</span>
                  </div>
                  <Progress value={stats.onTimeRate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Daily Chart */}
            {dailyStats.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pengiriman Harian</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={dailyStats.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="deliveries" fill="#10b981" radius={[4, 4, 0, 0]} name="Pengiriman" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
