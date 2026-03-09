import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CourierGuardResult {
  courierId: string | null;
  courierName: string;
  loading: boolean;
}

/**
 * Shared guard hook for courier sub-pages.
 * Fetches courier data and redirects to /courier dashboard if not APPROVED.
 * Removes duplicated auth/status checking logic from individual pages.
 */
export function useCourierGuard(): CourierGuardResult {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [courierId, setCourierId] = useState<string | null>(null);
  const [courierName, setCourierName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourier = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('couriers')
          .select('id, name, registration_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!data || data.registration_status !== 'APPROVED') {
          // Redirect to courier dashboard which shows PENDING/REJECTED/Not Found UI
          navigate('/courier', { replace: true });
          return;
        }

        setCourierId(data.id);
        setCourierName(data.name || '');
      } catch (error) {
        console.error('Error fetching courier:', error);
        navigate('/courier', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    fetchCourier();
  }, [user, navigate]);

  return { courierId, courierName, loading };
}
