import { Input } from '@/components/ui/input';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoyaltyProgram } from './types';

interface Props {
  loyaltyProgram: LoyaltyProgram;
  customerPoints: number;
  usePoints: boolean;
  pointsToRedeem: number;
  pointsDiscount: number;
  cartLength: number;
  formatCurrency: (n: number) => string;
  onToggle: (v: boolean) => void;
  onPointsInput: (v: string) => void;
}

export function POSLoyaltySection({
  loyaltyProgram, customerPoints, usePoints, pointsToRedeem,
  pointsDiscount, cartLength, formatCurrency, onToggle, onPointsInput,
}: Props) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-emerald-700">
          <Star className="h-3 w-3" />
          <span className="font-medium">{customerPoints.toLocaleString('id-ID')} poin</span>
          <span className="text-emerald-500">tersedia</span>
        </span>
        {customerPoints >= loyaltyProgram.min_redeem_points && cartLength > 0 && (
          <button
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full transition-colors',
              usePoints
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            )}
            onClick={() => onToggle(!usePoints)}
          >
            {usePoints ? '✓ Pakai Poin' : 'Tukar Poin'}
          </button>
        )}
      </div>
      {usePoints && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-emerald-600">Tukar:</span>
          <Input
            type="number"
            className="h-6 text-xs flex-1"
            min={loyaltyProgram.min_redeem_points}
            max={customerPoints}
            value={pointsToRedeem}
            onChange={e => onPointsInput(e.target.value)}
          />
          <span className="text-xs text-emerald-600">poin = {formatCurrency(pointsDiscount)}</span>
        </div>
      )}
    </div>
  );
}
