import { useState, useEffect } from 'react';
import { Package, Truck, MapPin, CreditCard, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';

interface OrderDetailSheetProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrderDetail {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  shipping_cost: number;
  delivery_type: string;
  delivery_address: string | null;
  delivery_name: string | null;
  delivery_phone: string | null;
  payment_method: string | null;
  payment_status: string | null;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
  merchant: { name: string } | null;
  courier: { name: string; phone: string } | null;
  items: Array<{
    id: string;
    product_name: string;
    product_price: number;
    quantity: number;
    subtotal: number;
  }>;
}

const statusTimeline = [
  { key: 'NEW', label: 'Pesanan Dibuat', icon: Clock },
  { key: 'PENDING_CONFIRMATION', label: 'Menunggu Konfirmasi', icon: Clock },
  { key: 'PROCESSED', label: 'Diproses', icon: Package },
  { key: 'SENT', label: 'Dikirim', icon: Truck },
  { key: 'DELIVERED', label: 'Sampai Tujuan', icon: CheckCircle },
  { key: 'DONE', label: 'Selesai', icon: CheckCircle },
];

const statusOrder = ['NEW', 'PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'PROCESSING', 'PROCESSED', 'ASSIGNED', 'PICKED_UP', 'ON_DELIVERY', 'SENT', 'DELIVERED', 'DONE'];

export function OrderDetailSheet({ orderId, open, onOpenChange }: OrderDetailSheetProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orderId && open) {
      fetchOrder(orderId);
    }
  }, [orderId, open]);

  const fetchOrder = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, status, total, subtotal, shipping_cost, delivery_type,
          delivery_address, delivery_name, delivery_phone,
          payment_method, payment_status, notes, created_at,
          confirmed_at, delivered_at,
          merchants(name),
          couriers(name, phone),
          order_items(id, product_name, product_price, quantity, subtotal)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setOrder({
          ...data,
          merchant: data.merchants as any,
          courier: data.couriers as any,
          items: data.order_items || [],
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentStatusIdx = order ? statusOrder.indexOf(order.status) : -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Pesanan</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : order ? (
          <div className="space-y-4">
            {/* Order ID & Merchant */}
            <div>
              <p className="text-xs text-muted-foreground font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
              <p className="font-semibold">{order.merchant?.name || 'Toko'}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString('id-ID', {
                  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>

            <Separator />

            {/* Items */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" /> Item Pesanan
              </h4>
              <div className="space-y-2">
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div>
                      <p>{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity}x {formatPrice(item.product_price)}</p>
                    </div>
                    <p className="font-medium">{formatPrice(item.subtotal)}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Pricing */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ongkir</span>
                <span>{formatPrice(order.shipping_cost)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                <span>Total</span>
                <span className="text-primary">{formatPrice(order.total)}</span>
              </div>
            </div>

            <Separator />

            {/* Delivery Info */}
            {order.delivery_address && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Alamat Pengiriman
                </h4>
                <p className="text-sm">{order.delivery_name}</p>
                <p className="text-xs text-muted-foreground">{order.delivery_phone}</p>
                <p className="text-xs text-muted-foreground mt-1">{order.delivery_address}</p>
              </div>
            )}

            {/* Payment */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Pembayaran
              </h4>
              <div className="flex items-center gap-2">
                <Badge variant={order.payment_status === 'PAID' ? 'default' : 'outline'}>
                  {order.payment_method === 'COD' ? 'Bayar di Tempat' : order.payment_method || 'Transfer'}
                </Badge>
                <Badge variant={order.payment_status === 'PAID' ? 'default' : 'destructive'}>
                  {order.payment_status === 'PAID' ? 'Lunas' : 'Belum Bayar'}
                </Badge>
              </div>
            </div>

            {/* Courier */}
            {order.courier && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Kurir
                </h4>
                <p className="text-sm">{order.courier.name}</p>
                <p className="text-xs text-muted-foreground">{order.courier.phone}</p>
              </div>
            )}

            {/* Status Timeline */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Status</h4>
              <div className="space-y-3">
                {statusTimeline.map((step, idx) => {
                  const stepIdx = statusOrder.indexOf(step.key);
                  const isActive = currentStatusIdx >= stepIdx;
                  const isCanceled = order.status === 'CANCELED';
                  const Icon = isCanceled && idx === 0 ? XCircle : step.icon;

                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isActive && !isCanceled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className={`text-sm ${isActive && !isCanceled ? 'font-medium' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
                {order.status === 'CANCELED' && (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground">
                      <XCircle className="h-3 w-3" />
                    </div>
                    <span className="text-sm font-medium text-destructive">Dibatalkan</span>
                  </div>
                )}
              </div>
            </div>

            {order.notes && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-medium mb-1">Catatan:</p>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Pesanan tidak ditemukan</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
