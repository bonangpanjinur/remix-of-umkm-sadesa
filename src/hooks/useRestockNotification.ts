/**
 * S3-05: Notifikasi restok produk favorit/wishlist
 * Cek apakah produk di wishlist yang sebelumnya kosong sudah restok,
 * lalu kirim notifikasi ke user.
 */
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useRestockNotification() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Check on mount and periodically
    checkRestockedWishlistItems();
    const interval = setInterval(checkRestockedWishlistItems, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, [user]);

  async function checkRestockedWishlistItems() {
    if (!user) return;

    try {
      // Get user's wishlist products
      const { data: wishlist } = await supabase
        .from('wishlists' as any)
        .select('product_id')
        .eq('user_id', user.id);

      if (!wishlist || (wishlist as any[]).length === 0) return;

      const productIds = (wishlist as any[]).map((w) => w.product_id);

      // Check which wishlist products are back in stock
      const { data: products } = await supabase
        .from('products' as any)
        .select('id, name, stock, image_url, merchants(name)')
        .in('id', productIds)
        .gt('stock', 0)
        .eq('is_active', true);

      if (!products || (products as any[]).length === 0) return;

      // Get already notified products (stored in localStorage to avoid duplicates)
      const notifiedKey = `restock_notified_${user.id}`;
      const notified: string[] = JSON.parse(localStorage.getItem(notifiedKey) || '[]');

      const newlyRestocked = (products as any[]).filter((p) => !notified.includes(p.id));
      if (newlyRestocked.length === 0) return;

      // Send notifications for newly restocked products
      for (const product of newlyRestocked.slice(0, 5)) {
        await supabase.from('notifications' as any).insert({
          user_id: user.id,
          title: '🛒 Produk Wishlist Restok!',
          message: `${product.name} di ${(product.merchants as any)?.name || 'toko'} sudah tersedia kembali. Segera beli sebelum habis!`,
          type: 'product',
          link: `/product/${product.id}`,
          data: JSON.stringify({ product_id: product.id }),
        });
      }

      // Update notified list
      const newNotified = [...notified, ...newlyRestocked.map((p) => p.id)].slice(-100);
      localStorage.setItem(notifiedKey, JSON.stringify(newNotified));

    } catch (err) {
      // Silently fail — this is a background check
    }
  }
}

/**
 * Subscribe wishlist item to restock notifications.
 * Called when user adds product to wishlist.
 */
export async function subscribeProductRestock(userId: string, productId: string) {
  try {
    await supabase.from('push_subscriptions' as any).upsert({
      user_id: userId,
      subscription_type: 'product_restock',
      target_id: productId,
      is_active: true,
    }, { onConflict: 'user_id,subscription_type,target_id' });
  } catch {}
}

export async function unsubscribeProductRestock(userId: string, productId: string) {
  try {
    await supabase
      .from('push_subscriptions' as any)
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('subscription_type', 'product_restock')
      .eq('target_id', productId);
  } catch {}
}
