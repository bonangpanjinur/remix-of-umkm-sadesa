import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { WithdrawalManager } from '@/components/merchant/WithdrawalManager';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';

export default function MerchantWithdrawalPage() {
  const { merchantId, loading } = useMerchantGuard();

  if (loading) {
    return (
      <MerchantLayout title="Penarikan Saldo" subtitle="Tarik pendapatan Anda">
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
    <MerchantLayout title="Penarikan Saldo" subtitle="Tarik pendapatan Anda">
      <WithdrawalManager merchantId={merchantId} />
    </MerchantLayout>
  );
}
