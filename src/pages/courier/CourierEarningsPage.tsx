import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, Package, CheckCircle, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';

interface EarningRecord {
  id: string;
  amount: number;
  type: string;
  status: string;
  order_id: string | null;
  created_at: string;
  paid_at: string | null;
}

interface EarningsStats {
  totalEarnings: number;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  totalDeliveries: number;
  paidEarnings: number;
}

export default function CourierEarningsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [stats, setStats] = useState<EarningsStats>({ totalEarnings: 0, todayEarnings: 0, weekEarnings: 0, monthEarnings: 0, totalDeliveries: 0, paidEarnings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) fetchData();
    else if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const { data: courier } = await supabase.from('couriers').select('id, registration_status').eq('user_id', user.id).maybeSingle();
      if (!courier || courier.registration_status !== 'APPROVED') { navigate('/courier'); return; }

      const { data } = await supabase
        .from('courier_earnings')
        .select('*')
        .eq('courier_id', courier.id)
        .order('created_at', { ascending: false });

      const all = data || [];
      setEarnings(all);

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const sum = (items: EarningRecord[]) => items.reduce((s, e) => s + e.amount, 0);

      setStats({
        totalEarnings: sum(all),
        todayEarnings: sum(all.filter(e => new Date(e.created_at) >= todayStart)),
        weekEarnings: sum(all.filter(e => new Date(e.created_at) >= weekStart)),
        monthEarnings: sum(all.filter(e => new Date(e.created_at) >= monthStart)),
        totalDeliveries: all.length,
        paidEarnings: sum(all.filter(e => e.status === 'PAID')),
      });
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const pendingEarnings = earnings.filter(e => e.status === 'PENDING');
  const paidEarnings = earnings.filter(e => e.status === 'PAID');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/courier')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Bulan Ini
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatPrice(stats.monthEarnings)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Hari Ini
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">{formatPrice(stats.todayEarnings)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" /> Total Transaksi
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.totalDeliveries}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" /> Sudah Dibayar
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-500">{formatPrice(stats.paidEarnings)}</p></CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader><CardTitle className="text-lg">Ringkasan Pendapatan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Minggu Ini</span>
                <span className="font-bold">{formatPrice(stats.weekEarnings)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Bulan Ini</span>
                <span className="font-bold">{formatPrice(stats.monthEarnings)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Total Keseluruhan</span>
                <span className="font-bold text-primary">{formatPrice(stats.totalEarnings)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">Semua</TabsTrigger>
              <TabsTrigger value="delivery" className="flex-1">Delivery</TabsTrigger>
              <TabsTrigger value="ride" className="flex-1">Ojek</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1">Pending</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4 space-y-3">
              {earnings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Belum ada riwayat pendapatan</p>
                </div>
              ) : earnings.map(e => <EarningCard key={e.id} earning={e} />)}
            </TabsContent>
            <TabsContent value="delivery" className="mt-4 space-y-3">
              {earnings.filter(e => e.type === 'DELIVERY').length === 0 ? <p className="text-center py-8 text-muted-foreground">Tidak ada pendapatan delivery</p> : earnings.filter(e => e.type === 'DELIVERY').map(e => <EarningCard key={e.id} earning={e} />)}
            </TabsContent>
            <TabsContent value="ride" className="mt-4 space-y-3">
              {earnings.filter(e => e.type === 'RIDE').length === 0 ? <p className="text-center py-8 text-muted-foreground">Tidak ada pendapatan ojek</p> : earnings.filter(e => e.type === 'RIDE').map(e => <EarningCard key={e.id} earning={e} />)}
            </TabsContent>
            <TabsContent value="pending" className="mt-4 space-y-3">
              {pendingEarnings.length === 0 ? <p className="text-center py-8 text-muted-foreground">Tidak ada pending</p> : pendingEarnings.map(e => <EarningCard key={e.id} earning={e} />)}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}

function EarningCard({ earning }: { earning: EarningRecord }) {
  const isPaid = earning.status === 'PAID';
  const typeLabel = earning.type === 'DELIVERY' ? 'Pengiriman' : earning.type === 'RIDE' ? 'Ojek' : earning.type;

  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-mono text-sm font-medium">#{(earning.order_id || earning.id).slice(0, 8).toUpperCase()}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(earning.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline">{typeLabel}</Badge>
          <Badge variant={isPaid ? 'default' : 'secondary'} className={isPaid ? 'bg-green-500/10 text-green-600' : ''}>
            {isPaid ? 'Dibayar' : 'Pending'}
          </Badge>
        </div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-border">
        <span className="text-sm text-muted-foreground">Komisi</span>
        <span className="font-bold text-primary">+{formatPrice(earning.amount)}</span>
      </div>
    </div>
  );
}
