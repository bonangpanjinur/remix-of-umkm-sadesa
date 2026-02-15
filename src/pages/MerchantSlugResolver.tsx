import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MerchantProfilePage from './MerchantProfilePage';

export default function MerchantSlugResolver() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function resolveSlug() {
      if (!slug) return;

      try {
        const { data, error } = await supabase
          .from('merchants')
          .select('id')
          .eq('slug', slug.toLowerCase())
          .eq('status', 'ACTIVE')
          .eq('registration_status', 'APPROVED')
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setMerchantId(data.id);
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error('Error resolving slug:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    resolveSlug();
  }, [slug]);

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

  // Render MerchantProfilePage with resolved ID via URL override
  return <MerchantProfilePage overrideId={merchantId!} />;
}
