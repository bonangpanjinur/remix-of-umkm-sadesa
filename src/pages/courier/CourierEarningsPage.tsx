import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Wallet, 
  TrendingUp, 
  Package, 
  Calendar,
  ArrowLeft,
  Clock,
  CheckCircle
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';

interface DeliveryHistory {
  id: string;
  status: string;
  total: number;
  shipping_cost: number;
  delivered_at: string | null;
  created_at: string;
  delivery_name: string | null;
  delivery_address: string | null;
}

interface EarningsStats {
  totalEarnings: number;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  totalDeliveries: number;
  completedDeliveries: number;
}

export default function CourierEarningsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [courierId, setCourierId] = useState<string | null>(null);
  const [history, setHistory] = useState<DeliveryHistory[]>([]);
  const [stats, setStats] = useState<EarningsStats>({
    totalEarnings: 0,
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    totalDeliveries: 0,
    completedDeliveries: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    } else if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Get courier ID
      const { data: courier } = await supabase
        .from('couriers')
        .select('id')
        .eq('user_id', user.id)
        .eq('registration_status', 'APPROVED')
        .maybeSingle();

      if (!courier) {
        navigate('/courier');
        return;
      }

      setCourierId(courier.id);

      // Fetch all delivered orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total, shipping_cost, delivered_at, created_at, delivery_name, delivery_address')
        .eq('courier_id', courier.id)
        .order('created_at', { ascending: false });

      const allOrders = orders || [];
      setHistory(allOrders);

      // Calculate stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const completedOrders = allOrders.filter(o => o.status === 'DELIVERED' || o.status === 'DONE');
      
      // Commission is typically 80% of shipping cost for courier
      const calculateEarnings = (orders: DeliveryHistory[]) => 
        orders.reduce((sum, o) => sum + (o.shipping_cost * 0.8), 0);

      const todayOrders = completedOrders.filter(o => 
        o.delivered_at && new Date(o.delivered_at) >= todayStart
      );
      const weekOrders = completedOrders.filter(o => 
        o.delivered_at && new Date(o.delivered_at) >= weekStart
      );
      const monthOrders = completedOrders.filter(o => 
        o.delivered_at && new Date(o.delivered_at) >= monthStart
      );

      setStats({
        totalEarnings: calculateEarnings(completedOrders),
        todayEarnings: calculateEarnings(todayOrders),
        weekEarnings: calculateEarnings(weekOrders),
        monthEarnings: calculateEarnings(monthOrders),
        totalDeliveries: allOrders.length,
        completedDeliveries: completedOrders.length,
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/courier')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3"
        >
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Pendapatan Bulan Ini
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatPrice(stats.monthEarnings)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Hari Ini
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{formatPrice(stats.todayEarnings)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Total Pengiriman
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalDeliveries}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Selesai
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-500">{stats.completedDeliveries}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ringkasan Pendapatan</CardTitle>
            </CardHeader>
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

        {/* Delivery History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">Semua</TabsTrigger>
              <TabsTrigger value="completed" className="flex-1">Selesai</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1">Proses</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4 space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Belum ada riwayat pengiriman</p>
                </div>
              ) : (
                history.map((order) => (
                  <DeliveryCard key={order.id} order={order} />
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-4 space-y-3">
              {history.filter(o => o.status === 'DELIVERED' || o.status === 'DONE').map((order) => (
                <DeliveryCard key={order.id} order={order} />
              ))}
            </TabsContent>

            <TabsContent value="pending" className="mt-4 space-y-3">
              {history.filter(o => !['DELIVERED', 'DONE', 'CANCELED'].includes(o.status)).map((order) => (
                <DeliveryCard key={order.id} order={order} />
              ))}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}

function DeliveryCard({ order }: { order: DeliveryHistory }) {
  const isCompleted = order.status === 'DELIVERED' || order.status === 'DONE';
  const earnings = order.shipping_cost * 0.8;

  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-mono text-sm font-medium">#{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.created_at).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
      </div>
      <Badge variant={isCompleted ? 'default' : 'secondary'} className={isCompleted ? 'bg-primary/10 text-primary' : ''}>
        {isCompleted ? 'Selesai' : order.status}
      </Badge>
    </div>

    <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
      {order.delivery_name} • {order.delivery_address || 'Alamat tidak tersedia'}
    </p>

      <div className="flex justify-between items-center pt-2 border-t border-border">
        <span className="text-sm text-muted-foreground">Ongkir: {formatPrice(order.shipping_cost)}</span>
        <span className="font-bold text-primary">+{formatPrice(earnings)}</span>
      </div>
    </div>
  );
}
