import { useState, useEffect } from 'react';
import { Star, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  buyer_name?: string;
}

export function ProductReviews({ merchantId }: { merchantId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(5);
      setReviews(data || []);
      setLoading(false);
    }
    load();
  }, [merchantId]);

  if (loading) return null;
  if (reviews.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="font-bold text-sm text-foreground mb-3">Ulasan Pembeli</h3>
      <div className="space-y-3">
        {reviews.map((review) => (
          <div key={review.id} className="bg-secondary rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">Pembeli</span>
              <div className="flex items-center gap-0.5 ml-auto">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${i < review.rating ? 'fill-gold text-gold' : 'text-muted'}`}
                  />
                ))}
              </div>
            </div>
            {review.comment && (
              <p className="text-xs text-foreground/80 leading-relaxed">{review.comment}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              {new Date(review.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
