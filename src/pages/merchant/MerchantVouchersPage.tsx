import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { VoucherManager } from '@/components/merchant/VoucherManager';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';

export default function MerchantVouchersPage() {
  const { merchantId, loading } = useMerchantGuard();

  if (loading) {
    return (
      <MerchantLayout title="Voucher & Kupon" subtitle="Buat kode diskon untuk pembeli">
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
    <MerchantLayout title="Voucher & Kupon" subtitle="Buat kode diskon untuk pembeli">
      <VoucherManager merchantId={merchantId} />
    </MerchantLayout>
  );
}
