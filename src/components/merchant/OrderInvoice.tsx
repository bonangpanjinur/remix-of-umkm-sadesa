import { forwardRef } from 'react';
import { formatPrice } from '@/lib/utils';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

interface OrderData {
  id: string;
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  delivery_type: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  payment_method: string | null;
  created_at: string;
  notes: string | null;
}

interface MerchantData {
  name: string;
  address: string | null;
  phone: string | null;
}

interface OrderInvoiceProps {
  order: OrderData;
  items: OrderItem[];
  merchant: MerchantData;
}

export const OrderInvoice = forwardRef<HTMLDivElement, OrderInvoiceProps>(
  ({ order, items, merchant }, ref) => {
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    return (
      <div
        ref={ref}
        className="bg-white text-black p-6 w-[300px] text-sm font-mono"
        style={{ fontFamily: 'monospace' }}
      >
        {/* Header */}
        <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
          <h1 className="font-bold text-lg">{merchant.name}</h1>
          {merchant.address && (
            <p className="text-xs text-gray-600">{merchant.address}</p>
          )}
          {merchant.phone && (
            <p className="text-xs text-gray-600">{merchant.phone}</p>
          )}
        </div>

        {/* Order Info */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <div className="flex justify-between">
            <span>No. Pesanan:</span>
            <span className="font-bold">#{order.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span>Tanggal:</span>
            <span>{formatDate(order.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pembayaran:</span>
            <span>{order.payment_method === 'COD' ? 'COD' : 'Online'}</span>
          </div>
        </div>

        {/* Customer Info */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <p className="font-bold">Pelanggan:</p>
          <p>{order.delivery_name || '-'}</p>
          <p className="text-xs">{order.delivery_phone || '-'}</p>
          {order.delivery_type === 'INTERNAL' && order.delivery_address && (
            <p className="text-xs mt-1">{order.delivery_address}</p>
          )}
          <p className="text-xs mt-1">
            {order.delivery_type === 'PICKUP' ? '📦 Ambil Sendiri' : '🛵 Diantar'}
          </p>
        </div>

        {/* Items */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <p className="font-bold mb-2">Item Pesanan:</p>
          {items.map((item) => (
            <div key={item.id} className="mb-2">
              <div className="flex justify-between">
                <span className="flex-1">{item.product_name}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>{item.quantity} x {formatPrice(item.product_price)}</span>
                <span>{formatPrice(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Ongkir</span>
            <span>{formatPrice(order.shipping_cost)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t border-gray-400 pt-2 mt-2">
            <span>TOTAL</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mt-3 pt-3 border-t border-dashed border-gray-400">
            <p className="font-bold">Catatan:</p>
            <p className="text-xs">{order.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-4 pt-3 border-t border-dashed border-gray-400">
          <p className="text-xs">Terima kasih telah berbelanja!</p>
          <p className="text-xs text-gray-500 mt-1">
            Powered by Desa Wisata UMKM
          </p>
        </div>
      </div>
    );
  }
);

OrderInvoice.displayName = 'OrderInvoice';

// Print function
export function printInvoice(invoiceElement: HTMLElement | null) {
  if (!invoiceElement) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup diblokir. Izinkan popup untuk mencetak.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Struk Pesanan</title>
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: monospace;
          background: white;
        }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      ${invoiceElement.outerHTML}
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() {
            window.close();
          };
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
