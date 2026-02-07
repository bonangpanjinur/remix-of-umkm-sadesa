import { supabase } from '@/integrations/supabase/client';

const FREE_TIER_LIMIT = 100;

export interface MerchantQuotaInfo {
  hasActiveSubscription: boolean;
  remainingQuota: number;
  totalQuota: number;
  usedQuota: number;
  expiresAt: string | null;
  packageName: string | null;
  type: 'free' | 'premium';
}

/**
 * Centralized function to fetch quota status for a merchant.
 * Used by dashboard, subscription page, admin detail, and alerts.
 * This ensures consistent quota numbers across all pages.
 */
export async function fetchMerchantQuotaInfo(merchantId: string): Promise<MerchantQuotaInfo> {
  // Get ALL active subscriptions for this merchant
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

  if (subscriptions && subscriptions.length > 0) {
    const totalQuota = subscriptions.reduce((sum, sub) => sum + sub.transaction_quota, 0);
    const usedQuota = subscriptions.reduce((sum, sub) => sum + sub.used_quota, 0);
    const firstSub = subscriptions[0];
    const pkg = firstSub.package as { name: string } | null;
    const packageName = subscriptions.length > 1 
      ? `${pkg?.name || 'Premium'} (+${subscriptions.length - 1} paket)` 
      : (pkg?.name || 'Premium');

    return {
      hasActiveSubscription: true,
      remainingQuota: Math.max(0, totalQuota - usedQuota),
      totalQuota,
      usedQuota,
      expiresAt: firstSub.expired_at,
      packageName,
      type: 'premium',
    };
  }

  // Free tier fallback
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: ordersCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .gte('created_at', startOfMonth.toISOString());

  const currentUsage = ordersCount || 0;

  return {
    hasActiveSubscription: false,
    remainingQuota: Math.max(0, FREE_TIER_LIMIT - currentUsage),
    totalQuota: FREE_TIER_LIMIT,
    usedQuota: currentUsage,
    expiresAt: null,
    packageName: 'Free Tier',
    type: 'free',
  };
}

export interface QuotaUsageLog {
  id: string;
  order_id: string | null;
  order_total: number;
  credits_used: number;
  remaining_quota: number;
  notes: string | null;
  created_at: string;
}

/**
 * Fetch quota usage logs for a merchant
 */
export async function fetchQuotaUsageLogs(merchantId: string, limit: number = 20): Promise<QuotaUsageLog[]> {
  const { data, error } = await supabase
    .from('quota_usage_logs')
    .select('id, order_id, order_total, credits_used, remaining_quota, notes, created_at')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching quota usage logs:', error);
    return [];
  }

  return data || [];
}
