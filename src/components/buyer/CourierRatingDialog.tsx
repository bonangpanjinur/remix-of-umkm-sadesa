/**
 * S4-03: Rating kurir oleh pembeli setelah pesanan tiba
 */
import { useState } from 'react';
import { Star, Loader2, ThumbsUp, Bike } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CourierRatingDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  courierId: string;
  courierName: string;
  orderNumber: string;
}

const QUICK_TAGS = [
  'Cepat & tepat waktu',
  'Ramah & sopan',
  'Barang aman',
  'Komunikatif',
  'Profesional',
];

export function CourierRatingDialog({ open, onClose, orderId, courierId, courierName, orderNumber }: CourierRatingDialogProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = async () => {
    if (!rating) { toast.error('Pilih rating bintang terlebih dahulu'); return; }
    if (!user) return;

    setSubmitting(true);
    try {
      // Save courier rating
      await supabase.from('reviews' as any).insert({
        user_id: user.id,
        target_type: 'courier',
        target_id: courierId,
        order_id: orderId,
        rating,
        comment: comment.trim() || null,
        tags: tags.length ? tags : null,
      });

      // Update courier avg rating
      const { data: allRatings } = await supabase
        .from('reviews' as any)
        .select('rating')
        .eq('target_type', 'courier')
        .eq('target_id', courierId);

      if (allRatings && allRatings.length > 0) {
        const avg = (allRatings as any[]).reduce((s, r) => s + r.rating, 0) / allRatings.length;
        await supabase.from('couriers' as any).update({
          rating_avg: Math.round(avg * 10) / 10,
          rating_count: allRatings.length,
        }).eq('id', courierId);
      }

      // Mark order as rated
      await supabase.from('orders' as any).update({ courier_rated: true }).eq('id', orderId);

      toast.success('Rating kurir berhasil dikirim! Terima kasih');
      onClose();
    } catch (err: any) {
      toast.error('Gagal mengirim rating: ' + (err.message || 'Coba lagi'));
    } finally {
      setSubmitting(false);
    }
  };

  const ratingLabels = ['', 'Sangat Buruk', 'Buruk', 'Cukup', 'Baik', 'Sangat Baik'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bike className="h-5 w-5 text-primary" />
            Nilai Kurir
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Pesanan #{orderNumber}</p>
            <p className="font-semibold text-base">{courierName}</p>
          </div>

          {/* Star rating */}
          <div className="text-center space-y-2">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'h-10 w-10 transition-colors',
                      (hover || rating) >= star
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground/30'
                    )}
                  />
                </button>
              ))}
            </div>
            {(hover || rating) > 0 && (
              <p className="text-sm font-medium text-primary">{ratingLabels[hover || rating]}</p>
            )}
          </div>

          {/* Quick tags */}
          {rating >= 4 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Apa yang kamu suka? (opsional)</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map(tag => (
                  <Badge
                    key={tag}
                    variant={tags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleTag(tag)}
                  >
                    {tags.includes(tag) && <ThumbsUp className="h-3 w-3 mr-1" />}
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Comment */}
          <div>
            <Textarea
              placeholder="Ceritakan pengalamanmu dengan kurir ini... (opsional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">{comment.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Lewati</Button>
          <Button onClick={handleSubmit} disabled={!rating || submitting}>
            {submitting
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengirim...</>
              : <><Star className="h-4 w-4 mr-2" />Kirim Rating</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
