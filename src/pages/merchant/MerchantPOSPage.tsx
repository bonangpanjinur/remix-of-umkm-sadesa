import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShoppingCart, Search, Plus, Minus, Trash2, Receipt, 
  Printer, CreditCard, Banknote, QrCode, X, Package,
  Settings, AlertTriangle, Loader2
} from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { POSInvoice, printPOSInvoice } from '@/components/merchant/POSInvoice';
import { Link } from 'react-router-dom';
import { calculateCreditCost } from '@/lib/quotaApi';
import { fetchQuotaTiers } from '@/lib/quotaApi';

interface ProductItem {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
  category: string;
}

interface CartLine {
  product: ProductItem;
  quantity: number;
  subtotal: number;
}

interface POSSubscription {
  id: string;
  status: string;
  started_at: string | null;
  expired_at: string | null;
  is_trial: boolean;
}

export default function MerchantPOSPage() {
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState('');
  const [merchantAddress, setMerchantAddress] = useState<string | null>(null);
  const [merchantPhone, setMerchantPhone] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [posActive, setPosActive] = useState<boolean | null>(null);
  const [posSettings, setPosSettings] = useState<any>(null);

  // Load merchant data & check POS access
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id, name, address, phone')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!merchant) { setLoading(false); return; }
        setMerchantId(merchant.id);
        setMerchantName(merchant.name);
        setMerchantAddress(merchant.address);
        setMerchantPhone(merchant.phone);

        // Check POS subscription
        const { data: posSub } = await supabase
          .from('pos_subscriptions')
          .select('*')
          .eq('merchant_id', merchant.id)
          .eq('status', 'ACTIVE')
          .gte('expired_at', new Date().toISOString())
          .maybeSingle();

        setPosActive(!!posSub);

        // Load POS settings
        const { data: settings } = await supabase
          .from('pos_settings')
          .select('*')
          .eq('merchant_id', merchant.id)
          .maybeSingle();
        setPosSettings(settings);

        // Load products
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, price, stock, image_url, category')
          .eq('merchant_id', merchant.id)
          .eq('is_active', true)
          .order('name');

        setProducts(prods || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product: ProductItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error('Stok tidak cukup');
          return prev;
        }
        return prev.map(c =>
          c.product.id === product.id
            ? { ...c, quantity: c.quantity + 1, subtotal: (c.quantity + 1) * c.product.price }
            : c
        );
      }
      return [...prev, { product, quantity: 1, subtotal: product.price }];
    });
  };

  const updateCartQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.product.id !== productId));
      return;
    }
    setCart(prev => prev.map(c =>
      c.product.id === productId
        ? { ...c, quantity: qty, subtotal: qty * c.product.price }
        : c
    ));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.subtotal, 0);
  const changeAmount = Math.max(0, (parseInt(paymentAmount) || 0) - cartTotal);

  const handleCheckout = async () => {
    if (cart.length === 0 || !merchantId || !user) return;
    setProcessing(true);
    try {
      const txNumber = `POS-${Date.now().toString(36).toUpperCase()}`;
      const items = cart.map(c => ({
        product_id: c.product.id,
        product_name: c.product.name,
        quantity: c.quantity,
        price: c.product.price,
        subtotal: c.subtotal,
      }));

      // 1. Calculate quota credit cost for this transaction
      const tiers = await fetchQuotaTiers();
      let totalCredits = 0;
      for (const item of cart) {
        const creditCost = calculateCreditCost(item.product.price, tiers);
        totalCredits += creditCost * item.quantity;
      }

      // 2. Deduct merchant quota
      const { data: quotaOk, error: quotaError } = await supabase.rpc('deduct_merchant_quota', {
        p_merchant_id: merchantId,
        p_credits: totalCredits,
      });

      if (quotaError || quotaOk !== true) {
        toast.error('Kuota transaksi tidak mencukupi. Silakan beli paket kuota terlebih dahulu.');
        setProcessing(false);
        return;
      }

      // 3. Create order record (handled_by = 'POS', status = 'DONE')
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          merchant_id: merchantId,
          subtotal: cartTotal,
          shipping_cost: 0,
          total: cartTotal,
          status: 'DONE',
          delivery_type: 'PICKUP',
          handled_by: 'POS',
          payment_method: paymentMethod,
          payment_status: 'PAID',
          payment_paid_at: new Date().toISOString(),
          delivered_at: new Date().toISOString(),
          notes: notes ? `[POS] ${notes}` : `[POS] Transaksi kasir ${txNumber}`,
          delivery_name: customerName || 'Pelanggan POS',
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      // 4. Create order_items
      const orderItems = cart.map(c => ({
        order_id: orderData.id,
        product_id: c.product.id,
        product_name: c.product.name,
        product_price: c.product.price,
        quantity: c.quantity,
        subtotal: c.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
      }

      // 5. Log quota usage
      try {
        await supabase.from('quota_usage_logs').insert({
          merchant_id: merchantId,
          order_id: orderData.id,
          order_total: cartTotal,
          credits_used: totalCredits,
          remaining_quota: 0, // will be updated by trigger or next fetch
          notes: `POS: ${txNumber}`,
        });
      } catch (logErr) {
        console.error('Quota log error (non-blocking):', logErr);
      }

      // 6. Create POS transaction record
      const { data, error } = await supabase
        .from('pos_transactions')
        .insert({
          merchant_id: merchantId,
          transaction_number: txNumber,
          customer_name: customerName || null,
          items: items as any,
          subtotal: cartTotal,
          total: cartTotal,
          payment_method: paymentMethod,
          payment_amount: parseInt(paymentAmount) || cartTotal,
          change_amount: paymentMethod === 'CASH' ? changeAmount : 0,
          notes: notes || null,
          cashier_name: user?.email || null,
        })
        .select()
        .single();

      if (error) throw error;

      // 7. Update product stock
      for (const item of cart) {
        await supabase
          .from('products')
          .update({ stock: item.product.stock - item.quantity })
          .eq('id', item.product.id);
      }

      // Update local products
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(c => c.product.id === p.id);
        return cartItem ? { ...p, stock: p.stock - cartItem.quantity } : p;
      }));

      setLastTransaction({
        ...data,
        items,
      });
      setCart([]);
      setCheckoutOpen(false);
      setCustomerName('');
      setNotes('');
      setPaymentAmount('');
      setReceiptOpen(true);
      toast.success(`Transaksi berhasil! Kuota terpakai: ${totalCredits} kredit`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memproses transaksi');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    if (invoiceRef.current) {
      printPOSInvoice(invoiceRef.current);
    }
  };

  if (loading) {
    return (
      <MerchantLayout title="Kasir POS" subtitle="Sistem kasir point of sale">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MerchantLayout>
    );
  }

  // POS not active - show activation prompt
  if (posActive === false) {
    return (
      <MerchantLayout title="Kasir POS" subtitle="Sistem kasir point of sale">
        <div className="max-w-lg mx-auto py-10 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Receipt className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Fitur Kasir POS</h2>
          <p className="text-muted-foreground">
            Kelola penjualan langsung di toko dengan sistem kasir modern. 
            Cetak struk, kelola stok otomatis, dan pantau penjualan harian.
          </p>
          <Link to="/merchant/pos/subscribe">
            <Button size="lg" className="w-full">
              <CreditCard className="h-4 w-4 mr-2" />
              Aktifkan Fitur Kasir
            </Button>
          </Link>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Kasir POS" subtitle="Sistem kasir point of sale">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-160px)]">
        {/* Product List */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto flex-1 pb-4">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className="bg-card border border-border rounded-xl p-3 text-left hover:border-primary/50 hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-20 object-cover rounded-lg mb-2"
                  />
                )}
                <p className="font-medium text-sm line-clamp-2 min-h-[2.5em]">{product.name}</p>
                <p className="text-primary font-bold text-sm mt-1">{formatPrice(product.price)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Stok: {product.stock}</p>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-10 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Tidak ada produk ditemukan</p>
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="flex flex-col bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Keranjang
              </h3>
              {cart.length > 0 && (
                <Badge variant="default">{cart.length} item</Badge>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Keranjang kosong</p>
                <p className="text-xs">Klik produk untuk menambahkan</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(item.product.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center hover:bg-muted"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock}
                      className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm font-bold min-w-[70px] text-right">{formatPrice(item.subtotal)}</p>
                  <button
                    onClick={() => updateCartQty(item.product.id, 0)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-border space-y-3">
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatPrice(cartTotal)}</span>
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={cart.length === 0}
              onClick={() => {
                setPaymentAmount(cartTotal.toString());
                setCheckoutOpen(true);
              }}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Bayar
            </Button>
          </div>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-primary/5 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Bayar</p>
              <p className="text-3xl font-bold text-primary">{formatPrice(cartTotal)}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Pelanggan (opsional)</label>
              <Input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Nama pelanggan"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Metode Pembayaran</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">
                    <div className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Tunai</div>
                  </SelectItem>
                  <SelectItem value="QRIS">
                    <div className="flex items-center gap-2"><QrCode className="h-4 w-4" /> QRIS</div>
                  </SelectItem>
                  <SelectItem value="TRANSFER">
                    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Transfer</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === 'CASH' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Jumlah Bayar</label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="Jumlah uang yang diterima"
                />
                {changeAmount > 0 && (
                  <div className="bg-success/10 text-success rounded-lg p-3 text-center">
                    <p className="text-sm">Kembalian</p>
                    <p className="text-xl font-bold">{formatPrice(changeAmount)}</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Catatan (opsional)</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Catatan transaksi..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Batal</Button>
            <Button
              onClick={handleCheckout}
              disabled={processing || (paymentMethod === 'CASH' && (parseInt(paymentAmount) || 0) < cartTotal)}
            >
              {processing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</>
              ) : (
                <><Receipt className="h-4 w-4 mr-2" /> Selesaikan</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Struk Transaksi</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {lastTransaction && (
              <POSInvoice
                ref={invoiceRef}
                transaction={lastTransaction}
                merchantName={merchantName}
                merchantAddress={merchantAddress}
                merchantPhone={merchantPhone}
                settings={posSettings}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptOpen(false)}>Tutup</Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> Cetak Struk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
