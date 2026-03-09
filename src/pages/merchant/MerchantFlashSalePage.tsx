import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { FlashSaleManager } from '@/components/merchant/FlashSaleManager';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';

export default function MerchantFlashSalePage() {
  const { merchantId, loading } = useMerchantGuard();

  if (loading) {
    return (
      <MerchantLayout title="Flash Sale" subtitle="Food Rescue & Promo Kilat">
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
    <MerchantLayout title="Flash Sale" subtitle="Food Rescue & Promo Kilat">
      <FlashSaleManager merchantId={merchantId} />
    </MerchantLayout>
  );
}
