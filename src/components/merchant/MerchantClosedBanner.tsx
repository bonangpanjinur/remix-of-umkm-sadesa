import { Clock, AlertTriangle } from 'lucide-react';
import { getMerchantOperatingStatus, formatTime } from '@/lib/merchantOperatingHours';

interface MerchantClosedBannerProps {
  isManuallyOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  merchantName?: string;
  hasQuota?: boolean;
}

export function MerchantClosedBanner({
  isManuallyOpen,
  openTime,
  closeTime,
  merchantName,
  hasQuota = true,
}: MerchantClosedBannerProps) {
  const status = getMerchantOperatingStatus(isManuallyOpen, openTime, closeTime);
  
  // Quota depleted takes priority
  if (!hasQuota) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-destructive text-sm">
              {merchantName ? `${merchantName} sedang tutup` : 'Toko sedang tutup'}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Toko ini tidak dapat menerima pesanan saat ini karena kuota transaksi habis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status.isCurrentlyOpen) {
    return null;
  }

  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
          <Clock className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-destructive text-sm">
            {merchantName ? `${merchantName} sedang tutup` : 'Toko sedang tutup'}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {status.reason}
          </p>
          {status.nextOpenAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Buka kembali pukul <span className="font-medium">{formatTime(status.nextOpenAt)}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface MerchantStatusBadgeProps {
  isManuallyOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  hasQuota?: boolean;
  size?: 'sm' | 'md';
}

export function MerchantStatusBadge({
  isManuallyOpen,
  openTime,
  closeTime,
  hasQuota = true,
  size = 'sm',
}: MerchantStatusBadgeProps) {
  const status = getMerchantOperatingStatus(isManuallyOpen, openTime, closeTime);
  
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';
  
  // Quota depleted = closed
  if (!hasQuota) {
    return (
      <span className={`inline-flex items-center gap-1 bg-destructive/10 text-destructive rounded-full font-medium ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 bg-destructive rounded-full" />
        Tutup
      </span>
    );
  }

  if (status.isCurrentlyOpen) {
    return (
      <span className={`inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full font-medium ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
        Buka
      </span>
    );
  }
  
  return (
    <span className={`inline-flex items-center gap-1 bg-destructive/10 text-destructive rounded-full font-medium ${sizeClasses}`}>
      <span className="w-1.5 h-1.5 bg-destructive rounded-full" />
      Tutup
    </span>
  );
}
