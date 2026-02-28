import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Package, 
  MapPin, 
  Clock, 
  Phone, 
  Navigation,
  CheckCircle,
  Truck,
  RefreshCw,
  User,
  LogOut,
  AlertCircle,
  Wallet,
  Camera,
  History,
  Banknote,
  Volume2,
  PiggyBank
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CourierLocationUpdater } from '@/components/CourierLocationUpdater';
import { NavigationButton } from '@/components/courier/NavigationButton';
import { ProofOfDelivery } from '@/components/courier/ProofOfDelivery';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatDistance, calculateDistance } from '@/lib/etaCalculation';
import { formatPrice } from '@/lib/utils';

interface CourierData {
  id: string;
  name: string;
  phone: string;
  is_available: boolean;
  vehicle_type: string;
  current_lat: number | null;
  current_lng: number | null;
  available_balance: number | null;
}

interface AssignedOrder {
  id: string;
  status: string;
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  total: number;
  created_at: string;
  notes: string | null;
}

export default function CourierDashboardPage() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const [courier, setCourier] = useState<CourierData | null>(null);
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [podOrderId, setPodOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      fetchCourierData();
    } else if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading]);

  // Real-time notification for new assigned orders
  useEffect(() => {
    if (!courier?.id) return;
    const channel = supabase
      .channel('courier-new-orders')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `courier_id=eq.${courier.id}`,
      }, (payload) => {
        if (payload.new && (payload.new as { status: string }).status === 'ASSIGNED') {
          // Play notification sound
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.value = 0.3;
            osc.start();
            setTimeout(() => { osc.frequency.value = 1100; }, 150);
            setTimeout(() => { osc.stop(); ctx.close(); }, 400);
          } catch {}
          toast({ title: '🚀 Pesanan Baru!', description: 'Anda mendapat tugas pengiriman baru' });
          fetchCourierData();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [courier?.id]);

  const fetchCourierData = async () => {
    if (!user) return;

    try {
      // Fetch courier profile
      const { data: courierData, error: courierError } = await supabase
        .from('couriers')
        .select('id, name, phone, is_available, vehicle_type, current_lat, current_lng, registration_status, available_balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (courierError) throw courierError;

      if (!courierData) {
        setLoading(false);
        return;
      }

      if (courierData.registration_status !== 'APPROVED') {
        toast({
          title: 'Akun dalam verifikasi',
          description: 'Pendaftaran kurir Anda sedang diproses oleh admin',
        });
        setLoading(false);
        return;
      }

      setCourier(courierData);

      // Fetch assigned orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('courier_id', courierData.id)
        .in('status', ['ASSIGNED', 'PICKED_UP', 'SENT'])
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error fetching courier data:', error);
      toast({
        title: 'Gagal memuat data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async (checked: boolean) => {
    if (!courier) return;
    setUpdatingStatus(true);

    try {
      const { error } = await supabase
        .from('couriers')
        .update({ is_available: checked })
        .eq('id', courier.id);

      if (error) throw error;

      setCourier({ ...courier, is_available: checked });
      toast({
        title: checked ? 'Anda sekarang online' : 'Anda sekarang offline',
      });
    } catch (error) {
      console.error('Error updating availability:', error);
      toast({
        title: 'Gagal mengubah status',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      
      if (newStatus === 'PICKED_UP') {
        updateData.picked_up_at = new Date().toISOString();
      } else if (newStatus === 'DELIVERED') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // Update local state
      if (newStatus === 'DELIVERED') {
        setOrders(orders.filter(o => o.id !== orderId));
      } else {
        setOrders(orders.map(o => 
          o.id === orderId ? { ...o, status: newStatus } : o
        ));
      }

      toast({ title: 'Status pesanan diperbarui' });
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: 'Gagal memperbarui status',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return <Badge variant="secondary">Ditugaskan</Badge>;
      case 'PICKED_UP':
        return <Badge variant="warning">Diambil</Badge>;
      case 'SENT':
        return <Badge variant="info">Dalam Perjalanan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getNextAction = (order: AssignedOrder) => {
    switch (order.status) {
      case 'ASSIGNED':
        return { label: 'Ambil Pesanan', nextStatus: 'PICKED_UP', needsPOD: false };
      case 'PICKED_UP':
        return { label: 'Mulai Antar', nextStatus: 'SENT', needsPOD: false };
      case 'SENT':
        return { label: 'Selesai + Foto', nextStatus: 'DELIVERED', needsPOD: true };
      default:
        return null;
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!courier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-bold text-lg mb-2">Akses Ditolak</h2>
          <p className="text-muted-foreground mb-4">
            Anda belum terdaftar sebagai kurir
          </p>
          <Button onClick={() => navigate('/register/courier')}>
            Daftar Sebagai Kurir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Courier Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-5 border border-border"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg">{courier.name}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" />
                {courier.vehicle_type === 'motor' ? 'Motor' : courier.vehicle_type}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          {/* Online/Offline Toggle */}
          <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${courier.is_available ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
              <div>
                <Label className="font-medium">
                  {courier.is_available ? 'Online' : 'Offline'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {courier.is_available ? 'Siap menerima pesanan' : 'Tidak menerima pesanan'}
                </p>
              </div>
            </div>
            <Switch
              checked={courier.is_available}
              onCheckedChange={toggleAvailability}
              disabled={updatingStatus}
            />
          </div>
        </motion.div>

        {/* Balance Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-80 flex items-center gap-1.5"><Wallet className="h-4 w-4" />Saldo Tersedia</span>
              <Link to="/courier/deposit" className="text-xs underline opacity-80 hover:opacity-100">Setor Saldo</Link>
            </div>
            <p className="text-2xl font-bold">{formatPrice(courier.available_balance || 0)}</p>
          </div>
        </motion.div>

        {/* Location Tracking */}
        {courier.is_available && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CourierLocationUpdater
              courierId={courier.id}
              onLocationUpdate={(lat, lng) => {
                setCourier({ ...courier, current_lat: lat, current_lng: lng });
              }}
            />
          </motion.div>
        )}

        {/* History Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <Link
            to="/courier/history"
            className="flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:bg-secondary transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Riwayat Pengiriman</p>
                <p className="text-sm text-muted-foreground">Lihat detail & bukti pengiriman</p>
              </div>
            </div>
            <Navigation className="h-4 w-4 text-muted-foreground" />
          </Link>
        </motion.div>

        {/* Earnings Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Link
            to="/courier/earnings"
            className="flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:bg-secondary transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Pendapatan</p>
                <p className="text-sm text-muted-foreground">Lihat riwayat & statistik</p>
              </div>
            </div>
            <Navigation className="h-4 w-4 text-muted-foreground" />
          </Link>
        </motion.div>

        {/* Withdrawal Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <Link
            to="/courier/withdrawal"
            className="flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:bg-secondary transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                <Banknote className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Penarikan Saldo</p>
                <p className="text-sm text-muted-foreground">Tarik saldo ke rekening bank</p>
              </div>
            </div>
            <Navigation className="h-4 w-4 text-muted-foreground" />
          </Link>
        </motion.div>

        {/* Orders Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pesanan Aktif
            </h3>
            <Button variant="ghost" size="sm" onClick={fetchCourierData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {orders.length === 0 ? (
            <div className="bg-card rounded-2xl p-8 border border-border text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Belum ada pesanan yang ditugaskan
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const action = getNextAction(order);
                const distance = courier.current_lat && courier.current_lng && order.delivery_lat && order.delivery_lng
                  ? calculateDistance(
                      { lat: courier.current_lat, lng: courier.current_lng },
                      { lat: order.delivery_lat, lng: order.delivery_lng }
                    )
                  : null;

                const handleAction = () => {
                  if (action?.needsPOD) {
                    setPodOrderId(order.id);
                  } else if (action) {
                    updateOrderStatus(order.id, action.nextStatus);
                  }
                };

                return (
                  <div
                    key={order.id}
                    className="bg-card rounded-xl p-4 border border-border"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-sm">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-start gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>{order.delivery_name || 'Pelanggan'}</span>
                      </div>
                      
                      {order.delivery_phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${order.delivery_phone}`} className="text-primary">
                            {order.delivery_phone}
                          </a>
                        </div>
                      )}

                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground">
                          {order.delivery_address || 'Alamat tidak tersedia'}
                        </span>
                      </div>

                      {distance !== null && (
                        <div className="flex items-center gap-2 text-sm">
                          <Navigation className="h-4 w-4 text-primary" />
                          <span className="text-primary font-medium">
                            {formatDistance(distance)}
                          </span>
                        </div>
                      )}

                      {order.notes && (
                        <div className="text-xs text-muted-foreground bg-secondary p-2 rounded-lg">
                          Catatan: {order.notes}
                        </div>
                      )}
                    </div>

                    {/* Navigation button */}
                    {order.delivery_lat && order.delivery_lng && (
                      <div className="mb-3">
                        <NavigationButton
                          lat={order.delivery_lat}
                          lng={order.delivery_lng}
                          address={order.delivery_address || undefined}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <p className="font-bold text-primary">
                        Rp {order.total.toLocaleString('id-ID')}
                      </p>
                      
                      {action && (
                        <Button
                          size="sm"
                          onClick={handleAction}
                        >
                          {action.needsPOD ? (
                            <Camera className="h-4 w-4 mr-1" />
                          ) : action.nextStatus === 'PICKED_UP' ? (
                            <Truck className="h-4 w-4 mr-1" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          {action.label}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* POD Dialog */}
      <ProofOfDelivery
        orderId={podOrderId || ''}
        open={!!podOrderId}
        onOpenChange={(open) => !open && setPodOrderId(null)}
        onSuccess={() => {
          setPodOrderId(null);
          fetchCourierData();
        }}
      />
    </div>
  );
}
