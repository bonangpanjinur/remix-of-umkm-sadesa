import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, Receipt, TrendingUp, DollarSign, AlertCircle, Settings,
  BarChart3, Star, Wallet, Percent, CreditCard
} from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { SalesAreaChart, OrdersBarChart } from '@/components/admin/SalesChart';
import { QuickStats } from '@/components/merchant/QuickStats';
import { StockAlerts } from '@/components/merchant/StockAlerts';
import { OrderStatusManager } from '@/components/merchant/OrderStatusManager';
import { QuotaStatusCard } from '@/components/merchant/QuotaStatusCard';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';

interface MerchantData {
  id: string;
  name: string;
  is_open: boolean;
  status: string;
  registration_status: string;
}

interface OrderData {
  id: string;
  status: string;
  total: number;
  created_at: string;
}

export default function MerchantDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const { data: merchantData } = await supabase
          .from('merchants')
          .select('id, name, is_open, status, registration_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!merchantData) {
          setLoading(false);
          return;
        }

        setMerchant(merchantData);

        const { data: ordersData } = await supabase
          .from('orders')
          .select('id, status, total, created_at')
          .eq('merchant_id', merchantData.id);

        setOrders(ordersData || []);
      } catch (error) {
        console.error('Error fetching merchant data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const salesChartData = useMemo(() => {
    const dateMap = new Map<string, { revenue: number; orders: number }>();
    
    orders.forEach((order) => {
      const date = order.created_at.split('T')[0];
      const existing = dateMap.get(date) || { revenue: 0, orders: 0 };
      dateMap.set(date, {
        revenue: existing.revenue + (order.status === 'DONE' ? order.total : 0),
        orders: existing.orders + 1,
      });
    });

    const result: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const data = dateMap.get(date) || { revenue: 0, orders: 0 };
      result.push({ date, ...data });
    }
    
    return result;
  }, [orders]);

  const toggleStoreStatus = async (isOpen: boolean) => {
    if (!merchant) return;
    setUpdatingStatus(true);

    try {
      const { error } = await supabase
        .from('merchants')
        .update({ is_open: isOpen })
        .eq('id', merchant.id);

      if (error) throw error;

      setMerchant({ ...merchant, is_open: isOpen });
      toast.success(isOpen ? 'Toko sekarang buka' : 'Toko sekarang tutup');
    } catch (error) {
      toast.error('Gagal mengubah status toko');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <MerchantLayout title="Dashboard" subtitle="Ringkasan toko Anda">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  if (!merchant) {
    return (
      <MerchantLayout title="Dashboard" subtitle="Ringkasan toko Anda">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="font-bold text-lg mb-2">Toko Belum Terdaftar</h2>
          <p className="text-muted-foreground mb-4">
            Anda belum memiliki toko. Daftar sekarang untuk mulai berjualan.
          </p>
          <Button onClick={() => navigate('/register/merchant')}>
            Daftar Sebagai Merchant
          </Button>
        </div>
      </MerchantLayout>
    );
  }

  if (merchant.registration_status === 'PENDING') {
    return (
      <MerchantLayout title="Dashboard" subtitle="Ringkasan toko Anda">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="font-bold text-lg mb-2">Menunggu Persetujuan</h2>
          <p className="text-muted-foreground max-w-md">
            Pendaftaran toko Anda sedang dalam proses review. 
            Kami akan memberitahu Anda setelah disetujui.
          </p>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Dashboard" subtitle="Ringkasan toko Anda">
      {/* Store Status Card */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{merchant.name}</h3>
            <p className="text-sm text-muted-foreground">
              {merchant.is_open ? 'Toko sedang buka' : 'Toko sedang tutup'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${merchant.is_open ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
            <Label className="font-medium">
              {merchant.is_open ? 'Buka' : 'Tutup'}
            </Label>
            <Switch
              checked={merchant.is_open}
              onCheckedChange={toggleStoreStatus}
              disabled={updatingStatus}
            />
          </div>
        </div>
      </div>

      {/* Quota Status Card */}
      <div className="mb-6">
        <QuotaStatusCard />
      </div>

      {/* Quick Stats */}
      <div className="mb-6">
        <QuickStats merchantId={merchant.id} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Pesanan
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Stok
          </TabsTrigger>
          <TabsTrigger value="more" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Lainnya
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            <SalesAreaChart data={salesChartData} title="Pendapatan 14 Hari Terakhir" />
            <OrdersBarChart data={salesChartData} title="Jumlah Pesanan 14 Hari Terakhir" />
          </div>

          {/* Stock Alerts */}
          <StockAlerts merchantId={merchant.id} />
        </TabsContent>

        <TabsContent value="orders">
          <OrderStatusManager merchantId={merchant.id} />
        </TabsContent>

        <TabsContent value="stock">
          <StockAlerts merchantId={merchant.id} />
        </TabsContent>

        <TabsContent value="more" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-6 flex flex-col items-center gap-2"
              onClick={() => navigate('/merchant/products')}
            >
              <Package className="h-8 w-8" />
              <span>Kelola Produk</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-6 flex flex-col items-center gap-2"
              onClick={() => navigate('/merchant/analytics')}
            >
              <BarChart3 className="h-8 w-8" />
              <span>Analitik</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-6 flex flex-col items-center gap-2"
              onClick={() => navigate('/merchant/reviews')}
            >
              <Star className="h-8 w-8" />
              <span>Ulasan</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-6 flex flex-col items-center gap-2"
              onClick={() => navigate('/merchant/promo')}
            >
              <Percent className="h-8 w-8" />
              <span>Promo</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-6 flex flex-col items-center gap-2"
              onClick={() => navigate('/merchant/withdrawal')}
            >
              <Wallet className="h-8 w-8" />
              <span>Penarikan</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-6 flex flex-col items-center gap-2"
              onClick={() => navigate('/merchant/settings')}
            >
              <Settings className="h-8 w-8" />
              <span>Pengaturan</span>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </MerchantLayout>
  );
}
