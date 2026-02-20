import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MerchantProfilePage from './MerchantProfilePage';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MerchantSlugResolver() {
  const { slugOrId, slug } = useParams();
  const param = slugOrId || slug;
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function resolve() {
      if (!param) return;

      try {
        const isUuid = UUID_REGEX.test(param);

        if (isUuid) {
          // Direct ID lookup - just pass through
          setMerchantId(param);
        } else {
          // Slug lookup
          const { data, error } = await supabase
            .from('merchants')
            .select('id')
            .eq('slug', param.toLowerCase())
            .eq('status', 'ACTIVE')
            .eq('registration_status', 'APPROVED')
            .maybeSingle();

          if (error) throw error;

          if (data) {
            setMerchantId(data.id);
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
    navigate('/404', { replace: true });
    return null;
  }

  return <MerchantProfilePage overrideId={merchantId!} />;
}
