import { useState, useEffect, useCallback } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, QrCode, Banknote,
  CreditCard, CheckCircle2, ArrowLeft, X, Store, RefreshCw,
  Package, Tag
} from 'lucide-react';

interface KioskProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  sku: string | null;
  barcode: string | null;
  unit: string | null;
  stock_qty: number;
  category: string | null;
}

interface CartItem extends KioskProduct {
  qty: number;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Tunai', icon: Banknote },
  { value: 'qris', label: 'QRIS', icon: QrCode },
  { value: 'transfer', label: 'Transfer', icon: CreditCard },
];

export default function POSKioskPage() {
  const navigate = useNavigate();
  const { tenant } = usePOS();
  const [products, setProducts] = useState<KioskProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [payDialog, setPayDialog] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [payMethod, setPayMethod] = useState('qris');
  const [cashInput, setCashInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [idleTimer, setIdleTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const tenantId = tenant?.id;

  useEffect(() => {
    if (tenantId) fetchProducts();
  }, [tenantId]);

  const resetIdle = useCallback(() => {
    if (idleTimer) clearTimeout(idleTimer);
    const t = setTimeout(() => {
      if (cart.length > 0) {
        toast.info('Sesi direset karena tidak ada aktivitas');
        setCart([]);
        setPayDialog(false);
      }
    }, 120000);
    setIdleTimer(t);
  }, [idleTimer, cart.length]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle));
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [resetIdle]);

  const fetchProducts = async () => {
    try {
      const { data } = await (supabase as any)
        .from('pos_products')
        .select('id, name, price, image_url, sku, barcode, unit, category, pos_stock(quantity)')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');

      const mapped = ((data || []) as any[]).map((p: any) => ({
        ...p,
        stock_qty: p.pos_stock?.[0]?.quantity ?? 999,
      })).filter((p: KioskProduct) => p.stock_qty > 0);

      setProducts(mapped);
    } catch (err) {
      console.error('Error fetching kiosk products:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['Semua', ...Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[]];

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search) || p.barcode?.includes(search);
    const matchCat = !selectedCategory || selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const addToCart = (product: KioskProduct) => {
    resetIdle();
    setCart(prev => {
      const existing = prev.find(c => c.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock_qty) { toast.error('Stok tidak cukup'); return prev; }
        return prev.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));
  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(c => c.id === id
      ? { ...c, qty: Math.max(0, Math.min(c.qty + delta, c.stock_qty)) }
      : c
    ).filter(c => c.qty > 0));
  };

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cashAmount = parseInt(cashInput.replace(/\D/g, '')) || 0;
  const change = cashAmount - total;

  const processPayment = async () => {
    if (payMethod === 'cash' && cashAmount < total) {
      toast.error('Uang tunai tidak cukup');
      return;
    }
    setProcessing(true);
    try {
      const saleNumber = `KIOSK-${Date.now()}`;
      const { data: sale, error } = await (supabase as any)
        .from('pos_sales')
        .insert({
          tenant_id: tenantId,
          sale_number: saleNumber,
          total_amount: total,
          payment_method: payMethod,
          payment_amount: payMethod === 'cash' ? cashAmount : total,
          change_amount: payMethod === 'cash' ? change : 0,
          status: 'completed',
          notes: 'Kiosk Self-Checkout',
        })
        .select('id')
        .single();

      if (error) throw error;

      await Promise.all(cart.map(item =>
        (supabase as any).from('pos_sale_items').insert({
          sale_id: sale.id,
          product_id: item.id,
          quantity: item.qty,
          unit_price: item.price,
          total_price: item.price * item.qty,
        })
      ));

      setPayDialog(false);
      setSuccessDialog(true);
      setTimeout(() => {
        setSuccessDialog(false);
        setCart([]);
        setCashInput('');
      }, 4000);
    } catch (err) {
      toast.error('Gagal memproses pembayaran');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/pos')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-emerald-600" />
            <span className="font-bold text-lg">{tenant?.store_name || 'DesaMart POS'}</span>
            <Badge className="bg-emerald-100 text-emerald-700 text-xs">Mode Kiosk</Badge>
          </div>
          <div className="flex-1" />
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk / barcode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto">
          {categories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat || (!selectedCategory && cat === 'Semua') ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat === 'Semua' ? null : cat)}
              className="shrink-0 text-xs"
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Products */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Package className="h-12 w-12 mb-3 opacity-40" />
              <p>Tidak ada produk ditemukan</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map(p => {
                const inCart = cart.find(c => c.id === p.id);
                return (
                  <Card
                    key={p.id}
                    className={`cursor-pointer hover:shadow-md transition-all border-2 ${inCart ? 'border-emerald-400 bg-emerald-50' : 'border-transparent hover:border-gray-200'}`}
                    onClick={() => addToCart(p)}
                  >
                    <CardContent className="p-3 flex flex-col items-center gap-2">
                      <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="w-full text-center">
                        <p className="text-xs font-medium line-clamp-2 leading-tight">{p.name}</p>
                        <p className="text-sm font-bold text-emerald-700 mt-1">{formatPrice(p.price)}</p>
                        {inCart && (
                          <Badge className="bg-emerald-500 text-white text-xs mt-1">×{inCart.qty}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 bg-white flex flex-col shadow-xl">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-emerald-600" />
            <h2 className="font-bold">Keranjang</h2>
            {cart.length > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 ml-auto">
                {cart.reduce((s, c) => s + c.qty, 0)} item
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Pilih produk untuk ditambahkan</p>
            </div>
          ) : cart.map(item => (
            <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-emerald-700">{formatPrice(item.price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(item.id, -1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(item.id, 1)}>
                  <Plus className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => removeFromCart(item.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t space-y-3">
          {cart.length > 0 && (
            <>
              <div className="space-y-1">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.name} ×{item.qty}</span>
                    <span>{formatPrice(item.price * item.qty)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span className="text-emerald-700">{formatPrice(total)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCart([])} className="flex-1 gap-1 text-red-500 border-red-200 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> Reset
                </Button>
                <Button onClick={() => setPayDialog(true)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1">
                  <Tag className="h-4 w-4" /> Bayar
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pilih Metode Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center py-2">
              <p className="text-3xl font-bold text-emerald-700">{formatPrice(total)}</p>
              <p className="text-sm text-muted-foreground">{cart.reduce((s, c) => s + c.qty, 0)} item</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {PAYMENT_METHODS.map(m => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    onClick={() => setPayMethod(m.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${payMethod === m.value ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <Icon className={`h-6 w-6 ${payMethod === m.value ? 'text-emerald-600' : 'text-gray-500'}`} />
                    <span className="text-sm font-medium">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {payMethod === 'cash' && (
              <div>
                <label className="text-sm font-medium block mb-1">Uang Diterima</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Masukkan jumlah uang"
                  value={cashInput}
                  onChange={e => setCashInput(e.target.value.replace(/\D/g, ''))}
                  className="text-lg font-bold text-center"
                />
                {cashAmount >= total && (
                  <div className="mt-2 flex justify-between bg-blue-50 px-3 py-2 rounded-lg">
                    <span className="text-sm font-medium">Kembalian</span>
                    <span className="text-sm font-bold text-blue-700">{formatPrice(change)}</span>
                  </div>
                )}
              </div>
            )}

            {payMethod === 'qris' && (
              <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl">
                <QrCode className="h-24 w-24 text-gray-400" />
                <p className="text-sm text-center text-muted-foreground">Tampilkan QR code QRIS ke pelanggan untuk scan</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setPayDialog(false)} className="flex-1">Batal</Button>
              <Button
                onClick={processPayment}
                disabled={processing || (payMethod === 'cash' && cashAmount < total)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {processing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                {processing ? 'Memproses...' : 'Konfirmasi Bayar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="max-w-sm text-center">
          <div className="py-6 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-emerald-700">Pembayaran Berhasil!</h2>
              <p className="text-muted-foreground mt-1">Terima kasih telah berbelanja di {tenant?.store_name || 'DesaMart'}</p>
            </div>
            {payMethod === 'cash' && change > 0 && (
              <div className="bg-blue-50 rounded-xl px-6 py-3 w-full">
                <p className="text-sm text-muted-foreground">Kembalian</p>
                <p className="text-2xl font-bold text-blue-700">{formatPrice(change)}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Halaman akan direset otomatis...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
