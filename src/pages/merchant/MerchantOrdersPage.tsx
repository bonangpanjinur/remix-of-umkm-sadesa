import { useState, useEffect, useRef } from 'react';
import { Receipt, Check, X, Package, MoreHorizontal, User, MapPin, Phone, Truck, CreditCard, MessageSquare, Printer } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { OrderInvoice, printInvoice } from '@/components/merchant/OrderInvoice';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

interface OrderRow {
  id: string;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  delivery_type: string;
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  subtotal: number;
  shipping_cost: number;
  total: number;
  notes: string | null;
  created_at: string;
}

export default function MerchantOrdersPage() {
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState<string>('');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;

      try {
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id, name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!merchant) {
          setLoading(false);
          return;
        }

        setMerchantId(merchant.id);
        setMerchantName(merchant.name);

        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('merchant_id', merchant.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } catch (error) {
        console.error('Error:', error);
        toast.error('Gagal memuat pesanan');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  const viewOrderDetail = async (order: OrderRow) => {
    setSelectedOrder(order);
    
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    setOrderItems(items || []);
    setDetailDialogOpen(true);
  };

  const openPrintDialog = async (order: OrderRow) => {
    setSelectedOrder(order);
    
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    setOrderItems(items || []);
    setPrintDialogOpen(true);
  };

  const handlePrint = () => {
    if (invoiceRef.current) {
      printInvoice(invoiceRef.current);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, reason?: string) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (reason) {
        updateData.rejection_reason = reason;
      }
      
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, status: newStatus } : o
      ));
      toast.success('Status pesanan diperbarui');
      setDetailDialogOpen(false);
      setRejectDialogOpen(false);
      setRejectReason('');
    } catch (error) {
      toast.error('Gagal mengubah status');
    }
  };

  const openRejectDialog = (order: OrderRow) => {
    setSelectedOrder(order);
    setRejectDialogOpen(true);
  };

  const handleReject = () => {
    if (selectedOrder && rejectReason.trim()) {
      updateOrderStatus(selectedOrder.id, 'CANCELED', rejectReason);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'pending' }> = {
      'NEW': { label: 'Baru', variant: 'info' },
      'PENDING_CONFIRMATION': { label: 'Menunggu', variant: 'warning' },
      'PROCESSED': { label: 'Diproses', variant: 'pending' },
      'SENT': { label: 'Dikirim', variant: 'info' },
      'DONE': { label: 'Selesai', variant: 'success' },
      'CANCELED': { label: 'Dibatalkan', variant: 'destructive' },
    };
    
    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentBadge = (status: string | null, method: string | null) => {
    if (method === 'COD') {
      return <Badge variant="pending">COD</Badge>;
    }
    const statusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' }> = {
      'PAID': { label: 'Lunas', variant: 'success' },
      'PENDING': { label: 'Menunggu', variant: 'warning' },
      'UNPAID': { label: 'Belum Bayar', variant: 'destructive' },
    };
    const config = statusMap[status || 'UNPAID'] || { label: status || '-', variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const columns = [
    {
      key: 'id',
      header: 'ID Pesanan',
      render: (item: OrderRow) => (
        <span className="font-mono text-sm">#{item.id.slice(0, 8).toUpperCase()}</span>
      ),
    },
    {
      key: 'customer',
      header: 'Pelanggan',
      render: (item: OrderRow) => (
        <div>
          <p className="font-medium">{item.delivery_name || 'Pelanggan'}</p>
          <p className="text-xs text-muted-foreground">{item.delivery_phone || '-'}</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (item: OrderRow) => formatPrice(item.total),
    },
    {
      key: 'payment',
      header: 'Pembayaran',
      render: (item: OrderRow) => getPaymentBadge(item.payment_status, item.payment_method),
    },
    {
      key: 'delivery_type',
      header: 'Pengiriman',
      render: (item: OrderRow) => (
        <Badge variant="outline">
          {item.delivery_type === 'PICKUP' ? 'Ambil Sendiri' : 'Diantar'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: OrderRow) => getStatusBadge(item.status),
    },
    {
      key: 'created_at',
      header: 'Tanggal',
      render: (item: OrderRow) => new Date(item.created_at).toLocaleDateString('id-ID'),
    },
    {
      key: 'actions',
      header: '',
      render: (item: OrderRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => viewOrderDetail(item)}>
              Lihat Detail
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openPrintDialog(item)}>
              <Printer className="h-4 w-4 mr-2" />
              Cetak Struk
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {item.status === 'NEW' && (
              <>
                <DropdownMenuItem onClick={() => updateOrderStatus(item.id, 'PROCESSED')}>
                  <Check className="h-4 w-4 mr-2" />
                  Terima Pesanan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openRejectDialog(item)} className="text-destructive">
                  <X className="h-4 w-4 mr-2" />
                  Tolak Pesanan
                </DropdownMenuItem>
              </>
            )}
            {item.status === 'PROCESSED' && (
              <DropdownMenuItem onClick={() => updateOrderStatus(item.id, 'SENT')}>
                <Truck className="h-4 w-4 mr-2" />
                Kirim
              </DropdownMenuItem>
            )}
            {item.status === 'SENT' && (
              <DropdownMenuItem onClick={() => updateOrderStatus(item.id, 'DONE')}>
                <Check className="h-4 w-4 mr-2" />
                Selesai
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filters = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'NEW', label: 'Baru' },
        { value: 'PROCESSED', label: 'Diproses' },
        { value: 'SENT', label: 'Dikirim' },
        { value: 'DONE', label: 'Selesai' },
        { value: 'CANCELED', label: 'Dibatalkan' },
      ],
    },
    {
      key: 'delivery_type',
      label: 'Pengiriman',
      options: [
        { value: 'PICKUP', label: 'Ambil Sendiri' },
        { value: 'INTERNAL', label: 'Diantar' },
      ],
    },
  ];

  const newOrdersCount = orders.filter(o => o.status === 'NEW').length;

  return (
    <MerchantLayout title="Pesanan" subtitle="Kelola pesanan masuk">
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="h-5 w-5 text-primary" />
        <span className="text-muted-foreground text-sm">
          {orders.length} pesanan
        </span>
        {newOrdersCount > 0 && (
          <Badge variant="info">{newOrdersCount} baru</Badge>
        )}
      </div>

      <DataTable
        data={orders}
        columns={columns}
        searchKey="delivery_name"
        searchPlaceholder="Cari nama pelanggan..."
        filters={filters}
        loading={loading}
        emptyMessage="Belum ada pesanan"
      />

      {/* Order Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detail Pesanan #{selectedOrder?.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              {/* Status Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  {getPaymentBadge(selectedOrder.payment_status, selectedOrder.payment_method)}
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium mb-2">Informasi Pengiriman</p>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedOrder.delivery_name || 'Pelanggan'}</span>
                </div>
                {selectedOrder.delivery_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`https://wa.me/${selectedOrder.delivery_phone.replace(/\D/g, '')}`} 
                       className="text-primary hover:underline"
                       target="_blank" rel="noopener noreferrer">
                      {selectedOrder.delivery_phone}
                    </a>
                  </div>
                )}
                {selectedOrder.delivery_address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{selectedOrder.delivery_address}</span>
                  </div>
                )}
                <Badge variant="outline" className="mt-2">
                  {selectedOrder.delivery_type === 'PICKUP' ? 'Ambil Sendiri' : 'Diantar Kurir'}
                </Badge>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Item Pesanan</p>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {orderItems.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between">
                      <div>
                        <p className="font-medium text-sm">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} x {formatPrice(item.product_price)}
                        </p>
                      </div>
                      <p className="font-medium text-sm">
                        {formatPrice(item.subtotal)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="text-sm bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Catatan:</span>
                  </div>
                  <p>{selectedOrder.notes}</p>
                </div>
              )}

              {/* Totals */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Ongkir</span>
                  <span>{formatPrice(selectedOrder.shipping_cost)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Actions */}
              {selectedOrder.status === 'NEW' && (
                <div className="flex gap-2">
                  <Button 
                    className="flex-1"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'PROCESSED')}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Terima Pesanan
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      setDetailDialogOpen(false);
                      openRejectDialog(selectedOrder);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Tolak
                  </Button>
                </div>
              )}
              {selectedOrder.status === 'PROCESSED' && (
                <Button 
                  className="w-full"
                  onClick={() => updateOrderStatus(selectedOrder.id, 'SENT')}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Kirim
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Pesanan</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Berikan alasan penolakan pesanan #{selectedOrder?.id.slice(0, 8).toUpperCase()}
            </p>
            <Textarea
              placeholder="Alasan penolakan..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Tolak Pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Invoice Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cetak Struk</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedOrder && (
              <OrderInvoice
                ref={invoiceRef}
                order={{
                  id: selectedOrder.id,
                  delivery_name: selectedOrder.delivery_name,
                  delivery_phone: selectedOrder.delivery_phone,
                  delivery_address: selectedOrder.delivery_address,
                  delivery_type: selectedOrder.delivery_type,
                  subtotal: selectedOrder.subtotal,
                  shipping_cost: selectedOrder.shipping_cost,
                  total: selectedOrder.total,
                  payment_method: selectedOrder.payment_method,
                  created_at: selectedOrder.created_at,
                  notes: selectedOrder.notes,
                }}
                items={orderItems}
                merchant={{
                  name: merchantName,
                  address: null,
                  phone: null,
                }}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
              Tutup
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Cetak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
