import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ticket, Percent, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Promotion, Voucher } from './types';

interface Props {
  voucherCode: string;
  voucherError: string;
  appliedVoucher: Voucher | null;
  appliedPromo: Promotion | null;
  promoDiscount: number;
  onSetVoucherCode: (v: string) => void;
  onSetVoucherError: (v: string) => void;
  onApplyVoucher: () => void;
  onRemoveVoucher: () => void;
}

export function POSPromoInput({
  voucherCode, voucherError, appliedVoucher, appliedPromo, promoDiscount,
  onSetVoucherCode, onSetVoucherError, onApplyVoucher, onRemoveVoucher,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
      >
        <span className="flex items-center gap-1">
          <Ticket className="h-3.5 w-3.5" />
          {appliedVoucher ? `Voucher: ${appliedVoucher.code}` : 'Masukkan kode voucher'}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-1.5 px-1">
          <div className="flex gap-1.5">
            <Input
              className="h-8 text-xs font-mono uppercase"
              placeholder="KODE VOUCHER"
              value={voucherCode}
              onChange={e => { onSetVoucherCode(e.target.value.toUpperCase()); onSetVoucherError(''); }}
              onKeyDown={e => e.key === 'Enter' && onApplyVoucher()}
            />
            <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={onApplyVoucher}>
              Pakai
            </Button>
            {appliedVoucher && (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive px-2" onClick={onRemoveVoucher}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          {voucherError && <p className="text-xs text-destructive">{voucherError}</p>}
          {appliedPromo && promoDiscount > 0 && (
            <div className="text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 flex items-center gap-1">
              <Percent className="h-3 w-3" />Promo aktif: {appliedPromo.name}
            </div>
          )}
        </div>
      )}
    </>
  );
}
