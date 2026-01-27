import { useState, useEffect } from 'react';
import { Receipt, Eye, MoreHorizontal, User, MapPin, Phone, Package, Truck, CreditCard, AlertCircle, Check, X } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';

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

interface Courier {
  id: string;
  name: string;
  phone: string;
  is_available: boolean;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<string>('');

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

  const fetchCouriers = async () => {
    const { data } = await supabase
      .from('couriers')
      .select('id, name, phone, is_available')
      .eq('status', 'ACTIVE')
      .eq('registration_status', 'APPROVED');
    
    setCouriers(data || []);
  };

  useEffect(() => {
    fetchOrders();
    fetchCouriers();
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
      
      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, status: newStatus } : o
      ));
      toast.success('Status pesanan diperbarui');
      setDetailDialogOpen(false);
    } catch (error) {
      toast.error('Gagal mengubah status');
    }
  };

  const openAssignDialog = (order: OrderRow) => {
    setSelectedOrder(order);
    setSelectedCourier(order.courier_id || '');
    setAssignDialogOpen(true);
  };

  const assignCourier = async () => {
    if (!selectedOrder || !selectedCourier) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          courier_id: selectedCourier,
          assigned_at: new Date().toISOString(),
          status: selectedOrder.status === 'NEW' ? 'PROCESSED' : selectedOrder.status,
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;
      
      toast.success('Kurir berhasil ditugaskan');
      fetchOrders();
      setAssignDialogOpen(false);
    } catch (error) {
      toast.error('Gagal menugaskan kurir');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'NEW': { label: 'Baru', className: 'bg-blue-100 text-blue-700' },
      'CONFIRMED': { label: 'Dikonfirmasi', className: 'bg-cyan-100 text-cyan-700' },
      'PROCESSED': { label: 'Diproses', className: 'bg-amber-100 text-amber-700' },
      'SENT': { label: 'Dikirim', className: 'bg-purple-100 text-purple-700' },
      'DONE': { label: 'Selesai', className: 'bg-green-100 text-green-700' },
      'CANCELLED': { label: 'Dibatalkan', className: 'bg-destructive/10 text-destructive' },
    };
    
    const config = statusMap[status] || { label: status, className: '' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getPaymentBadge = (paymentStatus: string | null) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'UNPAID': { label: 'Belum Bayar', className: 'bg-amber-100 text-amber-700' },
      'PENDING': { label: 'Menunggu', className: 'bg-blue-100 text-blue-700' },
      'PAID': { label: 'Lunas', className: 'bg-green-100 text-green-700' },
      'EXPIRED': { label: 'Expired', className: 'bg-destructive/10 text-destructive' },
      'COD': { label: 'COD', className: 'bg-purple-100 text-purple-700' },
    };
    
    const config = statusMap[paymentStatus || 'UNPAID'] || { label: paymentStatus || '-', className: '' };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
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
      key: 'merchant',
      header: 'Merchant',
      render: (item: OrderRow) => item.merchants?.name || '-',
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
            {item.status === 'NEW' && (
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
            {item.status === 'SENT' && (
              <DropdownMenuItem onClick={() => updateOrderStatus(item.id, 'DONE')}>
                Selesaikan
              </DropdownMenuItem>
            )}
            {['NEW', 'PROCESSED'].includes(item.status) && (
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
        { value: 'CONFIRMED', label: 'Dikonfirmasi' },
        { value: 'PROCESSED', label: 'Diproses' },
        { value: 'SENT', label: 'Dikirim' },
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

  const newOrdersCount = orders.filter(o => o.status === 'NEW').length;
  const unpaidCount = orders.filter(o => o.payment_status === 'UNPAID' || o.payment_status === 'PENDING').length;

  return (
    <AdminLayout title="Manajemen Pesanan" subtitle="Kelola semua pesanan">
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">{orders.length} pesanan</span>
        </div>
        {newOrdersCount > 0 && (
          <Badge className="bg-blue-100 text-blue-700">{newOrdersCount} baru</Badge>
        )}
        {unpaidCount > 0 && (
          <Badge variant="outline" className="border-amber-300 text-amber-700">
            <AlertCircle className="h-3 w-3 mr-1" />
            {unpaidCount} belum bayar
          </Badge>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Detail Pesanan #{selectedOrder?.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
              {/* Status Row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  {getPaymentBadge(selectedOrder.payment_status)}
                </div>
              </div>

              {/* Merchant */}
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Merchant</p>
                <p className="font-medium">{selectedOrder.merchants?.name || '-'}</p>
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
                    <span>{selectedOrder.delivery_phone}</span>
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
                  <p className="text-muted-foreground mb-1">Catatan:</p>
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

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                {selectedOrder.status === 'NEW' && (
                  <>
                    <Button 
                      className="flex-1"
                      onClick={() => updateOrderStatus(selectedOrder.id, 'PROCESSED')}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Terima & Proses
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => updateOrderStatus(selectedOrder.id, 'CANCELLED')}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Tolak
                    </Button>
                  </>
                )}
                {selectedOrder.status === 'PROCESSED' && (
                  <Button 
                    className="flex-1"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'SENT')}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Kirim
                  </Button>
                )}
                {selectedOrder.status === 'SENT' && (
                  <Button 
                    className="flex-1"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'DONE')}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Selesai
                  </Button>
                )}
                {selectedOrder.delivery_type === 'INTERNAL' && !selectedOrder.courier_id && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setDetailDialogOpen(false);
                      openAssignDialog(selectedOrder);
                    }}
                  >
                    Tugaskan Kurir
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Courier Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tugaskan Kurir</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Pilih kurir untuk pesanan #{selectedOrder?.id.slice(0, 8).toUpperCase()}
            </p>
            
            <Select value={selectedCourier} onValueChange={setSelectedCourier}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kurir..." />
              </SelectTrigger>
              <SelectContent>
                {couriers.map((courier) => (
                  <SelectItem key={courier.id} value={courier.id}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${courier.is_available ? 'bg-primary' : 'bg-muted-foreground'}`} />
                      <span>{courier.name}</span>
                      <span className="text-muted-foreground text-xs">({courier.phone})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {couriers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Tidak ada kurir aktif yang tersedia
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAssignDialogOpen(false)}>
                Batal
              </Button>
              <Button className="flex-1" onClick={assignCourier} disabled={!selectedCourier}>
                Tugaskan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}