import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Package, 
  MapPin, 
  Phone, 
  Clock, 
  CheckCircle,
  Truck,
  Navigation,
  User,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CourierMap } from '@/components/CourierMap';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getDeliveryEstimate, formatETA, formatDistance, type VehicleType } from '@/lib/etaCalculation';

interface OrderDetails {
  id: string;
  status: string;
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  total: number;
  subtotal: number;
  shipping_cost: number;
  created_at: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  notes: string | null;
}

interface CourierInfo {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
}

export default function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [courier, setCourier] = useState<CourierInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && orderId) {
      fetchOrderDetails();
      
      // Set up realtime subscription for courier location updates
      const channel = supabase
        .channel(`order-tracking-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'couriers',
          },
          (payload) => {
            const updated = payload.new as any;
            if (courier && updated.id === courier.id) {
              setCourier({
                ...courier,
                current_lat: updated.current_lat,
                current_lng: updated.current_lng,
                last_location_update: updated.last_location_update,
              });
            }
          }
        )
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

  // Calculate ETA when courier location changes
  useEffect(() => {
    if (courier?.current_lat && courier?.current_lng && order?.delivery_lat && order?.delivery_lng) {
      const estimate = getDeliveryEstimate(
        { lat: courier.current_lat, lng: courier.current_lng },
        { lat: order.delivery_lat, lng: order.delivery_lng },
        (courier.vehicle_type as VehicleType) || 'motor'
      );
      setEta(estimate.etaFormatted);
      setDistance(estimate.distanceFormatted);
    }
  }, [courier?.current_lat, courier?.current_lng, order?.delivery_lat, order?.delivery_lng]);

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
        const { data: courierData, error: courierError } = await supabase
          .from('couriers')
          .select('id, name, phone, vehicle_type, current_lat, current_lng, last_location_update')
          .eq('id', orderData.courier_id)
          .maybeSingle();

        if (!courierError && courierData) {
          setCourier(courierData);
        }
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

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'NEW':
        return { label: 'Pesanan Baru', color: 'bg-blue-500', icon: Package };
      case 'PROCESSING':
        return { label: 'Diproses', color: 'bg-amber-500', icon: Package };
      case 'ASSIGNED':
        return { label: 'Kurir Ditugaskan', color: 'bg-purple-500', icon: Truck };
      case 'PICKED_UP':
        return { label: 'Diambil Kurir', color: 'bg-orange-500', icon: Truck };
      case 'ON_DELIVERY':
        return { label: 'Dalam Perjalanan', color: 'bg-primary', icon: Navigation };
      case 'DELIVERED':
        return { label: 'Terkirim', color: 'bg-green-500', icon: CheckCircle };
      default:
        return { label: status, color: 'bg-muted', icon: Package };
    }
  };

  const formatLastUpdate = (dateStr: string | null) => {
    if (!dateStr) return 'Tidak diketahui';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
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

  const statusInfo = getStatusInfo(order.status);
  const StatusIcon = statusInfo.icon;
  const showMap = courier && ['ASSIGNED', 'PICKED_UP', 'ON_DELIVERY'].includes(order.status);

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

      <div className="max-w-lg mx-auto">
        {/* Map Section */}
        {showMap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative"
          >
            <CourierMap courierId={courier.id} height="300px" />
            
            {/* ETA Overlay */}
            {eta && (
              <div className="absolute top-3 left-3 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg border border-border">
                <p className="text-xs text-muted-foreground">Estimasi tiba</p>
                <p className="font-bold text-lg text-primary">{eta}</p>
                {distance && (
                  <p className="text-xs text-muted-foreground">{distance} lagi</p>
                )}
              </div>
            )}
          </motion.div>
        )}

        <div className="p-4 space-y-4">
          {/* Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl p-5 border border-border"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${statusInfo.color} rounded-full flex items-center justify-center`}>
                <StatusIcon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                <p className="text-sm text-muted-foreground mt-1">
                  {order.status === 'ON_DELIVERY' && eta
                    ? `Tiba dalam ${eta}`
                    : new Date(order.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                  }
                </p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="mt-6 space-y-4">
              {[
                { status: 'NEW', label: 'Pesanan Dibuat', time: order.created_at },
                { status: 'ASSIGNED', label: 'Kurir Ditugaskan', time: order.assigned_at },
                { status: 'PICKED_UP', label: 'Pesanan Diambil', time: order.picked_up_at },
                { status: 'DELIVERED', label: 'Pesanan Diterima', time: order.delivered_at },
              ].map((step, index) => {
                const isCompleted = ['NEW', 'PROCESSING', 'ASSIGNED', 'PICKED_UP', 'ON_DELIVERY', 'DELIVERED']
                  .indexOf(order.status) >= ['NEW', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'].indexOf(step.status);
                
                return (
                  <div key={step.status} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full ${isCompleted ? 'bg-primary' : 'bg-muted'}`}>
                        {isCompleted && <CheckCircle className="w-4 h-4 text-primary-foreground" />}
                      </div>
                      {index < 3 && (
                        <div className={`w-0.5 h-8 ${isCompleted ? 'bg-primary' : 'bg-muted'}`} />
                      )}
                    </div>
                    <div className="flex-1 -mt-0.5">
                      <p className={`text-sm font-medium ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </p>
                      {step.time && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(step.time).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

              {courier.last_location_update && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Lokasi diperbarui {formatLastUpdate(courier.last_location_update)}
                </p>
              )}
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
    </div>
  );
}
