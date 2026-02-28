import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, Receipt, TrendingUp, DollarSign, AlertCircle, Settings,
  BarChart3, Star, Wallet, Percent, CreditCard, QrCode, CheckCircle, XCircle, Bell, Eye
} from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { SalesAreaChart, OrdersBarChart } from '@/components/admin/SalesChart';
import { QuickStats } from '@/components/merchant/QuickStats';
import { StockAlerts } from '@/components/merchant/StockAlerts';
import { CustomerReviews } from '@/components/merchant/CustomerReviews';
import { OrderStatusManager } from '@/components/merchant/OrderStatusManager';
import { QuotaStatusCard } from '@/components/merchant/QuotaStatusCard';
import { QuotaAlertBanner } from '@/components/merchant/QuotaAlertBanner';
import { MerchantGroupCard } from '@/components/merchant/MerchantGroupCard';
import { MerchantKasCard } from '@/components/merchant/MerchantKasCard';
import { DailySummaryCard } from '@/components/merchant/DailySummaryCard';
import { StoreQRCode } from '@/components/merchant/StoreQRCode';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useRealtimeOrders, type OrderRow } from '@/hooks/useRealtimeOrders';

interface MerchantData {
  id: string;
  name: string;
  is_open: boolean;
  status: string;
  registration_status: string;
  image_url: string | null;
  slug: string | null;
}

interface OrderData {
  id: string;
  status: string;
  total: number;
  subtotal?: number;
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
          .select('id, name, is_open, status, registration_status, image_url, slug')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!merchantData) {
          setLoading(false);
          return;
        }

        setMerchant(merchantData);

        // Parallel fetch orders after getting merchant ID
        const [ordersResult] = await Promise.all([
          supabase
            .from('orders')
            .select('id, status, total, created_at')
            .eq('merchant_id', merchantData.id)
            .order('created_at', { ascending: false })
            .limit(500),
        ]);

        setOrders(ordersResult.data || []);
      } catch (error) {
        console.error('Error fetching merchant data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Realtime orders with sound notification
  const handleNewOrder = useCallback((order: OrderRow) => {
    // Also refresh local orders
    if (merchant) {
      supabase
        .from('orders')
        .select('id, status, total, subtotal, created_at')
        .eq('merchant_id', merchant.id)
        .then(({ data }) => setOrders(data || []));
    }
  }, [merchant]);

  const { orders: realtimeOrders, updateOrderStatus } = useRealtimeOrders({
    merchantId: merchant?.id || null,
    onNewOrder: handleNewOrder,
  });

  // New orders waiting for action
  const pendingOrders = realtimeOrders.filter(o => o.status === 'NEW' || o.status === 'PENDING_CONFIRMATION').slice(0, 5);

  const salesChartData = useMemo(() => {
    const dateMap = new Map<string, { revenue: number; orders: number }>();
    
    orders.forEach((order) => {
      const date = order.created_at.split('T')[0];
      const existing = dateMap.get(date) || { revenue: 0, orders: 0 };
      dateMap.set(date, {
        revenue: existing.revenue + (order.status === 'DONE' ? (order.subtotal || order.total) : 0),
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
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
        <h2 className="font-bold text-base text-foreground">
          {new Date().getHours() < 12 ? '🌅 Selamat Pagi' : new Date().getHours() < 17 ? '☀️ Selamat Siang' : '🌙 Selamat Malam'}, {merchant.name}!
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {pendingOrders.length > 0
            ? `Anda punya ${pendingOrders.length} pesanan baru menunggu konfirmasi.`
            : 'Semua pesanan sudah ditangani. Kerja bagus! 🎉'}
        </p>
      </div>

      {/* 1. Quota Alert Banner - High priority, at the top */}
      <QuotaAlertBanner />

      {/* 2. Store Status Card - Optimized for space */}
      <div className="bg-card rounded-xl border border-border p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {merchant.image_url ? (
              <img src={merchant.image_url} alt={merchant.name} className="w-10 h-10 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-base leading-tight">{merchant.name}</h3>
              <p className="text-xs text-muted-foreground">
                {merchant.is_open ? 'Toko sedang buka' : 'Toko sedang tutup'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => navigate(`/merchant/${merchant.slug || merchant.id}`)}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Lihat Toko
            </Button>
            <StoreQRCode 
              merchantId={merchant.id} 
              merchantName={merchant.name}
              merchantImage={merchant.image_url}
              slug={merchant.slug}
            />
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-full border border-border">
              <div className={`w-2 h-2 rounded-full ${merchant.is_open ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
              <Label className="text-xs font-medium cursor-pointer" htmlFor="store-status">
                {merchant.is_open ? 'Buka' : 'Tutup'}
              </Label>
              <Switch
                id="store-status"
                checked={merchant.is_open}
                onCheckedChange={toggleStoreStatus}
                disabled={updatingStatus}
                className="scale-75 origin-right"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Quota, Group Status, and Kas Card */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <QuotaStatusCard />
        <MerchantGroupCard />
        <MerchantKasCard merchantId={merchant.id} />
      </div>

      {/* Daily Summary */}
      <div className="mb-4">
        <DailySummaryCard merchantId={merchant.id} />
      </div>

      {/* Quick Stats - Compact */}
      <div className="mb-4">
        <QuickStats merchantId={merchant.id} />
      </div>

      {/* Tabs - Main Content Area */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full sticky top-[73px] z-20 bg-background/95 backdrop-blur shadow-sm border border-border rounded-lg p-1">
          <TabsTrigger value="overview" className="flex items-center gap-2 text-xs lg:text-sm py-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2 text-xs lg:text-sm py-2">
            <Receipt className="h-3.5 w-3.5" />
            Pesanan
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-2 text-xs lg:text-sm py-2">
            <Package className="h-3.5 w-3.5" />
            Stok
          </TabsTrigger>
          <TabsTrigger value="more" className="flex items-center gap-2 text-xs lg:text-sm py-2">
            <BarChart3 className="h-3.5 w-3.5" />
            Lainnya
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-0">
          {/* Quick Action: Pending Orders */}
          {pendingOrders.length > 0 ? (
            <div className="bg-card rounded-xl border border-warning/30 p-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Bell className="h-4 w-4 text-warning" />
                Pesanan Menunggu ({pendingOrders.length})
              </h4>
              <div className="space-y-2">
                {pendingOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium">{order.delivery_name || 'Pelanggan'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(order.total)} • {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => updateOrderStatus(order.id, 'CANCELED', 'Ditolak oleh merchant')}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Tolak
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => updateOrderStatus(order.id, 'PROCESSED')}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Terima
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-success/30 p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Semua Pesanan Ditangani</p>
                <p className="text-xs text-muted-foreground">Tidak ada pesanan yang menunggu konfirmasi saat ini.</p>
              </div>
            </div>
          )}

          {/* Charts - Reduced height or better layout */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border p-1 overflow-hidden">
              <SalesAreaChart data={salesChartData} title="Pendapatan (14 Hari)" />
            </div>
            <div className="bg-card rounded-xl border border-border p-1 overflow-hidden">
              <OrdersBarChart data={salesChartData} title="Pesanan (14 Hari)" />
            </div>
          </div>

          {/* Stock Alerts and Recent Reviews */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                Peringatan Stok
              </h4>
              <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <StockAlerts merchantId={merchant.id} />
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-1 overflow-hidden">
              <div className="max-h-[465px] overflow-y-auto custom-scrollbar">
                <CustomerReviews merchantId={merchant.id} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-0">
          <div className="bg-card rounded-xl border border-border p-1 min-h-[400px]">
            <OrderStatusManager merchantId={merchant.id} />
          </div>
        </TabsContent>

        <TabsContent value="stock" className="mt-0">
          <div className="bg-card rounded-xl border border-border p-4 min-h-[400px]">
            <StockAlerts merchantId={merchant.id} />
          </div>
        </TabsContent>

        <TabsContent value="more" className="mt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
              onClick={() => navigate('/merchant/products')}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-medium">Produk</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
              onClick={() => navigate('/merchant/analytics')}
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-xs font-medium">Analitik</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
              onClick={() => navigate('/merchant/reviews')}
            >
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
              <span className="text-xs font-medium">Ulasan</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
              onClick={() => navigate('/merchant/promo')}
            >
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Percent className="h-5 w-5 text-purple-500" />
              </div>
              <span className="text-xs font-medium">Promo</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
              onClick={() => navigate('/merchant/withdrawal')}
            >
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-green-500" />
              </div>
              <span className="text-xs font-medium">Penarikan</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
              onClick={() => navigate('/merchant/settings')}
            >
              <div className="w-10 h-10 rounded-full bg-gray-500/10 flex items-center justify-center">
                <Settings className="h-5 w-5 text-gray-500" />
              </div>
              <span className="text-xs font-medium">Pengaturan</span>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </MerchantLayout>
  );
}
