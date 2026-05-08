import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Banknote, QrCode, CreditCard, CheckCircle2, Percent, Ticket, Star, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Customer, LoyaltyProgram, Promotion, Voucher } from './types';

const paymentMethods = [
  { value: 'cash',     label: 'Tunai',    icon: <Banknote  className="h-4 w-4" /> },
  { value: 'qris',     label: 'QRIS',     icon: <QrCode    className="h-4 w-4" /> },
  { value: 'transfer', label: 'Transfer', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'debit',    label: 'Debit',    icon: <CreditCard className="h-4 w-4" /> },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subtotal: number;
  taxAmount: number;
  discount: number;
  promoDiscount: number;
  voucherDiscount: number;
  pointsDiscount: number;
  total: number;
  paymentMethod: string;
  paymentAmount: string;
  isSplitPayment: boolean;
  splitMethod2: string;
  splitAmount1: string;
  splitAmount2: string;
  appliedPromo: Promotion | null;
  appliedVoucher: Voucher | null;
  pointsToRedeem: number;
  pointsEarned: number;
  selectedCustomer: Customer | null;
  loyaltyProgram: LoyaltyProgram | null;
  formatCurrency: (n: number) => string;
  onChange: (field: string, value: string | boolean) => void;
  onProcess: () => void;
}

export function POSPaymentDialog({
  open, onOpenChange, subtotal, taxAmount, discount, promoDiscount,
  voucherDiscount, pointsDiscount, total, paymentMethod, paymentAmount,
  isSplitPayment, splitMethod2, splitAmount1, splitAmount2,
  appliedPromo, appliedVoucher, pointsToRedeem, pointsEarned,
  selectedCustomer, loyaltyProgram, formatCurrency, onChange, onProcess,
}: Props) {
  const change = paymentMethod === 'cash' ? Math.max(0, (Number(paymentAmount) || 0) - total) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Proses Pembayaran</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Ringkasan */}
          <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            {taxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Pajak</span><span>{formatCurrency(taxAmount)}</span></div>}
            {discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Diskon manual</span><span>-{formatCurrency(discount)}</span></div>}
            {promoDiscount > 0 && (
              <div className="flex justify-between text-orange-600">
                <span className="flex items-center gap-1"><Percent className="h-3 w-3" />{appliedPromo?.name}</span>
                <span>-{formatCurrency(promoDiscount)}</span>
              </div>
            )}
            {voucherDiscount > 0 && (
              <div className="flex justify-between text-purple-600">
                <span className="flex items-center gap-1"><Ticket className="h-3 w-3" />{appliedVoucher?.code}</span>
                <span>-{formatCurrency(voucherDiscount)}</span>
              </div>
            )}
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span className="flex items-center gap-1"><Star className="h-3 w-3" />{pointsToRedeem.toLocaleString('id-ID')} poin</span>
                <span>-{formatCurrency(pointsDiscount)}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span>Total Tagihan</span>
              <span className="text-emerald-600">{formatCurrency(total)}</span>
            </div>
            {selectedCustomer && loyaltyProgram && pointsEarned > 0 && (
              <div className="flex justify-between text-xs text-emerald-500 bg-emerald-50 rounded px-2 py-1">
                <span className="flex items-center gap-1"><Gift className="h-3 w-3" />Poin yang akan diperoleh</span>
                <span className="font-medium">+{pointsEarned.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>

          {/* Metode */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Metode Pembayaran</Label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(pm => (
                <button key={pm.value} onClick={() => onChange('paymentMethod', pm.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                    paymentMethod === pm.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'hover:border-muted-foreground/40'
                  )}>
                  {pm.icon}{pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Split toggle */}
          <div className="flex items-center justify-between py-1 border-t">
            <Label className="text-xs text-muted-foreground">Bayar dengan 2 metode (split)</Label>
            <button
              className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', isSplitPayment ? 'bg-emerald-500' : 'bg-gray-300')}
              onClick={() => onChange('isSplitPayment', String(!isSplitPayment))}
            >
              <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform', isSplitPayment ? 'translate-x-4' : 'translate-x-1')} />
            </button>
          </div>

          {/* Cash input */}
          {!isSplitPayment && paymentMethod === 'cash' && (
            <div>
              <Label>Jumlah Bayar</Label>
              <Input className="mt-1 text-lg font-bold h-12" type="number"
                value={paymentAmount} onChange={e => onChange('paymentAmount', e.target.value)} placeholder="0" autoFocus />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {[total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000]
                  .filter((v, i, arr) => arr.indexOf(v) === i && v >= total)
                  .slice(0, 4)
                  .map(v => (
                    <Button key={v} variant="outline" size="sm" className="text-xs h-7"
                      onClick={() => onChange('paymentAmount', String(v))}>
                      {formatCurrency(v)}
                    </Button>
                  ))}
              </div>
              {Number(paymentAmount) >= total && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">Kembalian: <strong>{formatCurrency(change)}</strong></p>
                </div>
              )}
            </div>
          )}

          {/* Split inputs */}
          {isSplitPayment && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Pembayaran Split</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Metode 1</Label>
                  <Select value={paymentMethod} onValueChange={v => onChange('paymentMethod', v)}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(pm => <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="mt-1 h-8 text-xs" type="number" value={splitAmount1} onChange={e => onChange('splitAmount1', e.target.value)} placeholder="Jumlah" />
                </div>
                <div>
                  <Label className="text-xs">Metode 2</Label>
                  <Select value={splitMethod2} onValueChange={v => onChange('splitMethod2', v)}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(pm => <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="mt-1 h-8 text-xs" type="number" value={splitAmount2} onChange={e => onChange('splitAmount2', e.target.value)} placeholder="Jumlah" />
                </div>
              </div>
              {(Number(splitAmount1) + Number(splitAmount2)) > 0 && (
                <div className={cn('text-xs rounded p-2', (Number(splitAmount1) + Number(splitAmount2)) >= total ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                  Total dibayar: {formatCurrency(Number(splitAmount1) + Number(splitAmount2))} / {formatCurrency(total)}
                  {(Number(splitAmount1) + Number(splitAmount2)) >= total && ` · Kembalian: ${formatCurrency((Number(splitAmount1) + Number(splitAmount2)) - total)}`}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onProcess}>
            <CheckCircle2 className="h-4 w-4 mr-2" />Selesaikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
