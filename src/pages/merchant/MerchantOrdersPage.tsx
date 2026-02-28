import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Receipt, Check, X, Package, MoreHorizontal, User, MapPin, Phone, Truck, CreditCard, MessageSquare, Printer, RefreshCw, Wifi, Search, Download, TrendingUp, Clock, CheckCircle2, ImageIcon, Navigation } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { MerchantDeliveryTracker } from '@/components/merchant/MerchantDeliveryTracker';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

// Use OrderRow from the hook, extending with payment_proof_url
import type { OrderRow as HookOrderRow } from '@/hooks/useRealtimeOrders';
type OrderRow = HookOrderRow;

export default function MerchantOrdersPage() {
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Fetch merchant info
  useEffect(() => {
    const fetchMerchant = async () => {
      if (!user) return;

      try {
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id, name, notification_sound_enabled')
          .eq('user_id', user.id)
          .maybeSingle();

        if (merchant) {
          setMerchantId(merchant.id);
          setMerchantName(merchant.name);
          setSoundEnabled(merchant.notification_sound_enabled ?? true);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchMerchant();
  }, [user]);

  // Real-time orders hook
  const handleNewOrder = useCallback((order: OrderRow) => {
    setDetailDialogOpen(false);
  }, []);

  const { orders, loading, updateOrderStatus, refetch } = useRealtimeOrders({
    merchantId,
    onNewOrder: handleNewOrder,
  });

  // Handle orderId query parameter from notification click
  useEffect(() => {
    const orderIdFromUrl = searchParams.get('orderId');
    if (orderIdFromUrl && orders.length > 0) {
      const order = orders.find(o => o.id === orderIdFromUrl);
      if (order) {
        viewOrderDetail(order);
        // Clean up URL after opening detail
        searchParams.delete('orderId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, setSearchParams, orders]);

  // Connection status listener
  useEffect(() => {
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const viewOrderDetail = useCallback(async (order: OrderRow) => {
    setSelectedOrder(order);
    
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    setOrderItems(items || []);
    setDetailDialogOpen(true);
  }, []);

  const openPrintDialog = useCallback(async (order: OrderRow) => {
    setSelectedOrder(order);
    
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    setOrderItems(items || []);
    setPrintDialogOpen(true);
  }, []);

  const handlePrint = () => {
    if (invoiceRef.current) {
      printInvoice(invoiceRef.current);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string, reason?: string) => {
    const success = await updateOrderStatus(orderId, newStatus, reason);
    if (success) {
      setDetailDialogOpen(false);
      setRejectDialogOpen(false);
      setRejectReason('');
    }
  };

  const handleSelfDelivery = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          is_self_delivery: true,
          status: 'DELIVERING',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('Self delivery update error:', error);
        toast.error(`Gagal mengubah status: ${error.message}`);
        return;
      }
      
      toast.success('Pesanan akan diantar sendiri');
      setDetailDialogOpen(false);
      refetch();
    } catch (error: any) {
      console.error('Self delivery error:', error);
      toast.error(`Gagal mengubah status: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleSelfDeliveryStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const updateData: Record<string, unknown> = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      if (newStatus === 'DELIVERED') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      
      toast.success('Status pengiriman diperbarui');
      setDetailDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal mengubah status');
    }
  };

  const handleVerifyPayment = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          payment_status: 'PAID', 
          payment_paid_at: new Date().toISOString(),
          status: 'PROCESSED',
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      
      toast.success('Pembayaran berhasil diverifikasi');
      setDetailDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Error verifying payment:', error);
      toast.error('Gagal memverifikasi pembayaran');
    }
  };

  const openRejectDialog = (order: OrderRow) => {
    setSelectedOrder(order);
    setRejectDialogOpen(true);
  };

  const handleReject = () => {
    if (selectedOrder && rejectReason.trim()) {
      handleUpdateStatus(selectedOrder.id, 'CANCELED', rejectReason);
    }
  };


  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'pending' }> = {
      'NEW': { label: 'Baru', variant: 'info' },
      'PENDING_PAYMENT': { label: 'Menunggu Bayar', variant: 'warning' },
      'PENDING_CONFIRMATION': { label: 'Menunggu', variant: 'warning' },
      'PROCESSED': { label: 'Diproses', variant: 'pending' },
      'DELIVERING': { label: 'Diantar Sendiri', variant: 'info' },
      'SENT': { label: 'Dikirim', variant: 'info' },
      'DELIVERED': { label: 'Sampai', variant: 'warning' },
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
          {item.delivery_type === 'PICKUP' ? 'Ambil Sendiri' : 
           item.is_self_delivery ? 'Antar Sendiri' : 'Diantar'}
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
            {/* Payment verification for PENDING_PAYMENT orders */}
            {item.status === 'PENDING_PAYMENT' && item.payment_proof_url && (
              <DropdownMenuItem onClick={() => handleVerifyPayment(item.id)}>
                <Check className="h-4 w-4 mr-2" />
                Verifikasi Pembayaran
              </DropdownMenuItem>
            )}
            {item.status === 'PENDING_PAYMENT' && !item.payment_proof_url && (
              <DropdownMenuItem disabled className="text-muted-foreground">
                <Clock className="h-4 w-4 mr-2" />
                Menunggu Bukti Bayar
              </DropdownMenuItem>
            )}
            {(item.status === 'NEW' || item.status === 'PENDING_CONFIRMATION') && (
              <>
                <DropdownMenuItem onClick={() => handleUpdateStatus(item.id, 'PROCESSED')}>
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
              item.delivery_type === 'PICKUP' ? (
                <DropdownMenuItem onClick={() => handleUpdateStatus(item.id, 'SENT')}>
                  <Package className="h-4 w-4 mr-2" />
                  Siap Diambil
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => viewOrderDetail(item)}>
                   <Truck className="h-4 w-4 mr-2" />
                   Kirim Pesanan
                 </DropdownMenuItem>
              )
            )}
            {item.status === 'DELIVERING' && (
              <DropdownMenuItem onClick={() => handleSelfDeliveryStatusUpdate(item.id, 'DELIVERED')}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Sudah Sampai
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
        { value: 'PENDING_PAYMENT', label: 'Menunggu Bayar' },
        { value: 'PENDING_CONFIRMATION', label: 'Menunggu Konfirmasi' },
        { value: 'PROCESSED', label: 'Diproses' },
        { value: 'DELIVERING', label: 'Antar Sendiri' },
        { value: 'SENT', label: 'Dikirim' },
        { value: 'DELIVERED', label: 'Sampai' },
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

  const stats = {
    new: orders.filter(o => o.status === 'NEW').length,
    processed: orders.filter(o => o.status === 'PROCESSED').length,
    sent: orders.filter(o => ['SENT', 'DELIVERING'].includes(o.status)).length,
    done: orders.filter(o => o.status === 'DONE').length,
    total_revenue: orders.filter(o => o.status === 'DONE').reduce((acc, curr) => acc + curr.subtotal, 0)
  };

  const handleExport = (data: OrderRow[]) => {
    const headers = ['ID Pesanan', 'Pelanggan', 'Telepon', 'Total', 'Status', 'Pembayaran', 'Metode', 'Tipe Pengiriman', 'Tanggal'];
    const csvData = data.map(order => [
      `#${order.id.slice(0, 8).toUpperCase()}`,
      order.delivery_name || '-',
      order.delivery_phone || '-',
      order.total,
      order.status,
      order.payment_status || '-',
      order.payment_method || '-',
      order.delivery_type,
      new Date(order.created_at).toLocaleDateString('id-ID')
    ]);

    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pesanan-merchant-${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <MerchantLayout title="Pesanan" subtitle="Kelola pesanan masuk">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-info/5 border-info/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center text-info">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pesanan Baru</p>
              <p className="text-2xl font-bold">{stats.new}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center text-warning">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Diproses</p>
              <p className="text-2xl font-bold">{stats.processed}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Selesai</p>
              <p className="text-2xl font-bold">{stats.done}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pendapatan</p>
              <p className="text-lg font-bold">{formatPrice(stats.total_revenue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">
            {orders.length} pesanan
          </span>
          {orders.filter(o => o.status === 'NEW').length > 0 && (
            <Badge variant="info">{orders.filter(o => o.status === 'NEW').length} baru</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Wifi className={`h-3.5 w-3.5 ${isConnected ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            <span className={isConnected ? 'text-primary' : 'text-muted-foreground'}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DataTable
        data={orders}
        columns={columns}
        searchKeys={['id', 'delivery_name', 'delivery_phone']}
        searchPlaceholder="Cari ID, nama, atau telepon..."
        filters={filters}
        loading={loading}
        onRowClick={viewOrderDetail}
        onExport={handleExport}
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
                  {selectedOrder.delivery_type === 'PICKUP' ? 'Ambil Sendiri' : 
                   selectedOrder.is_self_delivery ? 'Antar Sendiri' : 'Diantar Kurir'}
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

              {/* Payment Proof */}
              {selectedOrder.payment_proof_url && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Bukti Pembayaran</span>
                  </div>
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img
                      src={selectedOrder.payment_proof_url}
                      alt="Bukti pembayaran"
                      className="w-full max-h-64 object-contain bg-secondary/30 cursor-pointer"
                      onClick={() => window.open(selectedOrder.payment_proof_url!, '_blank')}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Klik gambar untuk memperbesar</p>
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
              {/* Payment Verification for PENDING_PAYMENT */}
              {selectedOrder.status === 'PENDING_PAYMENT' && (
                <div className="space-y-3">
                  {selectedOrder.payment_proof_url ? (
                    <Button 
                      className="w-full"
                      onClick={() => handleVerifyPayment(selectedOrder.id)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Verifikasi Pembayaran
                    </Button>
                  ) : (
                    <div className="w-full bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Menunggu pembeli mengunggah bukti pembayaran
                      </p>
                    </div>
                  )}
                  <Button 
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      setDetailDialogOpen(false);
                      openRejectDialog(selectedOrder);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Tolak Pesanan
                  </Button>
                </div>
              )}
              {/* Actions for NEW / PENDING_CONFIRMATION */}
              {(selectedOrder.status === 'NEW' || selectedOrder.status === 'PENDING_CONFIRMATION') && (
                <div className="flex gap-2">
                  <Button 
                    className="flex-1"
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'PROCESSED')}
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
              {/* PROCESSED: show delivery choice for INTERNAL, or ready for PICKUP */}
              {selectedOrder.status === 'PROCESSED' && (
                selectedOrder.delivery_type === 'PICKUP' ? (
                  <Button 
                    className="w-full"
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'SENT')}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Siap Diambil
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Pilih Metode Pengiriman:</p>
                    <Button 
                      className="w-full justify-start gap-3 h-auto py-4"
                      variant="outline"
                      onClick={() => handleSelfDelivery(selectedOrder.id)}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm">Antar Sendiri</p>
                        <p className="text-xs text-muted-foreground">Anda mengirim langsung ke pembeli</p>
                      </div>
                    </Button>
                    <Button 
                      className="w-full justify-start gap-3 h-auto py-4"
                      variant="outline"
                      onClick={async () => {
                        const { error } = await supabase
                          .from('orders')
                          .update({ 
                            status: 'ASSIGNED',
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', selectedOrder.id);
                        
                        if (error) {
                          toast.error('Gagal mengubah status');
                        } else {
                          toast.success('Pesanan menunggu penugasan kurir desa');
                          refetch();
                        }
                        setDetailDialogOpen(false);
                      }}
                    >
                      <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0">
                        <Truck className="h-5 w-5 text-info" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm">Kurir Desa</p>
                        <p className="text-xs text-muted-foreground">Dikirim oleh kurir desa</p>
                      </div>
                    </Button>
                  </div>
                )
              )}
              {/* DELIVERING (self-delivery): location tracker + mark as delivered */}
              {selectedOrder.status === 'DELIVERING' && merchantId && (
                <>
                  <MerchantDeliveryTracker
                    orderId={selectedOrder.id}
                    merchantId={merchantId}
                  />
                  <Button 
                    className="w-full"
                    onClick={() => handleSelfDeliveryStatusUpdate(selectedOrder.id, 'DELIVERED')}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Sudah Sampai
                  </Button>
                </>
              )}
              {selectedOrder.status === 'DELIVERED' && (
                <div className="w-full bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Menunggu pembeli menyelesaikan pesanan (otomatis selesai dalam 24 jam)
                  </p>
                </div>
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
