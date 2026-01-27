import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MerchantQuotaStatus {
  merchantId: string;
  merchantName: string;
  canTransact: boolean;
  remainingQuota: number;
  totalQuota: number;
  usedQuota: number;
  expiresAt: string | null;
  packageName: string | null;
}

export function useMerchantQuota(merchantIds: string[]) {
  const [quotaStatuses, setQuotaStatuses] = useState<Record<string, MerchantQuotaStatus>>({});
  const [loading, setLoading] = useState(true);
  const [blockedMerchants, setBlockedMerchants] = useState<MerchantQuotaStatus[]>([]);

  const checkQuotas = useCallback(async () => {
    if (merchantIds.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const statuses: Record<string, MerchantQuotaStatus> = {};
      const blocked: MerchantQuotaStatus[] = [];

      for (const merchantId of merchantIds) {
        // Get merchant info
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id, name')
          .eq('id', merchantId)
          .single();

        if (!merchant) continue;

        // Get active subscription
        const { data: subscription } = await supabase
          .from('merchant_subscriptions')
          .select(`
            transaction_quota,
            used_quota,
            expired_at,
            status,
            package:transaction_packages(name)
          `)
          .eq('merchant_id', merchantId)
          .eq('status', 'ACTIVE')
          .gte('expired_at', new Date().toISOString())
          .order('expired_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let status: MerchantQuotaStatus;

        if (subscription) {
          const pkg = subscription.package as { name: string } | null;
          const remaining = subscription.transaction_quota - subscription.used_quota;
          
          status = {
            merchantId,
            merchantName: merchant.name,
            canTransact: remaining > 0,
            remainingQuota: remaining,
            totalQuota: subscription.transaction_quota,
            usedQuota: subscription.used_quota,
            expiresAt: subscription.expired_at,
            packageName: pkg?.name || null,
          };
        } else {
          status = {
            merchantId,
            merchantName: merchant.name,
            canTransact: false,
            remainingQuota: 0,
            totalQuota: 0,
            usedQuota: 0,
            expiresAt: null,
            packageName: null,
          };
        }

        statuses[merchantId] = status;
        
        if (!status.canTransact) {
          blocked.push(status);
        }
      }

      setQuotaStatuses(statuses);
      setBlockedMerchants(blocked);
    } catch (error) {
      console.error('Error checking merchant quotas:', error);
    } finally {
      setLoading(false);
    }
  }, [merchantIds]);

  useEffect(() => {
    checkQuotas();
  }, [checkQuotas]);

  const canProceedCheckout = blockedMerchants.length === 0 && !loading;

  return {
    quotaStatuses,
    blockedMerchants,
    loading,
    canProceedCheckout,
    refetch: checkQuotas,
  };
}

// Function to use merchant quota after successful order
export async function useMerchantQuotaForOrder(merchantId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('use_merchant_quota', {
      p_merchant_id: merchantId,
    });

    if (error) {
      console.error('Error using merchant quota:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error using merchant quota:', error);
    return false;
  }
}

// Function to send notification to merchant about low/empty quota
export async function notifyMerchantLowQuota(
  merchantId: string, 
  remainingQuota: number,
  type: 'low' | 'empty'
): Promise<void> {
  try {
    // Get merchant user_id
    const { data: merchant } = await supabase
      .from('merchants')
      .select('user_id, name')
      .eq('id', merchantId)
      .single();

    if (!merchant?.user_id) return;

    const title = type === 'empty' 
      ? 'Kuota Transaksi Habis!' 
      : 'Kuota Transaksi Hampir Habis';
    
    const message = type === 'empty'
      ? 'Kuota transaksi Anda habis. Toko Anda tidak dapat menerima pesanan baru. Segera beli paket kuota untuk melanjutkan.'
      : `Kuota transaksi Anda tersisa ${remainingQuota}. Segera beli paket kuota agar toko tetap bisa menerima pesanan.`;

    await supabase.rpc('send_notification', {
      p_user_id: merchant.user_id,
      p_title: title,
      p_message: message,
      p_type: type === 'empty' ? 'error' : 'warning',
      p_link: '/merchant/subscription',
    });
  } catch (error) {
    console.error('Error sending quota notification:', error);
  }
}
