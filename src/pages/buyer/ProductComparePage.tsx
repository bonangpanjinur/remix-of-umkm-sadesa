import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { ArrowLeft, X, Star, Package, Store, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CompareProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image_url: string | null;
  category: string;
  stock: number;
  sold_count: number;
  rating_avg: number;
  rating_count: number;
  merchant_name: string;
  village_name: string;
  is_promo: boolean;
  discount_percent: number;
}

const MAX_COMPARE = 3;

export default function ProductComparePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CompareProduct[]>([]);
  const [searching, setSearching] = useState(false);

  const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];

  useEffect(() => {
    if (ids.length > 0) fetchProducts(ids);
  }, []);

  const fetchProducts = async (productIds: string[]) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('*, merchants(name, villages(name))')
        .in('id', productIds.slice(0, MAX_COMPARE));

      setProducts(((data || []) as any[]).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: p.is_promo && p.discount_percent > 0
          ? Math.round(p.price * (1 - p.discount_percent / 100))
          : p.price,
        originalPrice: p.is_promo && p.discount_percent > 0 ? p.price : undefined,
        image_url: p.image_url,
        category: p.category,
        stock: p.stock,
        sold_count: p.sold_count || 0,
        rating_avg: p.rating_avg || 0,
        rating_count: p.rating_count || 0,
        merchant_name: p.merchants?.name || '',
        village_name: p.merchants?.villages?.name || '',
        is_promo: p.is_promo,
        discount_percent: p.discount_percent,
      })));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, image_url, category, merchants(name)')
        .ilike('name', `%${q}%`)
        .eq('is_active', true)
        .limit(10);

      setSearchResults(((data || []) as any[]).map((p: any) => ({
        id: p.id, name: p.name, price: p.price, image_url: p.image_url,
        category: p.category, merchant_name: p.merchants?.name || '',
        description: '', stock: 0, sold_count: 0, rating_avg: 0, rating_count: 0,
        village_name: '', is_promo: false, discount_percent: 0,
      })));
    } finally {
      setSearching(false);
    }
  };

  const addProduct = (p: CompareProduct) => {
    if (products.find(x => x.id === p.id)) { toast.error('Produk sudah ada di perbandingan'); return; }
    if (products.length >= MAX_COMPARE) { toast.error(`Maksimal ${MAX_COMPARE} produk`); return; }
    const newProducts = [...products, p];
    setProducts(newProducts);
    fetchProducts(newProducts.map(x => x.id));
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeProduct = (id: string) => setProducts(prev => prev.filter(p => p.id !== id));

  const rows = [
    { label: 'Harga', key: 'price', render: (p: CompareProduct) => (
      <div>
        <p className="font-bold text-emerald-600">{formatPrice(p.price)}</p>
        {p.originalPrice && <p className="text-xs text-muted-foreground line-through">{formatPrice(p.originalPrice)}</p>}
      </div>
    )},
    { label: 'Toko', key: 'merchant', render: (p: CompareProduct) => (
      <div><p className="text-sm">{p.merchant_name}</p><p className="text-xs text-muted-foreground">{p.village_name}</p></div>
    )},
    { label: 'Rating', key: 'rating', render: (p: CompareProduct) => (
      <div className="flex items-center gap-1">
        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
        <span className="font-medium">{p.rating_avg > 0 ? p.rating_avg.toFixed(1) : '-'}</span>
        {p.rating_count > 0 && <span className="text-xs text-muted-foreground">({p.rating_count})</span>}
      </div>
    )},
    { label: 'Stok', key: 'stock', render: (p: CompareProduct) => (
      <span className={p.stock > 10 ? 'text-emerald-600' : p.stock > 0 ? 'text-yellow-600' : 'text-red-600'}>
        {p.stock} pcs
      </span>
    )},
    { label: 'Terjual', key: 'sold', render: (p: CompareProduct) => <span>{p.sold_count.toLocaleString('id-ID')}</span> },
    { label: 'Kategori', key: 'category', render: (p: CompareProduct) => (
      <Badge variant="outline" className="text-xs capitalize">{p.category}</Badge>
    )},
    { label: 'Promo', key: 'promo', render: (p: CompareProduct) => (
      p.is_promo
        ? <Badge className="bg-red-100 text-red-700 text-xs">-{p.discount_percent}% OFF</Badge>
        : <span className="text-muted-foreground text-sm">-</span>
    )},
  ];

  const bestPrice = products.length > 0 ? Math.min(...products.map(p => p.price)) : 0;
  const bestRating = products.length > 0 ? Math.max(...products.map(p => p.rating_avg)) : 0;
  const bestStock = products.length > 0 ? Math.max(...products.map(p => p.stock)) : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3">
          <ArrowLeft className="h-4 w-4 mr-2" />Kembali
        </Button>
        <h1 className="text-xl font-bold mb-1">Bandingkan Produk</h1>
        <p className="text-sm text-muted-foreground mb-4">Pilih hingga {MAX_COMPARE} produk untuk dibandingkan</p>

        {/* Add product search */}
        {products.length < MAX_COMPARE && (
          <div className="mb-5 relative">
            <input
              type="text"
              className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Cari produk untuk ditambahkan..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg z-10 mt-1 max-h-60 overflow-y-auto">
                {searchResults.map(p => (
                  <button key={p.id} className="w-full text-left px-4 py-2.5 hover:bg-muted flex items-center gap-3 text-sm"
                    onClick={() => addProduct(p)}>
                    <img src={p.image_url || '/placeholder.jpg'} alt={p.name} className="w-8 h-8 rounded object-cover" />
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.merchant_name} • {formatPrice(p.price)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {products.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Cari dan tambahkan produk untuk dibandingkan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              {/* Product Images Header */}
              <thead>
                <tr>
                  <th className="w-28 text-left text-sm text-muted-foreground font-normal pb-4 pr-3">Produk</th>
                  {products.map(p => (
                    <th key={p.id} className="pb-4 px-3">
                      <div className="relative">
                        <button
                          onClick={() => removeProduct(p.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center z-10 hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <img src={p.image_url || '/placeholder.jpg'} alt={p.name}
                          className="w-full h-28 object-cover rounded-xl cursor-pointer"
                          onClick={() => navigate(`/product/${p.id}`)} />
                        <p className="text-sm font-semibold mt-2 line-clamp-2 text-center">{p.name}</p>
                      </div>
                    </th>
                  ))}
                  {products.length < MAX_COMPARE && (
                    <th className="pb-4 px-3">
                      <div className="border-2 border-dashed rounded-xl h-28 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <p className="text-3xl">+</p>
                          <p className="text-xs">Tambah</p>
                        </div>
                      </div>
                    </th>
                  )}
                </tr>
              </thead>

              {/* Comparison Rows */}
              <tbody>
                {rows.map(row => (
                  <tr key={row.key} className="border-t">
                    <td className="py-3 pr-3 text-sm text-muted-foreground font-medium">{row.label}</td>
                    {products.map(p => {
                      const isBest = (row.key === 'price' && p.price === bestPrice) ||
                        (row.key === 'rating' && p.rating_avg === bestRating && bestRating > 0) ||
                        (row.key === 'stock' && p.stock === bestStock && bestStock > 0);
                      return (
                        <td key={p.id} className={`py-3 px-3 text-sm ${isBest ? 'bg-emerald-50 rounded' : ''}`}>
                          {row.render(p)}
                          {isBest && <div className="mt-1"><Badge className="text-xs bg-emerald-100 text-emerald-700">Terbaik</Badge></div>}
                        </td>
                      );
                    })}
                    {products.length < MAX_COMPARE && <td />}
                  </tr>
                ))}
              </tbody>

              {/* Action Row */}
              <tbody>
                <tr className="border-t">
                  <td className="pt-4 pr-3" />
                  {products.map(p => (
                    <td key={p.id} className="pt-4 px-3">
                      <Button size="sm" className="w-full" onClick={() => navigate(`/product/${p.id}`)}>
                        Lihat Produk
                      </Button>
                    </td>
                  ))}
                  {products.length < MAX_COMPARE && <td />}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
