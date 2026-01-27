import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Package, 
  MapPin, 
  Phone, 
  User,
  RefreshCw,
  Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeliveryStatusCard } from '@/components/courier/DeliveryStatusCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface OrderDetails {
  id: string;
  status: string;
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  total: number;
  subtotal: number;
  shipping_cost: number;
  created_at: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  courier_id: string | null;
}

interface CourierInfo {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
}

export default function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [courier, setCourier] = useState<CourierInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user && orderId) {
      fetchOrderDetails();
      
      // Set up realtime subscription for order status updates
      const channel = supabase
        .channel(`order-tracking-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            const updated = payload.new as OrderDetails;
            setOrder(updated);
            // Refetch courier if assigned
            if (updated.courier_id && !courier) {
              fetchCourierInfo(updated.courier_id);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, orderId]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;

    try {
      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      
      if (!orderData) {
        toast({
          title: 'Pesanan tidak ditemukan',
          variant: 'destructive',
        });
        navigate('/orders');
        return;
      }

      setOrder(orderData as unknown as OrderDetails);

      // Fetch courier if assigned
      if (orderData.courier_id) {
        fetchCourierInfo(orderData.courier_id);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: 'Gagal memuat data pesanan',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCourierInfo = async (courierId: string) => {
    const { data: courierData, error: courierError } = await supabase
      .from('couriers')
      .select('id, name, phone, vehicle_type')
      .eq('id', courierId)
      .maybeSingle();

    if (!courierError && courierData) {
      setCourier(courierData);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-bold text-lg mb-2">Pesanan Tidak Ditemukan</h2>
          <Button onClick={() => navigate('/orders')}>
            Kembali ke Pesanan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-bold">Lacak Pesanan</h1>
            <p className="text-xs text-muted-foreground">
              #{order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={fetchOrderDetails}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Delivery Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <DeliveryStatusCard 
            order={{
              status: order.status as any,
              created_at: order.created_at,
              assigned_at: order.assigned_at,
              picked_up_at: order.picked_up_at,
              delivered_at: order.delivered_at,
            }}
          />
        </motion.div>

        {/* Courier Info */}
        {courier && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl p-4 border border-border"
          >
            <h3 className="font-medium text-sm text-muted-foreground mb-3">Kurir Pengantar</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{courier.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  {courier.vehicle_type === 'motor' ? 'Motor' : courier.vehicle_type}
                </p>
              </div>
              <a
                href={`tel:${courier.phone}`}
                className="p-3 bg-primary/10 rounded-full"
              >
                <Phone className="h-5 w-5 text-primary" />
              </a>
            </div>
          </motion.div>
        )}

        {/* Delivery Address */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl p-4 border border-border"
        >
          <h3 className="font-medium text-sm text-muted-foreground mb-3">Alamat Pengiriman</h3>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">{order.delivery_name}</p>
              <p className="text-sm text-muted-foreground">{order.delivery_address}</p>
              {order.delivery_phone && (
                <p className="text-sm text-muted-foreground mt-1">{order.delivery_phone}</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Order Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl p-4 border border-border"
        >
          <h3 className="font-medium text-sm text-muted-foreground mb-3">Ringkasan Pembayaran</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>Rp {order.subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ongkir</span>
              <span>Rp {order.shipping_cost.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary">Rp {order.total.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
