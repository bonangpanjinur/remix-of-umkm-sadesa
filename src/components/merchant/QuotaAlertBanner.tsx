import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMerchantQuotaInfo } from '@/lib/quotaHelpers';

export function QuotaAlertBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [totalQuota, setTotalQuota] = useState<number>(0);
  const [usedQuota, setUsedQuota] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotaStatus = async () => {
      if (!user) return;
      try {
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!merchant) { setLoading(false); return; }

        const info = await fetchMerchantQuotaInfo(merchant.id);
        setRemainingQuota(info.remainingQuota);
        setTotalQuota(info.totalQuota);
        setUsedQuota(info.usedQuota);
      } catch (error) {
        console.error('Error fetching quota status for banner:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuotaStatus();
  }, [user]);

  if (loading || remainingQuota === null) return null;

  const usagePercentage = totalQuota > 0 ? (usedQuota / totalQuota) * 100 : 100;
  const isCritical = remainingQuota <= 0;
  const isWarning = usagePercentage > 80;

  if (!isCritical && !isWarning) return null;

  return (
    <Alert 
      variant={isCritical ? "destructive" : "default"} 
      className={`mb-6 border-2 ${isCritical ? 'border-destructive bg-destructive/5' : 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10'}`}
    >
      <AlertTriangle className={`h-5 w-5 ${isCritical ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-500'}`} />
      <div className="flex-1">
        <AlertTitle className={`text-base font-bold ${isCritical ? 'text-destructive' : 'text-yellow-700 dark:text-yellow-500'}`}>
          {isCritical ? 'PENTING: Kuota Habis!' : 'Peringatan: Kuota Hampir Habis'}
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className={`text-sm mb-3 ${isCritical ? 'text-destructive/90' : 'text-yellow-700/90 dark:text-yellow-500/90'}`}>
            {isCritical ? (
              <><strong>Toko Anda tidak dapat menerima pesanan baru.</strong> Segera upgrade paket atau beli kuota tambahan.</>
            ) : (
              <>Penggunaan kuota Anda telah mencapai <strong>{Math.round(usagePercentage)}%</strong>. Sisa <strong>{remainingQuota}</strong> kuota lagi.</>
            )}
          </p>
          <Button 
            size="sm" 
            variant={isCritical ? "destructive" : "outline"}
            onClick={() => navigate('/merchant/subscription')}
            className="gap-2"
          >
            <CreditCard className="h-4 w-4" />
            {isCritical ? 'Upgrade Sekarang' : 'Beli Kuota Tambahan'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </div>
    </Alert>
  );
}
