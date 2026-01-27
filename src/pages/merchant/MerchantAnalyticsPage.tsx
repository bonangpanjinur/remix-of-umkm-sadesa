import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { ProductAnalytics } from '@/components/merchant/ProductAnalytics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function MerchantAnalyticsPage() {
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMerchant = async () => {
      if (!user) return;

      try {
        const { data } = await supabase
          .from('merchants')
          .select('id')
          .eq('user_id', user.id)
          .single();

        setMerchantId(data?.id || null);
      } catch (error) {
        console.error('Error fetching merchant:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMerchant();
  }, [user]);

  if (loading) {
    return (
      <MerchantLayout title="Analitik Produk" subtitle="Performa produk Anda">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  if (!merchantId) {
    return (
      <MerchantLayout title="Analitik Produk" subtitle="Performa produk Anda">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Toko tidak ditemukan</p>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Analitik Produk" subtitle="Performa produk Anda">
      <ProductAnalytics merchantId={merchantId} />
    </MerchantLayout>
  );
}
