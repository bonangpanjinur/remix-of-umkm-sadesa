import { useState, useEffect, useCallback } from 'react';

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
      const res = await fetch('/api/pos/merchant-quotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ merchant_ids: merchantIds }),
      });
      if (!res.ok) throw new Error('Gagal cek kuota merchant');
      const statuses: Record<string, MerchantQuotaStatus> = await res.json();
      const blocked = Object.values(statuses).filter(s => !s.canTransact);
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
    // Polling setiap 5 menit sebagai pengganti Supabase Realtime
    const interval = setInterval(checkQuotas, 5 * 60 * 1000);
    return () => clearInterval(interval);
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

// Kurangi kuota merchant setelah order berhasil
export async function useMerchantQuotaForOrder(merchantId: string, credits: number = 1): Promise<boolean> {
  try {
    const res = await fetch('/api/db/rpc/deduct_merchant_quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ p_merchant_id: merchantId, p_credits: credits }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data === true;
  } catch (error) {
    console.error('Error using merchant quota:', error);
    return false;
  }
}

// Kirim notifikasi kuota hampir habis / habis
export async function notifyMerchantLowQuota(
  merchantId: string,
  remainingQuota: number,
  type: 'low' | 'empty'
): Promise<void> {
  try {
    const title = type === 'empty' ? 'Kuota Habis!' : 'Kuota Hampir Habis';
    const message = type === 'empty'
      ? 'Kuota Anda habis. Toko Anda tidak dapat menerima pesanan baru. Segera beli paket kuota untuk melanjutkan.'
      : `Kuota Anda tersisa ${remainingQuota}. Segera beli paket kuota agar toko tetap bisa menerima pesanan.`;

    await fetch('/api/db/rpc/send_notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        p_merchant_id: merchantId,
        p_title: title,
        p_message: message,
        p_type: type === 'empty' ? 'error' : 'warning',
        p_link: '/merchant/subscription',
      }),
    });
  } catch (error) {
    console.error('Error sending quota notification:', error);
  }
}
