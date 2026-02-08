import { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, 
  Eye, 
  MoreHorizontal, 
  Package, 
  Truck, 
  AlertCircle, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  Check
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/DataTable';
import { CourierAssignDialog } from '@/components/admin/CourierAssignDialog';
import { OrderDetailsDialog } from '@/components/order/OrderDetailsDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/admin/StatsCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice, cn } from '@/lib/utils';

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
  payment_proof_url: string | null;
  delivery_type: string;
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  subtotal: number;
  shipping_cost: number;
  total: number;
  notes: string | null;
  created_at: string;
  courier_id: string | null;
  merchants: { name: string } | null;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [courierAssignDialogOpen, setCourierAssignDialogOpen] = useState(false);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, merchants(name)')
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

  useEffect(() => {
    fetchOrders();

    // Real-time subscription
    const channel = supabase
      .channel('admin-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const viewOrderDetail = async (order: OrderRow) => {
    setSelectedOrder(order);
    
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    setOrderItems(items || []);
    setDetailDialogOpen(true);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      
      if (newStatus === 'DONE') {
        updateData.delivered_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      
      toast.success('Status pesanan diperbarui');
      setDetailDialogOpen(false);
    } catch (error) {
      toast.error('Gagal mengubah status');
    }
  };

  const verifyPayment = async (orderId: string) => {
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
      fetchOrders();
    } catch (error) {
      toast.error('Gagal memverifikasi pembayaran');
    }
  };

  const openAssignDialog = (order: OrderRow) => {
    setSelectedOrder(order);
    setCourierAssignDialogOpen(true);
  };

  const handleExport = (data: OrderRow[]) => {
    if (data.length === 0) return;
    
    const headers = ['ID', 'Merchant', 'Pelanggan', 'Total', 'Status', 'Pembayaran', 'Tanggal'];
    const csvData = data.map(o => [
      o.id,
      o.merchants?.name || '-',
      o.delivery_name || '-',
      o.total,
      o.status,
      o.payment_status || '-',
      new Date(o.created_at).toLocaleString('id-ID')
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pesanan-umkm-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Data pesanan berhasil diekspor');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'destructive' | 'pending' }> = {
      'NEW': { label: 'Baru', variant: 'info' },
      'PENDING_PAYMENT': { label: 'Menunggu Bayar', variant: 'warning' },
      'PENDING_CONFIRMATION': { label: 'Menunggu Konfirmasi', variant: 'warning' },
      'CONFIRMED': { label: 'Dikonfirmasi', variant: 'info' },
      'PROCESSED': { label: 'Diproses', variant: 'warning' },
      'SENT': { label: 'Dikirim', variant: 'pending' },
      'DELIVERED': { label: 'Sampai', variant: 'warning' },
      'DONE': { label: 'Selesai', variant: 'success' },
      'CANCELLED': { label: 'Dibatalkan', variant: 'destructive' },
      'CANCELED': { label: 'Dibatalkan', variant: 'destructive' },
    };
    
    const config = statusMap[status] || { label: status, variant: 'default' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentBadge = (paymentStatus: string | null) => {
    const statusMap: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'destructive' | 'pending' }> = {
      'UNPAID': { label: 'Belum Bayar', variant: 'warning' },
      'PENDING': { label: 'Menunggu', variant: 'info' },
      'PAID': { label: 'Lunas', variant: 'success' },
      'EXPIRED': { label: 'Expired', variant: 'destructive' },
      'COD': { label: 'COD', variant: 'pending' },
    };
    
    const config = statusMap[paymentStatus || 'UNPAID'] || { label: paymentStatus || '-', variant: 'warning' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const stats = useMemo(() => {
    const totalRevenue = orders
      .filter(o => o.status === 'DONE' && o.payment_status === 'PAID')
      .reduce((acc, curr) => acc + curr.total, 0);
    
    return {
      total: orders.length,
      new: orders.filter(o => o.status === 'NEW').length,
      processing: orders.filter(o => ['CONFIRMED', 'PROCESSED', 'SENT'].includes(o.status)).length,
      done: orders.filter(o => o.status === 'DONE').length,
      revenue: totalRevenue
    };
  }, [orders]);

  const columns = [
    {
      key: 'id',
      header: 'ID Pesanan',
      render: (item: OrderRow) => (
        <span className="font-mono text-xs">#{item.id.slice(0, 8).toUpperCase()}</span>
      ),
    },
    {
      key: 'merchant',
      header: 'Merchant',
      render: (item: OrderRow) => (
        <span className="font-medium text-sm">{item.merchants?.name || '-'}</span>
      ),
    },
    {
      key: 'customer',
      header: 'Pelanggan',
      render: (item: OrderRow) => (
        <div>
          <p className="font-medium text-sm">{item.delivery_name || 'Pelanggan'}</p>
          <p className="text-[10px] text-muted-foreground">{item.delivery_phone || '-'}</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (item: OrderRow) => (
        <span className="font-semibold">{formatPrice(item.total)}</span>
      ),
    },
    {
      key: 'payment_status',
      header: 'Pembayaran',
      render: (item: OrderRow) => getPaymentBadge(item.payment_status),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: OrderRow) => getStatusBadge(item.status),
    },
    {
      key: 'created_at',
      header: 'Tanggal',
      render: (item: OrderRow) => (
        <span className="text-xs text-muted-foreground">
          {new Date(item.created_at).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: OrderRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => viewOrderDetail(item)}>
              <Eye className="h-4 w-4 mr-2" />
              Lihat Detail
            </DropdownMenuItem>
            {item.delivery_type === 'INTERNAL' && !item.courier_id && (
              <DropdownMenuItem onClick={() => openAssignDialog(item)}>
                <Truck className="h-4 w-4 mr-2" />
                Tugaskan Kurir
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {/* Payment verification */}
            {item.status === 'PENDING_PAYMENT' && item.payment_proof_url && (
              <DropdownMenuItem onClick={() => verifyPayment(item.id)}>
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
                <DropdownMenuItem onClick={() => updateOrderStatus(item.id, 'PROCESSED')}>
                  <Package className="h-4 w-4 mr-2" />
                  Terima & Proses
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => updateOrderStatus(item.id, 'CANCELLED')} 
                  className="text-destructive"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
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
            {/* Pesanan hanya bisa diselesaikan oleh pembeli atau sistem otomatis */}
            {['NEW', 'PROCESSED', 'PENDING_PAYMENT'].includes(item.status) && (
              <DropdownMenuItem 
                onClick={() => updateOrderStatus(item.id, 'CANCELLED')}
                className="text-destructive"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Batalkan
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
        { value: 'CONFIRMED', label: 'Dikonfirmasi' },
        { value: 'PROCESSED', label: 'Diproses' },
        { value: 'SENT', label: 'Dikirim' },
        { value: 'DELIVERED', label: 'Sampai' },
        { value: 'DONE', label: 'Selesai' },
        { value: 'CANCELLED', label: 'Dibatalkan' },
      ],
    },
    {
      key: 'payment_status',
      label: 'Pembayaran',
      options: [
        { value: 'UNPAID', label: 'Belum Bayar' },
        { value: 'PENDING', label: 'Menunggu' },
        { value: 'PAID', label: 'Lunas' },
        { value: 'COD', label: 'COD' },
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

  return (
    <AdminLayout title="Manajemen Pesanan" subtitle="Pantau dan kelola semua transaksi masuk">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Pesanan"
            value={stats.total}
            icon={<Receipt className="h-5 w-5" />}
            description="Semua pesanan masuk"
          />
          <StatsCard
            title="Pesanan Baru"
            value={stats.new}
            icon={<Clock className="h-5 w-5" />}
            description="Perlu segera diproses"
            className={cn(stats.new > 0 && "border-primary/50 bg-primary/5")}
          />
          <StatsCard
            title="Sedang Diproses"
            value={stats.processing}
            icon={<Package className="h-5 w-5" />}
            description="Dalam pengiriman/proses"
          />
          <StatsCard
            title="Total Pendapatan"
            value={formatPrice(stats.revenue)}
            icon={<TrendingUp className="h-5 w-5" />}
            description="Dari pesanan selesai"
          />
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <DataTable
            data={orders}
            columns={columns}
            searchKeys={['id', 'delivery_name', 'delivery_phone']}
            searchPlaceholder="Cari ID, pelanggan, atau telepon..."
            filters={filters}
            loading={loading}
            onExport={handleExport}
            emptyMessage="Belum ada pesanan yang sesuai"
          />
        </div>
      </div>

      <OrderDetailsDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        order={selectedOrder}
        orderItems={orderItems}
        onUpdateStatus={updateOrderStatus}
        onVerifyPayment={verifyPayment}
        onOpenAssignCourier={openAssignDialog}
        getStatusBadge={getStatusBadge}
        getPaymentBadge={getPaymentBadge}
      />

      {selectedOrder && (
        <CourierAssignDialog
          open={courierAssignDialogOpen}
          onOpenChange={setCourierAssignDialogOpen}
          orderId={selectedOrder.id}
          onSuccess={() => {
            fetchOrders();
            setDetailDialogOpen(false);
          }}
        />
      )}
    </AdminLayout>
  );
}
