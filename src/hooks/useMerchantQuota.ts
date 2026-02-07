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
  type?: 'free' | 'premium';
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
          .maybeSingle();

        if (!merchant) continue;

        // Get active subscriptions
        const { data: subscriptions } = await supabase
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
          .order('expired_at', { ascending: true });

        // Calculate usage from orders table for current month as fallback/validation
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', merchantId)
          .gte('created_at', startOfMonth.toISOString());

        const currentUsage = ordersCount || 0;
        let status: MerchantQuotaStatus;

        if (subscriptions && subscriptions.length > 0) {
          // Aggregate quota from all active subscriptions
          const totalQuota = subscriptions.reduce((sum, sub) => sum + sub.transaction_quota, 0);
          const usedQuota = subscriptions.reduce((sum, sub) => sum + sub.used_quota, 0);
          const remaining = totalQuota - usedQuota;
          
          // Use the package name of the first one and soonest expiry
          const firstSub = subscriptions[0];
          const pkg = firstSub.package as { name: string } | null;
          
          status = {
            merchantId,
            merchantName: merchant.name,
            canTransact: remaining > 0,
            remainingQuota: remaining,
            totalQuota: totalQuota,
            usedQuota: usedQuota,
            expiresAt: firstSub.expired_at,
            packageName: pkg?.name || (subscriptions.length > 1 ? `${pkg?.name} (+${subscriptions.length - 1} paket)` : pkg?.name) || null,
            type: 'premium'
          };
        } else {
          // Fallback to Free Tier
          const freeLimit = 100;
          const remaining = Math.max(0, freeLimit - currentUsage);
          
          status = {
            merchantId,
            merchantName: merchant.name,
            canTransact: remaining > 0,
            remainingQuota: remaining,
            totalQuota: freeLimit,
            usedQuota: currentUsage,
            expiresAt: null,
            packageName: 'Free Tier',
            type: 'free'
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

    // PHASE 3: Real-time synchronization using onSnapshot (Supabase Realtime)
    if (merchantIds.length === 0) return;

    const subscription = supabase
      .channel('quota-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchant_subscriptions',
          filter: `merchant_id=in.(${merchantIds.join(',')})`
        },
        () => {
          // Refetch when any subscription changes
          checkQuotas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [merchantIds, checkQuotas]);

  const canProceedCheckout = blockedMerchants.length === 0 && !loading;

  return {
    quotaStatuses,
    blockedMerchants,
    loading,
    canProceedCheckout,
    refetch: checkQuotas,
  };
}

// Function to use merchant quota after successful order (tier-based credits)
export async function useMerchantQuotaForOrder(merchantId: string, credits: number = 1, orderId?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('deduct_merchant_quota', {
      p_merchant_id: merchantId,
      p_credits: credits,
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
      .maybeSingle();

    if (!merchant?.user_id) return;

    const title = type === 'empty' 
      ? 'Kuota Habis!' 
      : 'Kuota Hampir Habis';
    
    const message = type === 'empty'
      ? 'Kuota Anda habis. Toko Anda tidak dapat menerima pesanan baru. Segera beli paket kuota untuk melanjutkan.'
      : `Kuota Anda tersisa ${remainingQuota}. Segera beli paket kuota agar toko tetap bisa menerima pesanan.`;

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
