import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';
import { HeldBill } from './types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  heldBills: HeldBill[];
  onResume: (bill: HeldBill) => void;
}

export function POSHeldBills({ open, onOpenChange, heldBills, onResume }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Transaksi Tertahan ({heldBills.length})</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {heldBills.map(bill => (
            <div key={bill.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">{bill.label}</p>
                {bill.customer_name && <p className="text-xs text-muted-foreground">{bill.customer_name}</p>}
                <p className="text-xs text-muted-foreground">{bill.items.length} item</p>
              </div>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onResume(bill)}>
                <PlayCircle className="h-4 w-4 mr-1.5" />Lanjutkan
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
