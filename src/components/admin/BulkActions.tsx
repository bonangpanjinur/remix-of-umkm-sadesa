import { useState } from 'react';
import { Check, X, Loader2, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkActionsProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  allIds: string[];
  tableName: 'merchants' | 'villages' | 'couriers';
  statusField?: string;
  onComplete: () => void;
}

export function BulkActions({
  selectedIds,
  onSelectionChange,
  allIds,
  tableName,
  statusField = 'registration_status',
  onComplete,
}: BulkActionsProps) {
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);

  const isAllSelected = allIds.length > 0 && selectedIds.length === allIds.length;
  const isPartialSelected = selectedIds.length > 0 && selectedIds.length < allIds.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allIds);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.length === 0) {
      toast.error('Pilih item terlebih dahulu');
      return;
    }
    setConfirmAction(action);
  };

  const executeBulkAction = async () => {
    if (!confirmAction) return;
    
    setLoading(true);
    try {
      const newStatus = confirmAction === 'approve' ? 'APPROVED' : 'REJECTED';
      
      const { error } = await supabase
        .from(tableName)
        .update({ 
          [statusField]: newStatus,
          ...(confirmAction === 'approve' ? { 
            approved_at: new Date().toISOString(),
            status: 'ACTIVE'
          } : {
            rejection_reason: 'Ditolak secara massal'
          })
        })
        .in('id', selectedIds);

      if (error) throw error;

      toast.success(
        `${selectedIds.length} ${tableName} berhasil di${confirmAction === 'approve' ? 'setujui' : 'tolak'}`
      );
      onSelectionChange([]);
      onComplete();
    } catch (error) {
      console.error('Bulk action error:', error);
      toast.error('Gagal melakukan aksi massal');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  if (allIds.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={toggleSelectAll}
            className="data-[state=checked]:bg-primary"
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.length > 0 
              ? `${selectedIds.length} dipilih`
              : 'Pilih semua'}
          </span>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-primary border-primary hover:bg-primary/10"
              onClick={() => handleBulkAction('approve')}
              disabled={loading}
            >
              <Check className="h-4 w-4" />
              Setujui ({selectedIds.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-destructive border-destructive hover:bg-destructive/10"
              onClick={() => handleBulkAction('reject')}
              disabled={loading}
            >
              <X className="h-4 w-4" />
              Tolak ({selectedIds.length})
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Konfirmasi {confirmAction === 'approve' ? 'Persetujuan' : 'Penolakan'} Massal
            </AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan {confirmAction === 'approve' ? 'menyetujui' : 'menolak'}{' '}
              <strong>{selectedIds.length}</strong> {tableName}. Aksi ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkAction}
              disabled={loading}
              className={confirmAction === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {confirmAction === 'approve' ? 'Setujui Semua' : 'Tolak Semua'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Helper component for row selection
interface BulkSelectCheckboxProps {
  id: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function BulkSelectCheckbox({ id, selectedIds, onToggle }: BulkSelectCheckboxProps) {
  return (
    <Checkbox
      checked={selectedIds.includes(id)}
      onCheckedChange={() => onToggle(id)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
