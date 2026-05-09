import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface InvoiceOrder {
  id: string;
  total: number;
  status: string;
  created_at: string;
  payment_method: string | null;
  shipping_address: string | null;
  delivery_fee: number | null;
  merchant_id: string;
  merchants: { name: string; address?: string | null; phone?: string | null } | null;
  order_items: Array<{
    id: string;
    product_name: string;
    product_price: number;
    quantity: number;
  }>;
  profiles?: { full_name: string; phone?: string | null } | null;
}

export default function InvoicePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: order, isLoading } = useQuery<InvoiceOrder | null>({
    queryKey: ['invoice-order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, status, created_at, payment_method, shipping_address, delivery_fee, merchant_id, merchants(name, address, phone), order_items(id, product_name, product_price, quantity), profiles(full_name, phone)')
        .eq('id', orderId!)
        .eq('buyer_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as InvoiceOrder | null;
    },
    enabled: !!orderId && !!user,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Invoice tidak ditemukan</p>
        <Button variant="outline" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke Pesanan
        </Button>
      </div>
    );
  }

  const subtotal = order.order_items.reduce((s, i) => s + i.product_price * i.quantity, 0);
  const deliveryFee = order.delivery_fee || 0;
  const orderNumber = order.id.slice(0, 8).toUpperCase();

  return (
    <>
      {/* Print controls — hidden when printing */}
      <div className="print:hidden fixed top-0 left-0 right-0 bg-white border-b z-50 flex items-center justify-between px-6 py-3 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
        <Button size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" /> Print / Download PDF
        </Button>
      </div>

      {/* Invoice content */}
      <div className="max-w-2xl mx-auto py-16 px-8 print:py-8 print:px-6 font-sans text-gray-900">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">D</span>
              </div>
              <span className="text-xl font-bold text-green-600">DesaMart</span>
            </div>
            <p className="text-xs text-gray-500">Ekosistem UMKM & Desa Wisata Indonesia</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-gray-800">INVOICE</h1>
            <p className="text-sm text-gray-500 mt-1">#{orderNumber}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {format(new Date(order.created_at), 'dd MMMM yyyy', { locale: idLocale })}
            </p>
          </div>
        </div>

        {/* Buyer & Merchant info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Pembeli</h3>
            <p className="font-semibold text-sm">{order.profiles?.full_name || 'Pelanggan DesaMart'}</p>
            {order.profiles?.phone && <p className="text-xs text-gray-500 mt-0.5">{order.profiles.phone}</p>}
            {order.shipping_address && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{order.shipping_address}</p>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Penjual</h3>
            <p className="font-semibold text-sm">{order.merchants?.name || 'Toko DesaMart'}</p>
            {order.merchants?.phone && <p className="text-xs text-gray-500 mt-0.5">{order.merchants.phone}</p>}
            {(order.merchants as any)?.address && (
              <p className="text-xs text-gray-500 mt-1">{(order.merchants as any).address}</p>
            )}
          </div>
        </div>

        {/* Order details */}
        <div className="mb-2">
          <div className="flex gap-6 text-xs text-gray-500 mb-1">
            <span>Status: <span className="font-semibold text-gray-700">{order.status === 'DONE' ? 'Selesai' : order.status}</span></span>
            <span>Metode Bayar: <span className="font-semibold text-gray-700">{order.payment_method || 'N/A'}</span></span>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full mb-6 text-sm">
          <thead>
            <tr className="bg-gray-50 border-y border-gray-200">
              <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Produk</th>
              <th className="text-center py-2.5 px-3 font-semibold text-gray-600 w-16">Qty</th>
              <th className="text-right py-2.5 px-3 font-semibold text-gray-600 w-28">Harga</th>
              <th className="text-right py-2.5 px-3 font-semibold text-gray-600 w-28">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-2.5 px-3 text-gray-800">{item.product_name}</td>
                <td className="py-2.5 px-3 text-center text-gray-600">{item.quantity}</td>
                <td className="py-2.5 px-3 text-right text-gray-600">{formatPrice(item.product_price)}</td>
                <td className="py-2.5 px-3 text-right font-medium">{formatPrice(item.product_price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal Produk</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Ongkos Kirim</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-green-600">{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 text-center text-xs text-gray-400 space-y-1">
          <p>Terima kasih telah berbelanja di <strong className="text-green-600">DesaMart</strong></p>
          <p>Invoice ini dicetak secara otomatis dan sah tanpa tanda tangan</p>
          <p className="mt-2">Tanggal cetak: {format(new Date(), 'dd MMMM yyyy HH:mm', { locale: idLocale })}</p>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          @page { margin: 1cm; size: A4; }
        }
      `}</style>
    </>
  );
}
