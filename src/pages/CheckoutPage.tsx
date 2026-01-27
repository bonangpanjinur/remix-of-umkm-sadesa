import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Truck, Package, Loader2, CheckCircle, CreditCard, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import { createPaymentInvoice, isXenditEnabled } from '@/lib/paymentApi';

const checkoutSchema = z.object({
  deliveryName: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  deliveryPhone: z.string().min(10, 'Nomor telepon minimal 10 digit').max(15),
  deliveryAddress: z.string().min(10, 'Alamat minimal 10 karakter').max(500),
});

type PaymentMethod = 'COD' | 'ONLINE';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, getCartTotal, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<'PICKUP' | 'INTERNAL'>('INTERNAL');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [xenditAvailable, setXenditAvailable] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    deliveryName: '',
    deliveryPhone: '',
    deliveryAddress: '',
    notes: '',
  });

  // Check if Xendit is enabled
  useEffect(() => {
    isXenditEnabled().then(setXenditAvailable);
  }, []);

  const subtotal = getCartTotal();
  const shippingCost = deliveryType === 'INTERNAL' ? 5000 : 0;
  const total = subtotal + shippingCost;

  // Group items by merchant
  const itemsByMerchant = items.reduce((acc, item) => {
    const merchantId = item.product.merchantId;
    if (!acc[merchantId]) {
      acc[merchantId] = {
        merchantName: item.product.merchantName,
        items: [],
      };
    }
    acc[merchantId].items.push(item);
    return acc;
  }, {} as Record<string, { merchantName: string; items: typeof items }>);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Silakan login terlebih dahulu',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    if (items.length === 0) {
      toast({
        title: 'Keranjang kosong',
        variant: 'destructive',
      });
      return;
    }

    // Validate form
    const result = checkoutSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      // Create order for each merchant
      for (const [merchantId, merchantData] of Object.entries(itemsByMerchant)) {
        const merchantSubtotal = merchantData.items.reduce(
          (sum, item) => sum + item.product.price * item.quantity, 
          0
        );
        const merchantShipping = deliveryType === 'INTERNAL' ? 5000 : 0;
        const merchantTotal = merchantSubtotal + merchantShipping;

        // Insert order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            buyer_id: user.id,
            merchant_id: merchantId,
            status: 'NEW',
            handled_by: 'ADMIN',
            delivery_type: deliveryType,
            delivery_name: formData.deliveryName,
            delivery_phone: formData.deliveryPhone,
            delivery_address: formData.deliveryAddress,
            shipping_cost: merchantShipping,
            subtotal: merchantSubtotal,
            total: merchantTotal,
            notes: formData.notes || null,
            payment_status: paymentMethod === 'COD' ? 'COD' : 'UNPAID',
          })
          .select()
          .single();

        if (orderError) {
          console.error('Error creating order:', orderError);
          throw orderError;
        }

        // Insert order items
        const orderItems = merchantData.items.map(item => ({
          order_id: orderData.id,
          product_id: item.product.id,
          product_name: item.product.name,
          product_price: item.product.price,
          quantity: item.quantity,
          subtotal: item.product.price * item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('Error creating order items:', itemsError);
          throw itemsError;
        }

        setOrderId(orderData.id);

        // If online payment, create Xendit invoice
        if (paymentMethod === 'ONLINE' && xenditAvailable) {
          try {
            const invoice = await createPaymentInvoice({
              orderId: orderData.id,
              amount: merchantTotal,
              payerEmail: user.email || `${user.id}@placeholder.com`,
              description: `Order dari ${merchantData.merchantName}`,
            });

            setInvoiceUrl(invoice.invoice_url);
            
            // Redirect to payment page
            window.location.href = invoice.invoice_url;
            return;
          } catch (paymentError) {
            console.error('Payment error:', paymentError);
            // Order is created, just show error for payment
            toast({
              title: 'Pesanan dibuat, tapi pembayaran gagal',
              description: 'Silakan bayar dari halaman pesanan Anda',
              variant: 'destructive',
            });
          }
        }
      }

      // Clear cart and show success
      clearCart();
      setSuccess(true);
      toast({
        title: 'Pesanan berhasil dibuat!',
        description: paymentMethod === 'COD' 
          ? 'Bayar saat pesanan tiba' 
          : 'Pesanan Anda sedang diproses',
      });
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Gagal membuat pesanan',
        description: 'Terjadi kesalahan, silakan coba lagi',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mobile-shell bg-background flex flex-col min-h-screen items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Pesanan Berhasil!
          </h1>
          <p className="text-muted-foreground mb-6">
            Terima kasih, pesanan Anda sedang diproses oleh admin
          </p>
          <div className="space-y-3">
            <Button onClick={() => navigate('/orders')} className="w-full">
              Lihat Pesanan Saya
            </Button>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Lanjut Belanja
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-secondary flex flex-col min-h-screen">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-bold text-lg text-foreground">Checkout</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-48">
        {/* Delivery Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-4 border border-border shadow-sm mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Alamat Pengiriman</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryName">Nama Penerima</Label>
              <Input
                id="deliveryName"
                name="deliveryName"
                placeholder="Nama lengkap penerima"
                value={formData.deliveryName}
                onChange={handleChange}
              />
              {errors.deliveryName && (
                <p className="text-xs text-destructive">{errors.deliveryName}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="deliveryPhone">No. Telepon</Label>
              <Input
                id="deliveryPhone"
                name="deliveryPhone"
                type="tel"
                placeholder="08xxxxxxxxxx"
                value={formData.deliveryPhone}
                onChange={handleChange}
              />
              {errors.deliveryPhone && (
                <p className="text-xs text-destructive">{errors.deliveryPhone}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="deliveryAddress">Alamat Lengkap</Label>
              <Textarea
                id="deliveryAddress"
                name="deliveryAddress"
                placeholder="Jalan, RT/RW, Desa, Kecamatan"
                value={formData.deliveryAddress}
                onChange={handleChange}
                rows={3}
              />
              {errors.deliveryAddress && (
                <p className="text-xs text-destructive">{errors.deliveryAddress}</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Delivery Method */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-4 border border-border shadow-sm mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Truck className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Metode Pengiriman</h3>
          </div>
          
          <RadioGroup 
            value={deliveryType} 
            onValueChange={(value) => setDeliveryType(value as 'PICKUP' | 'INTERNAL')}
            className="space-y-2"
          >
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
              deliveryType === 'INTERNAL' ? 'border-primary bg-brand-light' : 'border-border'
            }`}>
              <RadioGroupItem value="INTERNAL" id="internal" />
              <div className="flex-1">
                <p className="font-bold text-sm">Kurir Desa</p>
                <p className="text-xs text-muted-foreground">Dikirim ke alamat Anda</p>
              </div>
              <span className="text-sm font-bold text-primary">{formatPrice(5000)}</span>
            </label>
            
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
              deliveryType === 'PICKUP' ? 'border-primary bg-brand-light' : 'border-border'
            }`}>
              <RadioGroupItem value="PICKUP" id="pickup" />
              <div className="flex-1">
                <p className="font-bold text-sm">Ambil Sendiri</p>
                <p className="text-xs text-muted-foreground">Ambil langsung di toko</p>
              </div>
              <span className="text-sm font-bold text-primary">Gratis</span>
            </label>
          </RadioGroup>
        </motion.div>

        {/* Payment Method */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-xl p-4 border border-border shadow-sm mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Metode Pembayaran</h3>
          </div>
          
          <RadioGroup 
            value={paymentMethod} 
            onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            className="space-y-2"
          >
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
              paymentMethod === 'COD' ? 'border-primary bg-brand-light' : 'border-border'
            }`}>
              <RadioGroupItem value="COD" id="cod" />
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-bold text-sm">Bayar di Tempat (COD)</p>
                <p className="text-xs text-muted-foreground">Bayar tunai saat pesanan tiba</p>
              </div>
            </label>
            
            {xenditAvailable && (
              <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                paymentMethod === 'ONLINE' ? 'border-primary bg-brand-light' : 'border-border'
              }`}>
                <RadioGroupItem value="ONLINE" id="online" />
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-bold text-sm">Bayar Online</p>
                  <p className="text-xs text-muted-foreground">QRIS, Transfer Bank, E-Wallet</p>
                </div>
              </label>
            )}
          </RadioGroup>
        </motion.div>

        {/* Order Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl p-4 border border-border shadow-sm mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Ringkasan Pesanan</h3>
          </div>
          
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.product.id} className="flex gap-3">
                <img 
                  src={item.product.image} 
                  alt={item.product.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{item.product.name}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity}x {formatPrice(item.product.price)}</p>
                </div>
                <p className="text-sm font-bold">{formatPrice(item.product.price * item.quantity)}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl p-4 border border-border shadow-sm"
        >
          <Label htmlFor="notes">Catatan (opsional)</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Catatan untuk penjual..."
            value={formData.notes}
            onChange={handleChange}
            rows={2}
            className="mt-2"
          />
        </motion.div>
      </form>

      {/* Checkout Summary */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-card border-t border-border p-5 shadow-lg">
        <div className="flex justify-between items-center mb-1 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-bold">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between items-center mb-4 text-sm">
          <span className="text-muted-foreground">Ongkir</span>
          <span className="font-bold">{formatPrice(shippingCost)}</span>
        </div>
        <div className="flex justify-between items-center mb-4 pt-4 border-t border-border">
          <span className="text-lg font-bold">Total</span>
          <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
        </div>
        <Button
          type="submit"
          onClick={handleSubmit}
          className="w-full shadow-brand font-bold"
          size="lg"
          disabled={loading || items.length === 0}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Memproses...
            </>
          ) : (
            'Buat Pesanan'
          )}
        </Button>
      </div>
    </div>
  );
}
