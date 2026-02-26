import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Package, 
  MapPin, 
  Phone, 
  User,
  RefreshCw,
  Truck,
  CheckCircle,
  RotateCcw,
  MessageCircle,
  Store,
  ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeliveryStatusCard } from '@/components/courier/DeliveryStatusCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefundRequestDialog } from '@/components/order/RefundRequestDialog';
import { OrderChat, ChatType } from '@/components/chat/OrderChat';
import { CourierMap } from '@/components/CourierMap';

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
  merchant_id: string | null;
  buyer_id: string | null;
  pod_image_url: string | null;
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
  const [completing, setCompleting] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState<{ type: ChatType; userId: string; name: string } | null>(null);
  const [merchantInfo, setMerchantInfo] = useState<{ userId: string; name: string } | null>(null);
  const [orderItems, setOrderItems] = useState<Array<{ id: string; product_name: string; quantity: number; product_price: number; subtotal: number; product_id: string | null; products?: { image_url: string | null } | null }>>([]);
  const courierRef = useRef<CourierInfo | null>(null);

  // Keep ref in sync
  useEffect(() => { courierRef.current = courier; }, [courier]);

  useEffect(() => {
    if (!authLoading && user && orderId) {
      fetchOrderDetails();
      
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
            if (updated.courier_id && !courierRef.current) {
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
        .eq('buyer_id', user!.id)
        .maybeSingle();

      if (orderError) throw orderError;
      
      if (!orderData) {
        toast.error('Pesanan tidak ditemukan');
        navigate('/orders');
        return;
      }

      setOrder(orderData as unknown as OrderDetails);

      // Fetch order items with product images
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('id, product_name, quantity, product_price, subtotal, product_id, products(image_url)')
        .eq('order_id', orderId);
      setOrderItems((itemsData as any) || []);

      // Fetch merchant info for chat
      if (orderData.merchant_id) {
        const { data: merchant } = await supabase
          .from('merchants')
          .select('user_id, name')
          .eq('id', orderData.merchant_id)
          .maybeSingle();
        if (merchant?.user_id) {
          setMerchantInfo({ userId: merchant.user_id, name: merchant.name });
        }
      }

      // Fetch courier if assigned
      if (orderData.courier_id) {
        fetchCourierInfo(orderData.courier_id);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Gagal memuat data pesanan');
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

  const handleCompleteOrder = async () => {
    if (!order || !user) return;
    setCompleting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'DONE', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('buyer_id', user.id)
        .eq('status', 'DELIVERED');

      if (error) throw error;
      toast.success('Pesanan telah diselesaikan');
      fetchOrderDetails();
    } catch (error) {
      console.error('Error completing order:', error);
      toast.error('Gagal menyelesaikan pesanan');
    } finally {
      setCompleting(false);
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

        {/* Live Tracking Map */}
        {courier && order.courier_id && ['ASSIGNED', 'PICKED_UP', 'SENT'].includes(order.status) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="bg-card rounded-2xl p-4 border border-border"
          >
            <h3 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Live Tracking Kurir
            </h3>
            <CourierMap courierId={order.courier_id} height="250px" />
          </motion.div>
        )}

        {/* Chat buttons */}
        {['ASSIGNED', 'PICKED_UP', 'SENT', 'DELIVERED'].includes(order.status) && courier && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                supabase.from('couriers').select('user_id').eq('id', order.courier_id!).maybeSingle().then(({ data }) => {
                  if (data?.user_id) setChatOpen({ type: 'buyer_courier', userId: data.user_id, name: courier.name });
                });
              }}
            >
              <MessageCircle className="h-4 w-4 mr-2" /> Chat Kurir
            </Button>
          </motion.div>
        )}

        {merchantInfo && !['DONE', 'CANCELLED', 'CANCELED'].includes(order.status) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setChatOpen({ type: 'buyer_merchant', userId: merchantInfo.userId, name: merchantInfo.name })}
            >
              <Store className="h-4 w-4 mr-2" /> Chat Penjual
            </Button>
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

        {/* Order Items */}
        {orderItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card rounded-2xl p-4 border border-border"
          >
            <h3 className="font-medium text-sm text-muted-foreground mb-3">Daftar Produk</h3>
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
                      {item.products?.image_url ? (
                        <img 
                          src={item.products.image_url} 
                          alt={item.product_name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity}x Rp {item.product_price.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                  <p className="text-sm font-medium flex-shrink-0">Rp {item.subtotal.toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

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

        {/* Buyer Actions for DELIVERED orders */}
        {order.status === 'DELIVERED' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            {/* Proof of Delivery Photo */}
            {order.pod_image_url && (
              <div className="bg-card rounded-2xl p-4 border border-border">
                <h3 className="font-medium text-sm text-muted-foreground mb-3">Bukti Pengiriman</h3>
                <img 
                  src={order.pod_image_url} 
                  alt="Bukti pengiriman" 
                  className="w-full h-48 object-cover rounded-xl border border-border"
                />
              </div>
            )}

            <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
              <div className="text-center mb-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-2 animate-pulse">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="font-bold text-primary text-sm">Pesanan Telah Sampai!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Konfirmasi penerimaan atau ajukan refund jika ada masalah.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Otomatis selesai dalam 24 jam jika tidak ada tindakan.
                </p>
              </div>
              <Button 
                className="w-full h-12 text-base font-bold shadow-brand"
                size="lg"
                onClick={handleCompleteOrder}
                disabled={completing}
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {completing ? 'Memproses...' : '✅ Pesanan Diterima - Selesaikan'}
              </Button>
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => setRefundDialogOpen(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Ada Masalah? Ajukan Refund
              </Button>
            </div>
          </motion.div>
        )}

        {/* Refund Dialog */}
        {order.status === 'DELIVERED' && (
          <RefundRequestDialog
            orderId={order.id}
            orderTotal={order.total}
            merchantId={order.merchant_id || ''}
            open={refundDialogOpen}
            onOpenChange={setRefundDialogOpen}
            onSuccess={fetchOrderDetails}
          />
        )}

        {/* Chat Dialog */}
        {chatOpen && orderId && (
          <OrderChat
            orderId={orderId}
            otherUserId={chatOpen.userId}
            otherUserName={chatOpen.name}
            chatType={chatOpen.type}
            isOpen={!!chatOpen}
            onClose={() => setChatOpen(null)}
          />
        )}
      </div>
    </div>
  );
}
