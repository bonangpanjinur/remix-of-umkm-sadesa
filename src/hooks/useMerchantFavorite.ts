import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useMerchantFavorite(merchantId: string) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkFavorite = useCallback(async () => {
    if (!user || !merchantId) return;
    const { data } = await (supabase as any)
      .from('merchant_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('merchant_id', merchantId)
      .maybeSingle();
    setIsFavorite(!!data);
  }, [user, merchantId]);

  useEffect(() => {
    checkFavorite();
  }, [checkFavorite]);

  const toggleFavorite = async () => {
    if (!user) {
      toast.error('Silakan login terlebih dahulu');
      return;
    }
    setLoading(true);
    try {
      if (isFavorite) {
        await (supabase as any)
          .from('merchant_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('merchant_id', merchantId);
        setIsFavorite(false);
        toast.success('Dihapus dari favorit');
      } else {
        await (supabase as any)
          .from('merchant_favorites')
          .insert({ user_id: user.id, merchant_id: merchantId });
        setIsFavorite(true);
        toast.success('Ditambahkan ke favorit');
      }
    } catch {
      toast.error('Gagal memperbarui favorit');
    } finally {
      setLoading(false);
    }
  };

  return { isFavorite, loading, toggleFavorite };
}
