import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { toast } from '@/hooks/use-toast';

interface ReorderItem {
  product_id?: string | null;
  quantity: number;
}

/**
 * Reusable "Pesan Lagi" handler.
 *
 * Re-fetches each product, validates merchant active/open + stock + active flag,
 * adds available items to cart, then navigates to /cart.
 *
 * Returns a callback you can wire to any button (Orders list, Order tracking,
 * cancelled orders, etc.) without re-implementing the validation flow.
 */
export function useReorder() {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  return useCallback(
    async (items: ReorderItem[], options?: { navigateToCart?: boolean }) => {
      const navigateToCart = options?.navigateToCart ?? true;
      const productIds = items.map((i) => i.product_id).filter(Boolean) as string[];

      if (productIds.length === 0) {
        toast({ title: 'Tidak ada produk dalam pesanan ini', variant: 'destructive' });
        return { added: 0, skipped: 0 };
      }

      const { data: productsData, error } = await supabase
        .from('products')
        .select(
          `id, name, description, price, stock, is_active, image_url, category, merchant_id,
           merchants(id, name, is_open, status, registration_status)`,
        )
        .in('id', productIds);

      if (error || !productsData || productsData.length === 0) {
        toast({ title: 'Tidak dapat memuat data produk', variant: 'destructive' });
        return { added: 0, skipped: items.length };
      }

      const productMap = new Map(productsData.map((p: any) => [p.id, p]));
      let added = 0;
      let skipped = 0;

      for (const item of items) {
        const pid = item.product_id;
        if (!pid) { skipped++; continue; }
        const product = productMap.get(pid);
        if (!product || !product.is_active) { skipped++; continue; }

        const merchant = product.merchants as any;
        if (!merchant || merchant.status !== 'ACTIVE' || merchant.registration_status !== 'APPROVED') {
          skipped++;
          continue;
        }

        const stock = product.stock || 0;
        if (stock <= 0) { skipped++; continue; }

        addToCart(
          {
            id: product.id,
            name: product.name,
            description: product.description || '',
            price: product.price,
            stock,
            image: product.image_url || '/placeholder.svg',
            category: product.category || '',
            merchantId: product.merchant_id,
            merchantName: merchant?.name || '',
            isActive: product.is_active,
            isAvailable: true,
            isMerchantOpen: merchant?.is_open ?? true,
            hasQuota: true,
          } as any,
          Math.min(item.quantity, stock),
        );
        added++;
      }

      if (skipped > 0) {
        toast({
          title: `${skipped} produk tidak tersedia lagi dan dilewati`,
          variant: 'destructive',
        });
      }
      if (added > 0) {
        toast({ title: `${added} produk ditambahkan ke keranjang` });
        if (navigateToCart) navigate('/cart');
      } else if (skipped > 0) {
        toast({
          title: 'Semua produk dalam pesanan ini sudah tidak tersedia',
          variant: 'destructive',
        });
      }

      return { added, skipped };
    },
    [navigate, addToCart],
  );
}
