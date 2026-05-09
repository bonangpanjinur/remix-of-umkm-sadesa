import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ShoppingCart, Plus, Minus, Trash2, ChefHat, Send,
  CheckCircle2, Phone, Store, Clock, RefreshCw
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  currency: string;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  category_id: string | null;
  description: string | null;
  image_url: string | null;
  unit: string;
  is_available: boolean;
}

interface CartItem {
  product: Product;
  qty: number;
  notes: string;
}

type PageState = 'loading' | 'menu' | 'cart' | 'ordering' | 'success' | 'error';

function formatRupiah(amount: number, currency = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

export default function MenuPublicPage() {
  const { tenantId, tableId } = useParams<{ tenantId: string; tableId?: string }>();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tableName, setTableName] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('semua');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showCart, setShowCart] = useState(false);

  const fetchMenu = useCallback(async () => {
    if (!tenantId) return;
    setPageState('loading');
    try {
      const [menuRes, tableRes] = await Promise.all([
        fetch(`/api/menu/${tenantId}`),
        tableId ? fetch(`/api/menu/${tenantId}/table/${tableId}`) : Promise.resolve(null),
      ]);

      if (!menuRes.ok) {
        const err = await menuRes.json();
        throw new Error(err.error || 'Restoran tidak ditemukan');
      }
      const menuData = await menuRes.json();
      setTenant(menuData.tenant);
      setCategories(menuData.categories || []);
      setProducts(menuData.products || []);

      if (tableRes && tableRes.ok) {
        const td = await tableRes.json();
        setTableName(td.table?.name || '');
      }

      setPageState('menu');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat menu');
      setPageState('error');
    }
  }, [tenantId, tableId]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  const cartTotal = cart.reduce((sum, ci) => sum + ci.product.price * ci.qty, 0);
  const cartCount = cart.reduce((sum, ci) => sum + ci.qty, 0);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.product.id === product.id);
      if (existing) {
        return prev.map(ci => ci.product.id === product.id ? { ...ci, qty: ci.qty + 1 } : ci);
      }
      return [...prev, { product, qty: 1, notes: '' }];
    });
    toast.success(`${product.name} ditambahkan`);
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => {
      const updated = prev.map(ci =>
        ci.product.id === productId ? { ...ci, qty: ci.qty + delta } : ci
      ).filter(ci => ci.qty > 0);
      return updated;
    });
  };

  const updateItemNotes = (productId: string, notes: string) => {
    setCart(prev => prev.map(ci =>
      ci.product.id === productId ? { ...ci, notes } : ci
    ));
  };

  const getQty = (productId: string) =>
    cart.find(ci => ci.product.id === productId)?.qty || 0;

  const filteredProducts = products.filter(p => {
    const matchCat = activeCategory === 'semua' || p.category_id === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const submitOrder = async () => {
    if (!tenantId || !tableId) {
      toast.error('QR tidak valid. Minta QR baru kepada pelayan.');
      return;
    }
    if (cart.length === 0) {
      toast.error('Keranjang kosong');
      return;
    }
    setPageState('ordering');
    try {
      const res = await fetch(`/api/menu/${tenantId}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          table_name: tableName,
          customer_name: customerName || 'Tamu',
          notes: orderNotes || null,
          items: cart.map(ci => ({
            product_id: ci.product.id,
            qty: ci.qty,
            notes: ci.notes || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim pesanan');
      setOrderId(data.order_id);
      setOrderNumber(data.order_number);
      setCart([]);
      setShowCart(false);
      setPageState('success');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengirim pesanan');
      setPageState('menu');
    }
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        <p className="text-sm text-gray-500">Memuat menu...</p>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="text-5xl mb-4">😔</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Menu tidak tersedia</h2>
        <p className="text-gray-500 mb-6">{errorMsg}</p>
        <Button onClick={fetchMenu} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Coba Lagi
        </Button>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm w-full">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Pesanan Terkirim!</h2>
          <p className="text-gray-500 text-sm mb-4">Dapur sedang memproses pesanan Anda</p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
            <p className="text-xs text-emerald-600 font-medium mb-1">Nomor Pesanan</p>
            <p className="text-xl font-mono font-bold text-emerald-700">{orderNumber}</p>
          </div>
          {tableName && (
            <p className="text-sm text-gray-600 mb-4">
              📍 <strong>{tableName}</strong>
            </p>
          )}
          <p className="text-xs text-gray-400 mb-6">Pesawat tidak perlu menunggu di kasir. Pelayan akan mengantarkan pesanan Anda.</p>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => { setPageState('menu'); }}
          >
            Pesan Lagi
          </Button>
        </div>
      </div>
    );
  }

  const catProducts = (catId: string | null) =>
    products.filter(p => p.category_id === catId);

  const uncategorized = products.filter(p => !p.category_id);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-4">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} className="w-12 h-12 rounded-full object-cover bg-white" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
              <Store className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg leading-tight truncate">{tenant?.name}</h1>
            {tableName && (
              <p className="text-emerald-100 text-sm">📍 {tableName}</p>
            )}
          </div>
          {/* Cart Button */}
          {cartCount > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="relative bg-white text-emerald-600 rounded-full p-2.5"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="pb-3">
          <Input
            placeholder="Cari menu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-white/20 border-white/30 text-white placeholder:text-emerald-100 focus:bg-white focus:text-gray-900 h-9"
          />
        </div>

        {/* Category Tabs */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
            <button
              onClick={() => setActiveCategory('semua')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === 'semua'
                  ? 'bg-white text-emerald-700 font-bold'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              Semua
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-white text-emerald-700 font-bold'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto pb-32">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ChefHat className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Tidak ada menu yang ditemukan</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredProducts.map(product => {
              const qty = getQty(product.id);
              return (
                <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden flex">
                  {product.image_url && (
                    <div className="w-24 h-24 shrink-0">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <div className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{product.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div>
                        <p className="font-bold text-emerald-600 text-sm">
                          {formatRupiah(product.price, tenant?.currency)}
                        </p>
                        {product.original_price && product.original_price > product.price && (
                          <p className="text-xs text-gray-400 line-through">
                            {formatRupiah(product.original_price, tenant?.currency)}
                          </p>
                        )}
                      </div>
                      {qty === 0 ? (
                        <button
                          onClick={() => addToCart(product)}
                          className="bg-emerald-600 text-white rounded-full p-1.5 hover:bg-emerald-700 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQty(product.id, -1)}
                            className="bg-gray-100 text-gray-700 rounded-full p-1.5 hover:bg-gray-200"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="font-bold text-sm w-6 text-center">{qty}</span>
                          <button
                            onClick={() => addToCart(product)}
                            className="bg-emerald-600 text-white rounded-full p-1.5 hover:bg-emerald-700"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Cart Bar */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-white border-t shadow-lg">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-bold"
            onClick={() => setShowCart(true)}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Lihat Keranjang ({cartCount} item) — {formatRupiah(cartTotal, tenant?.currency)}
          </Button>
        </div>
      )}

      {/* Cart Sheet */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white max-w-md mx-auto">
          {/* Cart Header */}
          <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-3">
            <button onClick={() => setShowCart(false)} className="text-white">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="font-bold text-lg flex-1">Keranjang</h2>
            {tableName && <p className="text-sm text-emerald-100">📍 {tableName}</p>}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Keranjang kosong</p>
              </div>
            ) : (
              <>
                {cart.map(ci => (
                  <div key={ci.product.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{ci.product.name}</p>
                        <p className="text-xs text-emerald-600 font-medium mt-0.5">
                          {formatRupiah(ci.product.price * ci.qty, tenant?.currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(ci.product.id, -1)}
                          className="bg-white border rounded-full p-1 hover:bg-gray-100"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-bold text-sm w-6 text-center">{ci.qty}</span>
                        <button
                          onClick={() => updateQty(ci.product.id, 1)}
                          className="bg-emerald-100 text-emerald-700 rounded-full p-1 hover:bg-emerald-200"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setCart(prev => prev.filter(x => x.product.id !== ci.product.id))}
                          className="text-red-400 hover:text-red-600 ml-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <Input
                      placeholder="Catatan untuk item ini (opsional)..."
                      value={ci.notes}
                      onChange={e => updateItemNotes(ci.product.id, e.target.value)}
                      className="mt-2 h-8 text-xs"
                    />
                  </div>
                ))}

                {/* Customer Info */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="font-medium text-sm text-gray-700">Informasi Pemesan</p>
                  <Input
                    placeholder="Nama Anda (opsional)"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="Catatan untuk dapur (opsional)..."
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </>
            )}
          </div>

          {/* Cart Footer */}
          {cart.length > 0 && (
            <div className="p-4 border-t bg-white space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total ({cartCount} item)</span>
                <span className="font-bold text-lg text-emerald-600">
                  {formatRupiah(cartTotal, tenant?.currency)}
                </span>
              </div>
              {!tableId && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                  QR ini tidak terhubung ke meja spesifik. Hubungi pelayan.
                </p>
              )}
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-bold"
                onClick={submitOrder}
                disabled={pageState === 'ordering' || !tableId}
              >
                {pageState === 'ordering' ? (
                  <><RefreshCw className="h-5 w-5 mr-2 animate-spin" /> Mengirim...</>
                ) : (
                  <><Send className="h-5 w-5 mr-2" /> Kirim ke Dapur</>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
