import { useState } from 'react';
import { Check, X, Eye, MapPin, Phone, Mail, Store, Bike } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ApprovalCardProps {
  type: 'merchant' | 'village' | 'courier';
  id: string;
  name: string;
  subtitle?: string;
  details?: Record<string, string | undefined>;
  imageUrl?: string;
  registeredAt?: string;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onView?: (id: string) => void;
}

const typeIcons = {
  merchant: <Store className="h-4 w-4" />,
  village: <MapPin className="h-4 w-4" />,
  courier: <Bike className="h-4 w-4" />,
};

const typeLabels = {
  merchant: 'Merchant',
  village: 'Desa',
  courier: 'Kurir',
};

export function ApprovalCard({
  type,
  id,
  name,
  subtitle,
  details,
  imageUrl,
  registeredAt,
  onApprove,
  onReject,
  onView,
}: ApprovalCardProps) {
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await onApprove(id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsLoading(true);
    try {
      await onReject(id, rejectReason);
      setIsRejectDialogOpen(false);
      setRejectReason('');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
        <div className="flex gap-4">
          {/* Image */}
          {imageUrl && (
            <div className="w-16 h-16 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                type === 'merchant' && "bg-primary/10 text-primary",
                type === 'village' && "bg-secondary text-secondary-foreground",
                type === 'courier' && "bg-accent text-accent-foreground",
              )}>
                {typeIcons[type]}
                {typeLabels[type]}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatDate(registeredAt)}
              </span>
            </div>

            <h3 className="font-semibold text-sm truncate">{name}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}

            {/* Details */}
            {details && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {details.phone && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {details.phone}
                  </span>
                )}
                {details.email && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {details.email}
                  </span>
                )}
                {details.location && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {details.location}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isLoading}
              className="h-8"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Setujui
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsRejectDialogOpen(true)}
              disabled={isLoading}
              className="h-8"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Tolak
            </Button>
            {onView && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onView(id)}
                className="h-8"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                Detail
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Pendaftaran</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Berikan alasan penolakan untuk <strong>{name}</strong>:
            </p>
            <Textarea
              placeholder="Alasan penolakan..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Batal
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectReason.trim() || isLoading}
            >
              Tolak Pendaftaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
