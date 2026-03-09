import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { ScheduledPromoManager } from '@/components/merchant/ScheduledPromoManager';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';

export default function MerchantScheduledPromoPage() {
  const { merchantId, loading } = useMerchantGuard();

  if (loading) {
    return (
      <MerchantLayout title="Promo Terjadwal" subtitle="Atur promosi otomatis">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  if (!merchantId) {
    return null;
  }

  return (
    <MerchantLayout title="Promo Terjadwal" subtitle="Atur promosi otomatis">
      <ScheduledPromoManager merchantId={merchantId} />
    </MerchantLayout>
  );
}
