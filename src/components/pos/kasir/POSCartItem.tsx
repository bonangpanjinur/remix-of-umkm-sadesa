import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus, X, Tag } from 'lucide-react';
import { CartItem } from './types';

interface Props {
  item: CartItem;
  idx: number;
  formatCurrency: (n: number) => string;
  onUpdateQty: (idx: number, delta: number) => void;
  onRemove: (idx: number) => void;
  onUpdateDiscount: (idx: number, val: number) => void;
}

export function POSCartItem({ item, idx, formatCurrency, onUpdateQty, onRemove, onUpdateDiscount }: Props) {
  return (
    <div className="p-2 rounded-lg bg-background border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{item.name}</p>
          {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
          <p className="text-xs text-emerald-600">{formatCurrency(item.price)} / {item.unit}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => onRemove(idx)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => onUpdateQty(idx, -1)}>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-sm font-medium w-8 text-center">{item.qty}</span>
          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => onUpdateQty(idx, 1)}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Tag className="h-3 w-3 text-muted-foreground" />
          <Input type="number" className="h-6 w-20 text-xs" placeholder="Diskon"
            value={item.discount || ''}
            onChange={e => onUpdateDiscount(idx, Number(e.target.value))} />
        </div>
        <p className="text-sm font-bold">{formatCurrency(item.price * item.qty - item.discount)}</p>
      </div>
    </div>
  );
}
