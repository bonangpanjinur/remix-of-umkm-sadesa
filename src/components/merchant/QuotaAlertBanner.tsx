import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface QuotaStatus {
  remainingQuota: number;
  totalQuota: number;
  usedQuota: number;
}

export function QuotaAlertBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<QuotaStatus | null>(null);
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

        if (!merchant) {
          setLoading(false);
          return;
        }

        const { data: subscriptions } = await supabase
          .from('merchant_subscriptions')
          .select('transaction_quota, used_quota, expired_at')
          .eq('merchant_id', merchant.id)
          .eq('status', 'ACTIVE')
          .gte('expired_at', new Date().toISOString());

        // Calculate usage from orders table for current month as fallback
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', merchant.id)
          .gte('created_at', startOfMonth.toISOString());

        const currentUsage = ordersCount || 0;

        if (subscriptions && subscriptions.length > 0) {
          const totalQuota = subscriptions.reduce((sum, sub) => sum + sub.transaction_quota, 0);
          const usedQuota = subscriptions.reduce((sum, sub) => sum + sub.used_quota, 0);
          setStatus({
            remainingQuota: Math.max(0, totalQuota - usedQuota),
            totalQuota: totalQuota,
            usedQuota: usedQuota,
          });
        } else {
          // Free Tier logic
          const freeLimit = 100;
          setStatus({
            remainingQuota: Math.max(0, freeLimit - currentUsage),
            totalQuota: freeLimit,
            usedQuota: currentUsage,
          });
        }
      } catch (error) {
        console.error('Error fetching quota status for banner:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotaStatus();
  }, [user]);

  if (loading || !status) return null;

  const usagePercentage = (status.usedQuota / status.totalQuota) * 100;
  const isCritical = status.remainingQuota <= 0;
  const isWarning = usagePercentage > 80;

  // Only show if usage is high or quota is empty
  if (!isCritical && !isWarning) return null;

  return (
    <Alert 
      variant={isCritical ? "destructive" : "default"} 
      className={`mb-6 border-2 ${isCritical ? 'border-destructive bg-destructive/5' : 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10'}`}
    >
      <AlertTriangle className={`h-5 w-5 ${isCritical ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-500'}`} />
      <div className="flex-1">
        <AlertTitle className={`text-base font-bold ${isCritical ? 'text-destructive' : 'text-yellow-700 dark:text-yellow-500'}`}>
          {isCritical 
            ? 'PENTING: Kuota Habis!' 
            : 'Peringatan: Kuota Hampir Habis'}
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className={`text-sm mb-3 ${isCritical ? 'text-destructive/90' : 'text-yellow-700/90 dark:text-yellow-500/90'}`}>
            {isCritical ? (
              <>
                <strong>Toko Anda tidak dapat menerima pesanan baru.</strong> Segera upgrade paket atau beli kuota tambahan untuk mengaktifkan kembali fitur pemesanan.
              </>
            ) : (
              <>
                Penggunaan kuota Anda telah mencapai <strong>{Math.round(usagePercentage)}%</strong>. Sisa <strong>{status.remainingQuota}</strong> kuota lagi sebelum toko Anda berhenti menerima pesanan.
              </>
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
