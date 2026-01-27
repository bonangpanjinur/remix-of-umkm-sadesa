import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface WishlistItem {
  id: string;
  product_id: string;
  created_at: string;
}

export function useWishlist() {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [productIds, setProductIds] = useState<Set<string>>(new Set());

  const fetchWishlist = useCallback(async () => {
    if (!user) {
      setItems([]);
      setProductIds(new Set());
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('wishlists' as any)
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const items = (data || []) as unknown as WishlistItem[];
      setItems(items);
      setProductIds(new Set(items.map(i => i.product_id)));
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const addToWishlist = async (productId: string) => {
    if (!user) {
      toast.error('Silakan login terlebih dahulu');
      return false;
    }

    try {
      const { error } = await supabase
        .from('wishlists' as any)
        .insert({ user_id: user.id, product_id: productId });

      if (error) throw error;

      setProductIds(prev => new Set(prev).add(productId));
      toast.success('Ditambahkan ke wishlist');
      fetchWishlist();
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast.info('Sudah ada di wishlist');
      } else {
        toast.error('Gagal menambahkan ke wishlist');
      }
      return false;
    }
  };

  const removeFromWishlist = async (productId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('wishlists' as any)
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) throw error;

      setProductIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
      toast.success('Dihapus dari wishlist');
      fetchWishlist();
      return true;
    } catch (error) {
      toast.error('Gagal menghapus dari wishlist');
      return false;
    }
  };

  const toggleWishlist = async (productId: string) => {
    if (productIds.has(productId)) {
      return removeFromWishlist(productId);
    } else {
      return addToWishlist(productId);
    }
  };

  const isInWishlist = (productId: string) => productIds.has(productId);

  return {
    items,
    loading,
    productIds,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isInWishlist,
    refetch: fetchWishlist,
  };
}
