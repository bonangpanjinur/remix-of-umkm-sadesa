import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';

interface ViewedProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  merchant_name: string;
  viewed_at: number;
}

const STORAGE_KEY = 'recently_viewed_products';

export function addToRecentlyViewed(product: { id: string; name: string; price: number; image?: string; merchantName?: string }) {
  try {
    const existing: ViewedProduct[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = existing.filter(p => p.id !== product.id);
    filtered.unshift({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image || null,
      merchant_name: product.merchantName || '',
      viewed_at: Date.now(),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch { /* ignore */ }
}

export default function RecentlyViewedPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ViewedProduct[]>([]);

  useEffect(() => {
    try {
      const stored: ViewedProduct[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setProducts(stored);
    } catch { /* ignore */ }
  }, []);

  const clearAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProducts([]);
  };

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto pb-24 px-5 py-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Terakhir Dilihat</h1>
              <p className="text-xs text-muted-foreground">{products.length} produk</p>
            </div>
          </div>
          {products.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="h-4 w-4 mr-1" />
              Hapus Semua
            </Button>
          )}
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Belum ada produk yang dilihat</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30 transition"
                onClick={() => navigate(`/product/${product.id}`)}
              >
                <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.merchant_name}</p>
                  <p className="text-sm font-bold text-primary mt-1">{formatPrice(product.price)}</p>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(product.viewed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
