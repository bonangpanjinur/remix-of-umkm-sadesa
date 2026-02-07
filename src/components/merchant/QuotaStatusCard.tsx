import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertTriangle, CreditCard, ArrowUpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMerchantQuotaInfo, type MerchantQuotaInfo } from '@/lib/quotaHelpers';

export function QuotaStatusCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<MerchantQuotaInfo | null>(null);
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
        setStatus(info);
      } catch (error) {
        console.error('Error fetching quota status:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuotaStatus();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2"><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  const usagePercentage = status.totalQuota > 0 
    ? (status.usedQuota / status.totalQuota) * 100 
    : 100;

  const isCritical = usagePercentage >= 90 || status.remainingQuota <= 0;
  const isWarning = usagePercentage >= 75 && !isCritical;
  
  const getProgressColor = () => {
    if (isCritical) return 'bg-destructive';
    if (isWarning) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <Card className={isCritical ? 'border-destructive/50 shadow-sm' : ''}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          Kuota
        </CardTitle>
        <Badge variant={status.type === 'premium' ? 'default' : 'secondary'}>
          {status.packageName}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {isCritical ? 'Kuota Hampir Habis!' : 'Penggunaan Kuota'}
              </span>
              <span className="font-bold">
                {status.usedQuota} / {status.totalQuota}
              </span>
            </div>
            <Progress 
              value={usagePercentage} 
              className="h-2" 
              indicatorClassName={getProgressColor()}
            />
            <p className="text-xs text-right text-muted-foreground font-medium">
              Sisa: {status.remainingQuota} kuota
            </p>
          </div>

          {(isCritical || isWarning) && (
            <div className={`flex items-start gap-2 p-2 rounded-md text-xs ${isCritical ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-700'}`}>
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <p>
                {status.remainingQuota <= 0 
                  ? 'Kuota habis! Toko Anda tidak dapat menerima pesanan baru.' 
                  : `Kuota menipis (${status.remainingQuota} tersisa). Segera upgrade untuk menghindari gangguan.`}
              </p>
            </div>
          )}

          <Button 
            variant={isCritical ? 'destructive' : 'outline'} 
            size="sm" 
            className="w-full"
            onClick={() => navigate('/merchant/subscription')}
          >
            {isCritical || isWarning || status.type === 'free' ? (
              <>
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Upgrade Paket
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Kelola Langganan
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
