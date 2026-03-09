import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { CustomerReviews } from '@/components/merchant/CustomerReviews';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';

export default function MerchantReviewsPage() {
  const { merchantId, loading } = useMerchantGuard();

  if (loading) {
    return (
      <MerchantLayout title="Ulasan Pelanggan" subtitle="Lihat dan balas ulasan">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  if (!merchantId) {
    return null; // Guard will redirect
  }

  return (
    <MerchantLayout title="Ulasan Pelanggan" subtitle="Lihat dan balas ulasan">
      <CustomerReviews merchantId={merchantId} />
    </MerchantLayout>
  );
}
