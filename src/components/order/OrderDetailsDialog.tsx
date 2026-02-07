import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import { User, Phone, MapPin, CreditCard, Check, X, Truck, Printer } from 'lucide-react';

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

interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderRow | null;
  orderItems: OrderItem[];
  onUpdateStatus: (orderId: string, newStatus: string) => void;
  onOpenAssignCourier: (order: OrderRow) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  getPaymentBadge: (paymentStatus: string | null) => React.ReactNode;
}

export function OrderDetailsDialog({
  open,
  onOpenChange,
  order,
  orderItems,
  onUpdateStatus,
  onOpenAssignCourier,
  getStatusBadge,
  getPaymentBadge,
}: OrderDetailsDialogProps) {
  if (!order) return null;

  const handlePrint = () => {
    const printContent = document.getElementById('order-print-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice #${order.id.slice(0, 8).toUpperCase()}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .section-title { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { text-align: left; border-bottom: 1px solid #eee; padding: 10px 0; }
            td { padding: 10px 0; border-bottom: 1px solid #f9f9f9; }
            .totals { text-align: right; }
            .total-row { font-weight: bold; font-size: 1.2em; }
            .footer { margin-top: 40px; text-align: center; font-size: 0.8em; color: #888; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>INVOICE</h1>
            <p>#${order.id.toUpperCase()}</p>
            <p>Tanggal: ${new Date(order.created_at).toLocaleString('id-ID')}</p>
          </div>
          
          <div class="info-grid">
            <div>
              <div class="section-title">Merchant</div>
              <p><strong>${order.merchants?.name || '-'}</strong></p>
            </div>
            <div>
              <div class="section-title">Pelanggan</div>
              <p>${order.delivery_name || 'Pelanggan'}</p>
              <p>${order.delivery_phone || '-'}</p>
              <p>${order.delivery_address || '-'}</p>
            </div>
          </div>

          <div class="section-title">Item Pesanan</div>
          <table>
            <thead>
              <tr>
                <th>Produk</th>
                <th>Harga</th>
                <th>Qty</th>
                <th style="text-align: right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${orderItems.map(item => `
                <tr>
                  <td>${item.product_name}</td>
                  <td>${formatPrice(item.product_price)}</td>
                  <td>${item.quantity}</td>
                  <td style="text-align: right">${formatPrice(item.subtotal)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <p>Subtotal: ${formatPrice(order.subtotal)}</p>
            <p>Ongkos Kirim: ${formatPrice(order.shipping_cost)}</p>
            <p class="total-row">Total: ${formatPrice(order.total)}</p>
          </div>

          ${order.notes ? `
            <div style="margin-top: 20px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
              <div class="section-title">Catatan</div>
              <p>${order.notes}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>Terima kasih telah berbelanja di UMKM Mitra</p>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle>
            Detail Pesanan #{order.id.slice(0, 8).toUpperCase()}
          </DialogTitle>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Cetak
          </Button>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto" id="order-print-content">
          {/* Status Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              {getStatusBadge(order.status)}
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {getPaymentBadge(order.payment_status)}
            </div>
          </div>

          {/* Merchant */}
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Merchant</p>
            <p className="font-medium">{order.merchants?.name || '-'}</p>
          </div>

          {/* Customer Info */}
          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium mb-2">Informasi Pengiriman</p>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{order.delivery_name || 'Pelanggan'}</span>
            </div>
            {order.delivery_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{order.delivery_phone}</span>
              </div>
            )}
            {order.delivery_address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>{order.delivery_address}</span>
              </div>
            )}
            <Badge variant="outline" className="mt-2">
              {order.delivery_type === 'PICKUP' ? 'Ambil Sendiri' : 'Diantar Kurir'}
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
          {order.notes && (
            <div className="text-sm bg-muted/50 rounded-lg p-3">
              <p className="text-muted-foreground mb-1">Catatan:</p>
              <p>{order.notes}</p>
            </div>
          )}

          {/* Totals */}
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Ongkir</span>
              <span>{formatPrice(order.shipping_cost)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatPrice(order.total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            {order.status === 'NEW' && (
              <>
                <Button 
                  className="flex-1"
                  onClick={() => onUpdateStatus(order.id, 'PROCESSED')}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Terima & Proses
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => onUpdateStatus(order.id, 'CANCELLED')}
                >
                  <X className="h-4 w-4 mr-2" />
                  Tolak
                </Button>
              </>
            )}
            {order.status === 'PROCESSED' && (
              <Button 
                className="flex-1"
                onClick={() => onUpdateStatus(order.id, 'SENT')}
              >
                <Truck className="h-4 w-4 mr-2" />
                Kirim
              </Button>
            )}
            {/* Pesanan hanya bisa diselesaikan oleh pembeli atau otomatis oleh sistem */}
            {order.delivery_type === 'INTERNAL' && !order.courier_id && (
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  onOpenAssignCourier(order);
                }}
              >
                <Truck className="h-4 w-4 mr-2" />
                Tugaskan Kurir
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
