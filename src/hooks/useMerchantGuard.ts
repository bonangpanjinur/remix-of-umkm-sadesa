import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface MerchantGuardResult {
  merchantId: string | null;
  merchantName: string;
  loading: boolean;
}

/**
 * Shared guard hook for merchant sub-pages.
 * Fetches merchant data and redirects to /merchant dashboard if not APPROVED.
 * Removes duplicated auth/status checking logic from individual pages.
 */
export function useMerchantGuard(): MerchantGuardResult {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMerchant = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('merchants')
          .select('id, name, registration_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!data || data.registration_status !== 'APPROVED') {
          // Redirect to merchant dashboard which shows PENDING/REJECTED/Not Found UI
          navigate('/merchant', { replace: true });
          return;
        }

        setMerchantId(data.id);
        setMerchantName(data.name || '');
      } catch (error) {
        console.error('Error fetching merchant:', error);
        navigate('/merchant', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    fetchMerchant();
  }, [user, navigate]);

  return { merchantId, merchantName, loading };
}
