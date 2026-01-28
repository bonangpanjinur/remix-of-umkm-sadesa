import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertTriangle, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface QuotaStatus {
  hasActiveSubscription: boolean;
  remainingQuota: number;
  totalQuota: number;
  usedQuota: number;
  expiresAt: string | null;
  packageName: string | null;
}

export function QuotaStatusCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotaStatus = async () => {
      if (!user) return;

      try {
        // Get merchant
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!merchant) {
          setLoading(false);
          return;
        }

        // Get active subscription
        const { data: subscription } = await supabase
          .from('merchant_subscriptions')
          .select(`
            transaction_quota,
            used_quota,
            expired_at,
            package:transaction_packages(name)
          `)
          .eq('merchant_id', merchant.id)
          .eq('status', 'ACTIVE')
          .gte('expired_at', new Date().toISOString())
          .order('expired_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subscription) {
          const pkg = subscription.package as { name: string } | null;
          setStatus({
            hasActiveSubscription: true,
            remainingQuota: subscription.transaction_quota - subscription.used_quota,
            totalQuota: subscription.transaction_quota,
            usedQuota: subscription.used_quota,
            expiresAt: subscription.expired_at,
            packageName: pkg?.name || null,
          });
        } else {
          setStatus({
            hasActiveSubscription: false,
            remainingQuota: 0,
            totalQuota: 0,
            usedQuota: 0,
            expiresAt: null,
            packageName: null,
          });
        }
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
        <CardContent className="pt-6">
          <div className="animate-pulse h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  const quotaPercentage = status.totalQuota > 0 
    ? (status.usedQuota / status.totalQuota) * 100 
    : 100;

  const isLow = status.remainingQuota <= 10 && status.remainingQuota > 0;
  const isEmpty = status.remainingQuota <= 0;

  return (
    <Card className={isEmpty ? 'border-destructive/50 bg-destructive/5' : isLow ? 'border-warning/50 bg-warning/5' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <span className="font-semibold">Kuota Transaksi</span>
          </div>
          {status.hasActiveSubscription ? (
            <Badge variant={isEmpty ? 'destructive' : isLow ? 'secondary' : 'default'}>
              {status.packageName}
            </Badge>
          ) : (
            <Badge variant="destructive">Tidak Aktif</Badge>
          )}
        </div>

        {status.hasActiveSubscription ? (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Sisa Kuota</span>
              <span className="font-medium">
                {status.remainingQuota} / {status.totalQuota}
              </span>
            </div>
            <Progress value={quotaPercentage} className="h-2 mb-3" />
            
            {isEmpty && (
              <div className="flex items-center gap-2 text-destructive text-sm mb-3">
                <AlertTriangle className="h-4 w-4" />
                <span>Kuota habis! Anda tidak dapat menerima pesanan baru.</span>
              </div>
            )}
            
            {isLow && !isEmpty && (
              <div className="flex items-center gap-2 text-warning text-sm mb-3">
                <AlertTriangle className="h-4 w-4" />
                <span>Kuota hampir habis. Segera perpanjang!</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-destructive text-sm mb-3">
            <AlertTriangle className="h-4 w-4" />
            <span>Tidak ada kuota aktif. Beli paket untuk menerima pesanan.</span>
          </div>
        )}

        <Button 
          variant={isEmpty || !status.hasActiveSubscription ? 'default' : 'outline'} 
          size="sm" 
          className="w-full"
          onClick={() => navigate('/merchant/subscription')}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          {status.hasActiveSubscription ? 'Kelola Kuota' : 'Beli Paket'}
        </Button>
      </CardContent>
    </Card>
  );
}
