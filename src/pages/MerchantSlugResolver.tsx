import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MerchantProfilePage from './MerchantProfilePage';
import { ArrowLeft, StoreIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MerchantSlugResolver() {
  const { slugOrId, slug } = useParams();
  const param = slugOrId || slug;
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [merchantStatus, setMerchantStatus] = useState<{ status: string; registration_status: string } | null>(null);

  useEffect(() => {
    async function resolve() {
      if (!param) { setNotFound(true); setLoading(false); return; }

      try {
        const isUuid = UUID_REGEX.test(param);

        if (isUuid) {
          setMerchantId(param);
        } else {
          // Slug lookup - no status filter so we can show appropriate messages
          const { data, error } = await supabase
            .from('merchants')
            .select('id, status, registration_status')
            .eq('slug', param.toLowerCase())
            .maybeSingle();

          if (error) throw error;

          if (data) {
            setMerchantId(data.id);
            setMerchantStatus({ status: data.status, registration_status: data.registration_status });
          } else {
            setNotFound(true);
          }
        }
      } catch (error) {
        console.error('Error resolving merchant:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    resolve();
  }, [param]);

  if (loading) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mobile-shell flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <StoreIcon className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold mb-2">Toko Tidak Ditemukan</h1>
        <p className="text-muted-foreground mb-6">Toko dengan URL "{param}" tidak ditemukan.</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
      </div>
    );
  }

  // Show message if merchant exists but not yet approved/active
  if (merchantStatus && merchantStatus.registration_status === 'PENDING') {
    return (
      <div className="mobile-shell flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <StoreIcon className="h-16 w-16 text-amber-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Toko Sedang Diverifikasi</h1>
        <p className="text-muted-foreground mb-6">Toko ini masih dalam proses verifikasi oleh admin.</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
      </div>
    );
  }

  if (merchantStatus && merchantStatus.registration_status === 'REJECTED') {
    return (
      <div className="mobile-shell flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <StoreIcon className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-xl font-bold mb-2">Toko Tidak Tersedia</h1>
        <p className="text-muted-foreground mb-6">Toko ini tidak tersedia saat ini.</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
      </div>
    );
  }

  return <MerchantProfilePage overrideId={merchantId!} />;
}
