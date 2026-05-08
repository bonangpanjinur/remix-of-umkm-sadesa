import { useState, useEffect, useRef, useCallback } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, User, Banknote, QrCode,
  CreditCard, Printer, PauseCircle, PlayCircle, Barcode,
  X, CheckCircle2, Package, ChevronLeft, Tag, Receipt
} from 'lucide-react';
import { POSSidebar } from '@/components/pos/POSSidebar';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost_price: number;
  unit: string;
  tax_rate: number;
  is_stock_tracked: boolean;
  has_variants: boolean;
  image_url: string | null;
  is_active: boolean;
  pos_categories?: { name: string } | null;
  pos_stock?: { quantity: number }[];
}

interface Variant { id: string; name: string; price: number | null; cost_price: number | null; is_active: boolean; }

interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  costPrice: number;
  unit: string;
  qty: number;
  discount: number;
  taxRate: number;
  notes: string;
}

interface HeldBill { id: string; label: string; customer_name: string | null; items: CartItem[]; discount_amount: number; notes: string; }
interface Customer { id: string; name: string; phone: string | null; is_member: boolean; }

const paymentMethods = [
  { value: 'cash', label: 'Tunai', icon: <Banknote className="h-4 w-4" /> },
  { value: 'qris', label: 'QRIS', icon: <QrCode className="h-4 w-4" /> },
  { value: 'transfer', label: 'Transfer', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'debit', label: 'Debit', icon: <CreditCard className="h-4 w-4" /> },
];

export default function POSKasirPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [heldBillsDialog, setHeldBillsDialog] = useState(false);
  const [variantDialog, setVariantDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerDialog, setCustomerDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tenant && activeOutlet) {
      fetchProducts();
      fetchCategories();
      fetchHeldBills();
    }
  }, [tenant, activeOutlet]);

  // Keyboard shortcuts: F2=bayar, F3=tahan, F8=fokus cari, Escape=bersihkan cari
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'F2') { e.preventDefault(); openPayment(); }
      if (e.key === 'F3') { e.preventDefault(); holdBill(); }
      if (e.key === 'F8') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setSearch(''); searchRef.current?.blur(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cart, discount, notes, selectedCustomer, customerName, paymentMethod, paymentAmount]);

  const fetchProducts = async () => {
    if (!tenant || !activeOutlet) return;
    const { data } = await supabase
      .from('pos_products' as any)
      .select('*, pos_categories(name), pos_stock(quantity)')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name');
    setProducts((data || []) as unknown as Product[]);
    setLoading(false);
  };

  const fetchCategories = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('pos_categories' as any).select('id, name').eq('tenant_id', tenant.id).order('name');
    setCategories((data || []) as unknown as { id: string; name: string }[]);
  };

  const fetchHeldBills = async () => {
    if (!tenant || !activeOutlet || !user) return;
    const { data } = await supabase.from('pos_held_bills' as any).select('*').eq('tenant_id', tenant.id).eq('outlet_id', activeOutlet.id).eq('cashier_id', user.id).order('created_at');
    setHeldBills((data || []).map((h: any) => ({ ...h, items: h.items || [] })));
  };

  const searchCustomers = async (q: string) => {
    if (!tenant || !q) return;
    const { data } = await supabase.from('pos_customers' as any).select('id, name, phone, is_member').eq('tenant_id', tenant.id).ilike('name', `%${q}%`).limit(5);
    setCustomers((data || []) as unknown as Customer[]);
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.includes(search));
    const matchCat = filterCat === 'all' || (p.pos_categories as any)?.id === filterCat || (p as any).category_id === filterCat;
    return matchSearch && matchCat;
  });

  const addToCart = async (product: Product, variantId?: string, variantName?: string, variantPrice?: number) => {
    if (product.has_variants && !variantId) {
      const { data } = await supabase.from('pos_product_variants' as any).select('*').eq('product_id', product.id).eq('is_active', true);
      setVariants((data || []) as unknown as Variant[]);
      setSelectedProduct(product);
      setVariantDialog(true);
      return;
    }

    const price = variantPrice ?? product.price;
    const existingIdx = cart.findIndex(c => c.productId === product.id && c.variantId === variantId);
    if (existingIdx >= 0) {
      const newCart = [...cart];
      newCart[existingIdx].qty += 1;
      setCart(newCart);
    } else {
      setCart(prev => [...prev, {
        productId: product.id, variantId, name: product.name, variantName,
        price, costPrice: product.cost_price, unit: product.unit,
        qty: 1, discount: 0, taxRate: product.tax_rate, notes: '',
      }]);
    }
    setSearch('');
  };

  const updateQty = (idx: number, delta: number) => {
    const newCart = [...cart];
    newCart[idx].qty = Math.max(0.5, newCart[idx].qty + delta);
    if (newCart[idx].qty <= 0) newCart.splice(idx, 1);
    setCart(newCart);
  };

  const removeItem = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));

  const updateDiscount = (idx: number, val: number) => {
    const newCart = [...cart];
    newCart[idx].discount = Math.min(val, newCart[idx].price * newCart[idx].qty);
    setCart(newCart);
  };

  const subtotal = cart.reduce((s, i) => s + (i.price * i.qty - i.discount), 0);
  const taxAmount = cart.reduce((s, i) => s + ((i.price * i.qty - i.discount) * i.taxRate / 100), 0);
  const total = Math.max(0, subtotal + taxAmount - discount);
  const change = paymentMethod === 'cash' ? Math.max(0, (Number(paymentAmount) || 0) - total) : 0;

  const openPayment = () => {
    if (cart.length === 0) { toast.error('Keranjang kosong'); return; }
    setPaymentAmount(String(total));
    setPaymentDialog(true);
  };

  const processPayment = async () => {
    if (!tenant || !activeOutlet || !user) return;
    if (paymentMethod === 'cash' && (Number(paymentAmount) || 0) < total) {
      toast.error('Jumlah bayar kurang dari total'); return;
    }

    try {
      const saleNumber = `TRX-${Date.now()}`;
      const { data: sale, error } = await supabase.from('pos_sales' as any).insert({
        tenant_id: tenant.id, outlet_id: activeOutlet.id, sale_number: saleNumber,
        cashier_id: user.id, cashier_name: user.email,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || customerName || null,
        subtotal, discount_amount: discount, tax_amount: taxAmount, total,
        payment_method: paymentMethod, payment_amount: Number(paymentAmount) || total,
        change_amount: change, status: 'completed', notes: notes || null,
      }).select().single();
      if (error) throw error;

      const saleId = (sale as any).id;
      await supabase.from('pos_sale_items' as any).insert(
        cart.map(item => ({
          sale_id: saleId, product_id: item.productId, variant_id: item.variantId || null,
          product_name: item.name, variant_name: item.variantName || null,
          qty: item.qty, price: item.price, cost_price: item.costPrice,
          discount: item.discount, tax_amount: (item.price * item.qty - item.discount) * item.taxRate / 100,
          subtotal: item.price * item.qty - item.discount,
        }))
      );

      // Update stock
      for (const item of cart) {
        if (item.variantId) {
          const { data: stockD } = await supabase.from('pos_stock' as any).select('id, quantity').eq('product_id', item.productId).eq('variant_id', item.variantId).eq('outlet_id', activeOutlet.id).single();
          if (stockD) await supabase.from('pos_stock' as any).update({ quantity: Math.max(0, (stockD as any).quantity - item.qty) }).eq('id', (stockD as any).id);
        } else {
          const { data: stockD } = await supabase.from('pos_stock' as any).select('id, quantity').eq('product_id', item.productId).eq('outlet_id', activeOutlet.id).is('variant_id', null).single();
          if (stockD) {
            const newQty = Math.max(0, (stockD as any).quantity - item.qty);
            await supabase.from('pos_stock' as any).update({ quantity: newQty }).eq('id', (stockD as any).id);
            await supabase.from('pos_stock_mutations' as any).insert({
              tenant_id: tenant.id, product_id: item.productId, outlet_id: activeOutlet.id,
              type: 'sale', quantity: -item.qty, quantity_before: (stockD as any).quantity,
              quantity_after: newQty, reference_id: saleId, reference_type: 'pos_sale', created_by: user.id,
            });
          }
        }
      }

      // Update customer stats
      if (selectedCustomer) {
        const { data: cust } = await supabase
          .from('pos_customers' as any)
          .select('total_purchase, transaction_count')
          .eq('id', selectedCustomer.id)
          .single();
        if (cust) {
          await supabase.from('pos_customers' as any).update({
            total_purchase: ((cust as any).total_purchase || 0) + total,
            transaction_count: ((cust as any).transaction_count || 0) + 1,
            last_purchase_at: new Date().toISOString(),
          }).eq('id', selectedCustomer.id);
        }
      }

      setLastSale({ saleNumber, total, change, paymentMethod, customerName: selectedCustomer?.name || customerName || 'Umum', items: [...cart] });
      setCart([]);
      setDiscount(0);
      setNotes('');
      setSelectedCustomer(null);
      setCustomerName('');
      setPaymentAmount('');
      setPaymentDialog(false);
      setSuccessDialog(true);
      fetchProducts();
    } catch (err: any) {
      toast.error('Gagal memproses transaksi: ' + err.message);
    }
  };

  const holdBill = async () => {
    if (!tenant || !activeOutlet || !user || cart.length === 0) return;
    await supabase.from('pos_held_bills' as any).insert({
      tenant_id: tenant.id, outlet_id: activeOutlet.id, cashier_id: user.id,
      label: `Bill ${heldBills.length + 1}`,
      customer_name: selectedCustomer?.name || customerName || null,
      customer_id: selectedCustomer?.id || null,
      items: cart, discount_amount: discount, notes,
    });
    setCart([]);
    setDiscount(0);
    setNotes('');
    setSelectedCustomer(null);
    setCustomerName('');
    await fetchHeldBills();
    toast.success('Transaksi ditahan');
  };

  const resumeBill = async (bill: HeldBill) => {
    setCart(bill.items);
    setDiscount(bill.discount_amount);
    setNotes(bill.notes);
    setCustomerName(bill.customer_name || '');
    await supabase.from('pos_held_bills' as any).delete().eq('id', bill.id);
    await fetchHeldBills();
    setHeldBillsDialog(false);
    toast.success('Transaksi dilanjutkan');
  };

  const printReceipt = () => window.print();

  const onBarcodeDetect = useCallback((barcode: string) => {
    const match = products.find(p => p.barcode === barcode || p.sku === barcode);
    if (match) {
      addToCart(match);
      toast.success(`✓ ${match.name} ditambahkan`);
    } else {
      setSearch(barcode);
      setScannerOpen(false);
      toast.info(`Barcode "${barcode}" — pilih produk secara manual`);
    }
  }, [products]);

  if (!tenant) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Buat usaha terlebih dahulu</p>
          <Button onClick={() => navigate('/pos/pengaturan')} className="bg-emerald-600 hover:bg-emerald-700">Buat Usaha</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={cn('fixed inset-y-0 left-0 z-50 lg:relative lg:z-0 transform transition-transform duration-200', sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
        <POSSidebar />
      </div>

      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/* Product Panel */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          <div className="p-3 border-b bg-background space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  className="pl-9 pr-9 h-9"
                  placeholder="Cari produk / scan barcode... (F8)"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={() => setScannerOpen(true)}
                title="Scan Barcode Kamera"
              >
                <Barcode className="h-4 w-4 text-emerald-600" />
              </Button>
              {heldBills.length > 0 && (
                <Button variant="outline" size="sm" className="h-9 gap-1.5 flex-shrink-0" onClick={() => setHeldBillsDialog(true)}>
                  <PauseCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-xs">{heldBills.length}</span>
                </Button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <Button size="sm" variant={filterCat === 'all' ? 'default' : 'outline'} className={cn('h-7 text-xs flex-shrink-0', filterCat === 'all' ? 'bg-emerald-600 hover:bg-emerald-700' : '')} onClick={() => setFilterCat('all')}>Semua</Button>
              {categories.map(c => (
                <Button key={c.id} size="sm" variant={filterCat === c.id ? 'default' : 'outline'} className={cn('h-7 text-xs flex-shrink-0', filterCat === c.id ? 'bg-emerald-600 hover:bg-emerald-700' : '')} onClick={() => setFilterCat(c.id)}>{c.name}</Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {[...Array(12)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40">
                <Package className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{search ? 'Produk tidak ditemukan' : 'Belum ada produk'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {filteredProducts.map(p => {
                  const stock = p.pos_stock?.[0]?.quantity ?? 0;
                  const isLowStock = p.is_stock_tracked && stock <= 5;
                  const outOfStock = p.is_stock_tracked && stock <= 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !outOfStock && addToCart(p)}
                      disabled={outOfStock}
                      className={cn(
                        'text-left p-3 rounded-xl border transition-all hover:shadow-md active:scale-[0.97]',
                        outOfStock ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-emerald-400',
                      )}
                    >
                      <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center mb-2">
                        {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover rounded-lg" /> : <Package className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <p className="text-xs font-medium line-clamp-2 mb-1">{p.name}</p>
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(p.price)}</p>
                      {p.is_stock_tracked && (
                        <p className={cn('text-xs mt-0.5', isLowStock ? 'text-amber-500' : 'text-muted-foreground')}>
                          {outOfStock ? 'Habis' : `Stok: ${stock}`}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="w-80 xl:w-96 flex flex-col bg-card">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-sm">Pesanan</span>
                {cart.length > 0 && <Badge className="bg-emerald-600 text-white text-xs">{cart.length}</Badge>}
              </div>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => { setCart([]); setDiscount(0); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Bersihkan
                </Button>
              )}
            </div>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 transition-colors" onClick={() => setCustomerDialog(true)}>
              <User className="h-4 w-4" />
              {selectedCustomer ? selectedCustomer.name : customerName || 'Pilih customer (opsional)'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Pilih produk untuk mulai transaksi</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {cart.map((item, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-background border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.name}</p>
                        {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
                        <p className="text-xs text-emerald-600">{formatCurrency(item.price)} / {item.unit}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeItem(idx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(idx, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-8 text-center">{item.qty}</span>
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(idx, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <Input
                          type="number"
                          className="h-6 w-20 text-xs"
                          placeholder="Diskon"
                          value={item.discount || ''}
                          onChange={e => updateDiscount(idx, Number(e.target.value))}
                        />
                      </div>
                      <p className="text-sm font-bold">{formatCurrency(item.price * item.qty - item.discount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary & Actions */}
          <div className="border-t p-3 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} item)</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {taxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Pajak</span><span>{formatCurrency(taxAmount)}</span></div>}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" />Diskon</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Rp</span>
                  <Input type="number" className="h-7 w-24 text-xs" value={discount || ''} onChange={e => setDiscount(Number(e.target.value))} placeholder="0" />
                </div>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>Total</span>
                <span className="text-emerald-600">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={holdBill} disabled={cart.length === 0} title="Tahan transaksi (F3)">
                <PauseCircle className="h-4 w-4 mr-1.5" />Tahan <span className="ml-1 text-[10px] text-muted-foreground hidden sm:inline">F3</span>
              </Button>
              <Button className="flex-1 h-9 text-sm bg-emerald-600 hover:bg-emerald-700" onClick={openPayment} disabled={cart.length === 0} title="Proses pembayaran (F2)">
                <Receipt className="h-4 w-4 mr-1.5" />Bayar <span className="ml-1 text-[10px] text-emerald-200 hidden sm:inline">F2</span>
              </Button>
            </div>

            <div>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan transaksi..." rows={1} className="text-xs resize-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Proses Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Tagihan</p>
              <p className="text-3xl font-bold text-emerald-600">{formatCurrency(total)}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Metode Pembayaran</Label>
              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map(pm => (
                  <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                    className={cn('flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                      paymentMethod === pm.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'hover:border-muted-foreground/40')}>
                    {pm.icon}{pm.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div>
                <Label>Jumlah Bayar</Label>
                <Input className="mt-1 text-lg font-bold h-12" type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0" />
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000].filter((v, i, arr) => arr.indexOf(v) === i).map(v => (
                    <Button key={v} variant="outline" size="sm" className="text-xs h-7" onClick={() => setPaymentAmount(String(v))}>{formatCurrency(v)}</Button>
                  ))}
                </div>
                {Number(paymentAmount) >= total && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">Kembalian: <strong>{formatCurrency(change)}</strong></p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={processPayment}>
              <CheckCircle2 className="h-4 w-4 mr-2" />Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="max-w-sm">
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold mb-1">Transaksi Berhasil!</h2>
            {lastSale && (
              <div className="bg-muted rounded-xl p-4 mt-4 text-left space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">No. Transaksi</span><span className="font-mono font-bold">{lastSale.saleNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{lastSale.customerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold text-emerald-600">{formatCurrency(lastSale.total)}</span></div>
                {lastSale.paymentMethod === 'cash' && <div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span className="font-bold">{formatCurrency(lastSale.change)}</span></div>}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={printReceipt}><Printer className="h-4 w-4 mr-2" />Cetak Struk</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setSuccessDialog(false); searchRef.current?.focus(); }}>Transaksi Baru</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Held Bills Dialog */}
      <Dialog open={heldBillsDialog} onOpenChange={setHeldBillsDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transaksi Tertahan ({heldBills.length})</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {heldBills.map(bill => (
              <div key={bill.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{bill.label}</p>
                  {bill.customer_name && <p className="text-xs text-muted-foreground">{bill.customer_name}</p>}
                  <p className="text-xs text-muted-foreground">{bill.items.length} item</p>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => resumeBill(bill)}>
                  <PlayCircle className="h-4 w-4 mr-1.5" />Lanjutkan
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Dialog */}
      <Dialog open={variantDialog} onOpenChange={setVariantDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pilih Varian — {selectedProduct?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {variants.map(v => (
              <button key={v.id} className="p-3 border rounded-lg text-left hover:border-emerald-400 transition-colors"
                onClick={() => { addToCart(selectedProduct!, v.id, v.name, v.price ?? selectedProduct?.price); setVariantDialog(false); }}>
                <p className="font-medium text-sm">{v.name}</p>
                <p className="text-emerald-600 text-sm">{formatCurrency(v.price ?? selectedProduct?.price ?? 0)}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Dialog */}
      <Dialog open={customerDialog} onOpenChange={setCustomerDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pilih Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nama customer baru atau cari..." value={customerName}
              onChange={e => { setCustomerName(e.target.value); searchCustomers(e.target.value); }} />
            {customers.length > 0 && (
              <div className="space-y-1">
                {customers.map(c => (
                  <button key={c.id} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left"
                    onClick={() => { setSelectedCustomer(c); setCustomerName(''); setCustomerDialog(false); }}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${c.is_member ? 'bg-amber-100 text-amber-700' : 'bg-muted'}`}>
                      {c.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    </div>
                    {c.is_member && <Badge className="ml-auto bg-amber-100 text-amber-700 border-0 text-xs">Member</Badge>}
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div className="flex items-center justify-between bg-muted p-2 rounded-lg">
                <span className="text-sm">Terpilih: <strong>{selectedCustomer.name}</strong></span>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => { setSelectedCustomer(null); }}>Hapus</Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialog(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setCustomerDialog(false)}>Konfirmasi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetect={onBarcodeDetect}
      />
    </div>
  );
}
