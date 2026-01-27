import { useState, useEffect } from 'react';
import { Package, Clock, Truck, CheckCircle, XCircle, MessageCircle, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Order {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  shipping_cost: number;
  delivery_type: string;
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  payment_method: string | null;
  payment_status: string | null;
  notes: string | null;
  created_at: string;
  confirmation_deadline: string | null;
}

interface OrderStatusManagerProps {
  merchantId: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  'PENDING_CONFIRMATION': { label: 'Konfirmasi', color: 'bg-yellow-500', icon: Clock },
  'NEW': { label: 'Baru', color: 'bg-blue-500', icon: Package },
  'PROCESSED': { label: 'Diproses', color: 'bg-purple-500', icon: Package },
  'SENT': { label: 'Dikirim', color: 'bg-orange-500', icon: Truck },
  'DONE': { label: 'Selesai', color: 'bg-green-500', icon: CheckCircle },
  'CANCELED': { label: 'Batal', color: 'bg-destructive', icon: XCircle },
  'REJECTED_BY_BUYER': { label: 'Ditolak Pembeli', color: 'bg-red-700', icon: XCircle },
};

export function OrderStatusManager({ merchantId }: OrderStatusManagerProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchOrders();
  }, [merchantId]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const updateData: Record<string, any> = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'PROCESSED') {
        updateData.confirmed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: newStatus } : o
      ));
      toast.success('Status pesanan diperbarui');
    } catch (error) {
      toast.error('Gagal memperbarui status');
    } finally {
      setUpdating(false);
    }
  };

  const rejectOrder = async () => {
    if (!selectedOrder) return;
    setUpdating(true);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'CANCELED',
          notes: rejectReason ? `Dibatalkan pedagang: ${rejectReason}` : 'Dibatalkan oleh pedagang'
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      setOrders(prev => prev.map(o => 
        o.id === selectedOrder.id ? { ...o, status: 'CANCELED' } : o
      ));
      toast.success('Pesanan dibatalkan');
      setShowRejectDialog(false);
      setRejectReason('');
      setSelectedOrder(null);
    } catch (error) {
      toast.error('Gagal membatalkan pesanan');
    } finally {
      setUpdating(false);
    }
  };

  const openWhatsApp = (phone: string, orderId: string) => {
    const message = encodeURIComponent(
      `Halo, ini dari toko kami. Pesanan #${orderId.slice(0, 8).toUpperCase()} Anda sedang kami proses. Ada yang bisa kami bantu?`
    );
    const formattedPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  const filterOrders = (status: string) => {
    switch (status) {
      case 'pending':
        return orders.filter(o => ['PENDING_CONFIRMATION', 'NEW'].includes(o.status));
      case 'processing':
        return orders.filter(o => o.status === 'PROCESSED');
      case 'shipping':
        return orders.filter(o => o.status === 'SENT');
      case 'completed':
        return orders.filter(o => ['DONE', 'CANCELED', 'REJECTED_BY_BUYER'].includes(o.status));
      default:
        return orders;
    }
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const flow: Record<string, string> = {
      'PENDING_CONFIRMATION': 'PROCESSED',
      'NEW': 'PROCESSED',
      'PROCESSED': 'SENT',
      'SENT': 'DONE',
    };
    return flow[currentStatus] || null;
  };

  const getNextStatusLabel = (currentStatus: string): string => {
    const labels: Record<string, string> = {
      'PENDING_CONFIRMATION': 'Terima & Proses',
      'NEW': 'Proses Pesanan',
      'PROCESSED': 'Kirim Pesanan',
      'SENT': 'Selesaikan',
    };
    return labels[currentStatus] || '';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kelola Pesanan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Kelola Pesanan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="pending" className="relative">
                Baru
                {filterOrders('pending').length > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {filterOrders('pending').length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="processing">Diproses</TabsTrigger>
              <TabsTrigger value="shipping">Dikirim</TabsTrigger>
              <TabsTrigger value="completed">Selesai</TabsTrigger>
            </TabsList>

            {['pending', 'processing', 'shipping', 'completed'].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-3">
                {filterOrders(tab).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Tidak ada pesanan
                  </p>
                ) : (
                  filterOrders(tab).map((order) => {
                    const config = STATUS_CONFIG[order.status] || STATUS_CONFIG['NEW'];
                    const StatusIcon = config.icon;
                    const nextStatus = getNextStatus(order.status);

                    return (
                      <div 
                        key={order.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium">
                                #{order.id.slice(0, 8).toUpperCase()}
                              </span>
                              <Badge className={`${config.color} text-white`}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                              {order.payment_method === 'COD' && (
                                <Badge variant="outline" className="border-warning text-warning">
                                  COD
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(order.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                            </p>
                          </div>
                          <p className="font-bold text-lg">{formatPrice(order.total)}</p>
                        </div>

                        {order.delivery_name && (
                          <div className="bg-muted/50 rounded-lg p-3 text-sm">
                            <p className="font-medium">{order.delivery_name}</p>
                            {order.delivery_phone && (
                              <p className="text-muted-foreground">{order.delivery_phone}</p>
                            )}
                            {order.delivery_address && (
                              <p className="text-muted-foreground text-xs mt-1">
                                {order.delivery_address}
                              </p>
                            )}
                            {order.notes && (
                              <p className="text-xs mt-2 italic">
                                Catatan: {order.notes}
                              </p>
                            )}
                          </div>
                        )}

                        {order.status === 'PENDING_CONFIRMATION' && order.confirmation_deadline && (
                          <div className="bg-warning/10 border border-warning/30 rounded-lg p-2 text-xs text-warning">
                            <Clock className="h-3 w-3 inline mr-1" />
                            Konfirmasi sebelum: {format(new Date(order.confirmation_deadline), 'HH:mm', { locale: id })}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                          {order.delivery_phone && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openWhatsApp(order.delivery_phone!, order.id)}
                              >
                                <MessageCircle className="h-4 w-4 mr-1" />
                                WhatsApp
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`tel:${order.delivery_phone}`, '_self')}
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
                            </>
                          )}

                          <div className="flex-1" />

                          {!['DONE', 'CANCELED', 'REJECTED_BY_BUYER'].includes(order.status) && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowRejectDialog(true);
                                }}
                              >
                                Batalkan
                              </Button>
                              
                              {nextStatus && (
                                <Button
                                  size="sm"
                                  onClick={() => updateOrderStatus(order.id, nextStatus)}
                                  disabled={updating}
                                >
                                  {getNextStatusLabel(order.status)}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Pesanan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Apakah Anda yakin ingin membatalkan pesanan #{selectedOrder?.id.slice(0, 8).toUpperCase()}?
            </p>
            <Textarea
              placeholder="Alasan pembatalan (opsional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Batal
            </Button>
            <Button 
              variant="destructive" 
              onClick={rejectOrder}
              disabled={updating}
            >
              Ya, Batalkan Pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
