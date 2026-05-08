import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingCart, Trash2, User, PauseCircle, Receipt, Tag, Star, Percent, Ticket, Gift, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { POSCartItem } from './POSCartItem';
import { POSLoyaltySection } from './POSLoyaltySection';
import { POSPromoInput } from './POSPromoInput';
import { CartItem, Customer, LoyaltyProgram, Promotion, Voucher } from './types';

interface Props {
  cart: CartItem[];
  discount: number;
  notes: string;
  selectedCustomer: Customer | null;
  customerName: string;
  customerTier: string;
  loyaltyProgram: LoyaltyProgram | null;
  customerPoints: number;
  usePoints: boolean;
  pointsToRedeem: number;
  pointsDiscount: number;
  pointsEarned: number;
  appliedPromo: Promotion | null;
  promoDiscount: number;
  appliedVoucher: Voucher | null;
  voucherDiscount: number;
  voucherCode: string;
  voucherError: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  heldBillsCount: number;
  formatCurrency: (n: number) => string;
  onUpdateQty: (idx: number, delta: number) => void;
  onRemoveItem: (idx: number) => void;
  onUpdateDiscount: (idx: number, val: number) => void;
  onSetDiscount: (v: number) => void;
  onSetNotes: (v: string) => void;
  onOpenCustomer: () => void;
  onOpenHeldBills: () => void;
  onHoldBill: () => void;
  onOpenPayment: () => void;
  onClearCart: () => void;
  onTogglePoints: (v: boolean) => void;
  onPointsInput: (v: string) => void;
  onApplyVoucher: () => void;
  onRemoveVoucher: () => void;
  onSetVoucherCode: (v: string) => void;
  onSetVoucherError: (v: string) => void;
}

const TIER_COLORS: Record<string, string> = {
  Bronze: '#92400e', Silver: '#6b7280', Gold: '#d97706', Platinum: '#7c3aed',
};

export function POSCart({
  cart, discount, notes, selectedCustomer, customerName, customerTier,
  loyaltyProgram, customerPoints, usePoints, pointsToRedeem, pointsDiscount,
  pointsEarned, appliedPromo, promoDiscount, appliedVoucher, voucherDiscount,
  voucherCode, voucherError, subtotal, taxAmount, total, heldBillsCount,
  formatCurrency, onUpdateQty, onRemoveItem, onUpdateDiscount, onSetDiscount,
  onSetNotes, onOpenCustomer, onOpenHeldBills, onHoldBill, onOpenPayment,
  onClearCart, onTogglePoints, onPointsInput, onApplyVoucher, onRemoveVoucher,
  onSetVoucherCode, onSetVoucherError,
}: Props) {
  const tierIcon = (tier: string) => {
    if (tier === 'Platinum') return '♛';
    if (tier === 'Gold') return '★';
    return '☆';
  };

  return (
    <div className="w-80 xl:w-96 flex flex-col bg-card">
      {/* Header */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold text-sm">Pesanan</span>
            {cart.length > 0 && <Badge className="bg-emerald-600 text-white text-xs">{cart.length}</Badge>}
          </div>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={onClearCart}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Bersihkan
            </Button>
          )}
        </div>

        {/* Customer picker */}
        <button
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 transition-colors"
          onClick={onOpenCustomer}
        >
          <User className="h-4 w-4 flex-shrink-0" />
          <span className="truncate flex-1 text-left">
            {selectedCustomer ? selectedCustomer.name : customerName || 'Pilih customer (opsional)'}
          </span>
          {selectedCustomer && loyaltyProgram && (
            <Badge
              className="text-[10px] px-1.5 py-0 ml-auto flex-shrink-0"
              style={{ backgroundColor: TIER_COLORS[customerTier] || '#6b7280', color: 'white' }}
            >
              {tierIcon(customerTier)} {customerTier}
            </Badge>
          )}
        </button>

        {/* Loyalty info */}
        {selectedCustomer && loyaltyProgram && (
          <POSLoyaltySection
            loyaltyProgram={loyaltyProgram}
            customerPoints={customerPoints}
            usePoints={usePoints}
            pointsToRedeem={pointsToRedeem}
            pointsDiscount={pointsDiscount}
            cartLength={cart.length}
            formatCurrency={formatCurrency}
            onToggle={onTogglePoints}
            onPointsInput={onPointsInput}
          />
        )}

        {/* Held bills button */}
        {heldBillsCount > 0 && (
          <Button variant="outline" size="sm" className="w-full h-8 gap-1.5 text-xs" onClick={onOpenHeldBills}>
            <PauseCircle className="h-4 w-4 text-amber-500" />
            {heldBillsCount} transaksi tertahan
          </Button>
        )}
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Pilih produk untuk mulai transaksi</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {cart.map((item, idx) => (
              <POSCartItem
                key={idx}
                item={item}
                idx={idx}
                formatCurrency={formatCurrency}
                onUpdateQty={onUpdateQty}
                onRemove={onRemoveItem}
                onUpdateDiscount={onUpdateDiscount}
              />
            ))}
          </div>
        )}
      </div>

      {/* Summary + Actions */}
      <div className="border-t p-3 space-y-2">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} item)</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Pajak</span><span>{formatCurrency(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1">
              <Tag className="h-3 w-3" />Diskon
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Rp</span>
              <Input type="number" className="h-7 w-24 text-xs"
                value={discount || ''} onChange={e => onSetDiscount(Number(e.target.value))} placeholder="0" />
            </div>
          </div>
          {promoDiscount > 0 && appliedPromo && (
            <div className="flex justify-between text-orange-600 text-xs">
              <span className="flex items-center gap-1"><Percent className="h-3 w-3" />{appliedPromo.name}</span>
              <span>-{formatCurrency(promoDiscount)}</span>
            </div>
          )}
          {voucherDiscount > 0 && appliedVoucher && (
            <div className="flex justify-between text-purple-600 text-xs">
              <span className="flex items-center gap-1">
                <Ticket className="h-3 w-3" />{appliedVoucher.code}
                <button onClick={onRemoveVoucher} className="ml-1 hover:text-red-500"><X className="h-2.5 w-2.5" /></button>
              </span>
              <span>-{formatCurrency(voucherDiscount)}</span>
            </div>
          )}
          {pointsDiscount > 0 && (
            <div className="flex justify-between text-emerald-600 text-xs">
              <span className="flex items-center gap-1"><Star className="h-3 w-3" />{pointsToRedeem.toLocaleString('id-ID')} poin</span>
              <span>-{formatCurrency(pointsDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>Total</span>
            <span className="text-emerald-600">{formatCurrency(total)}</span>
          </div>
          {selectedCustomer && loyaltyProgram && pointsEarned > 0 && (
            <div className="flex justify-between text-xs text-emerald-500 bg-emerald-50 rounded px-2 py-1">
              <span className="flex items-center gap-1"><Gift className="h-3 w-3" />Poin diperoleh</span>
              <span className="font-medium">+{pointsEarned.toLocaleString('id-ID')} poin</span>
            </div>
          )}
        </div>

        <POSPromoInput
          voucherCode={voucherCode}
          voucherError={voucherError}
          appliedVoucher={appliedVoucher}
          appliedPromo={appliedPromo}
          promoDiscount={promoDiscount}
          onSetVoucherCode={onSetVoucherCode}
          onSetVoucherError={onSetVoucherError}
          onApplyVoucher={onApplyVoucher}
          onRemoveVoucher={onRemoveVoucher}
        />

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onHoldBill} disabled={cart.length === 0} title="Tahan transaksi (F3)">
            <PauseCircle className="h-4 w-4 mr-1.5" />Tahan <span className="ml-1 text-[10px] text-muted-foreground hidden sm:inline">F3</span>
          </Button>
          <Button className="flex-1 h-9 text-sm bg-emerald-600 hover:bg-emerald-700" onClick={onOpenPayment} disabled={cart.length === 0} title="Proses pembayaran (F2)">
            <Receipt className="h-4 w-4 mr-1.5" />Bayar <span className="ml-1 text-[10px] text-emerald-200 hidden sm:inline">F2</span>
          </Button>
        </div>

        <Textarea value={notes} onChange={e => onSetNotes(e.target.value)}
          placeholder="Catatan transaksi..." rows={1} className="text-xs resize-none" />
      </div>
    </div>
  );
}
