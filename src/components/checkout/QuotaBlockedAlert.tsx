import { AlertTriangle, Store, ShoppingBag } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import type { MerchantQuotaStatus } from '@/hooks/useMerchantQuota';

interface QuotaBlockedAlertProps {
  blockedMerchants: MerchantQuotaStatus[];
  onRemoveMerchantItems: (merchantId: string) => void;
}

export function QuotaBlockedAlert({ blockedMerchants, onRemoveMerchantItems }: QuotaBlockedAlertProps) {
  const navigate = useNavigate();

  if (blockedMerchants.length === 0) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Beberapa Toko Tidak Dapat Menerima Pesanan</AlertTitle>
      <AlertDescription className="mt-3">
        <p className="text-sm mb-3">
          Toko berikut tidak memiliki kuota transaksi aktif dan tidak dapat menerima pesanan saat ini:
        </p>
        
        <div className="space-y-2">
          {blockedMerchants.map((merchant) => (
            <div 
              key={merchant.merchantId}
              className="flex items-center justify-between bg-destructive/10 rounded-lg p-3"
            >
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                <span className="font-medium text-sm">{merchant.merchantName}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRemoveMerchantItems(merchant.merchantId)}
                className="text-xs"
              >
                Hapus dari Keranjang
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-destructive/20">
          <p className="text-xs text-muted-foreground mb-2">
            Anda dapat menghapus produk dari toko tersebut atau mencari produk serupa dari toko lain.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/explore')}
            className="w-full"
          >
            <ShoppingBag className="h-4 w-4 mr-2" />
            Cari Produk Lain
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
