import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

interface SimilarProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  merchant_name: string;
}

interface Props {
  currentProductId: string;
  category: string;
  merchantId: string;
}

export function SimilarProducts({ currentProductId, category, merchantId }: Props) {
  const [products, setProducts] = useState<SimilarProduct[]>([]);

  useEffect(() => {
    async function load() {
      // Fetch products from same category or same merchant, excluding current
      const { data } = await supabase
        .from('products')
        .select('id, name, price, image_url, merchants(name)')
        .eq('is_active', true)
        .neq('id', currentProductId)
        .eq('category', category)
        .limit(6);

      const mapped = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        image_url: p.image_url,
        merchant_name: p.merchants?.name || 'Toko',
      }));
      setProducts(mapped);
    }
    load();
  }, [currentProductId, category, merchantId]);

  if (products.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="font-bold text-sm text-foreground mb-3">Produk Serupa</h3>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
        {products.map((p) => (
          <Link
            key={p.id}
            to={`/product/${p.id}`}
            className="min-w-[140px] bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition"
          >
            <div className="h-24 bg-muted">
              <OptimizedImage
                src={p.image_url || ''}
                alt={p.name}
                className="w-full h-full"
                aspectRatio="auto"
                lazy
              />
            </div>
            <div className="p-2">
              <p className="text-[9px] text-muted-foreground truncate">{p.merchant_name}</p>
              <p className="text-xs font-bold text-foreground line-clamp-1">{p.name}</p>
              <p className="text-xs font-bold text-primary mt-0.5">{formatPrice(p.price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
