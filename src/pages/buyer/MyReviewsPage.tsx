import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, MessageCircle, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  merchant_reply: string | null;
  product: {
    name: string;
    image_url: string | null;
  } | null;
  merchant: {
    name: string;
  } | null;
}

export default function MyReviewsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchReviews();
  }, [user]);

  const fetchReviews = async () => {
    if (!user) return;
    try {
      const result: any = await supabase
        .from('reviews' as any)
        .select('id, rating, comment, created_at, merchant_reply, product_id, merchant_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const data = result.data as any[];
      const error = result.error;

      if (error) throw error;

      // Fetch product and merchant details separately
      const reviewItems: ReviewItem[] = [];
      for (const r of data || []) {
        let product = null;
        let merchant = null;
        if (r.product_id) {
          const { data: pData } = await supabase.from('products').select('name, image_url').eq('id', r.product_id).maybeSingle();
          product = pData;
        }
        if (r.merchant_id) {
          const { data: mData } = await supabase.from('merchants').select('name').eq('id', r.merchant_id).maybeSingle();
          merchant = mData;
        }
        reviewItems.push({ ...r, product, merchant });
      }
      setReviews(reviewItems);

      // already handled above
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto pb-24">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 py-4">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Ulasan Saya</h1>
              <p className="text-sm text-muted-foreground">{reviews.length} ulasan ditulis</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="font-bold text-lg mb-1">Belum Ada Ulasan</h2>
              <p className="text-sm text-muted-foreground">Ulasan Anda akan muncul di sini</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex gap-3 mb-3">
                    {review.product?.image_url ? (
                      <img src={review.product.image_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center">
                        <Star className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{review.product?.name || 'Produk'}</p>
                      <p className="text-xs text-muted-foreground">{review.merchant?.name || 'Toko'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {renderStars(review.rating)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {review.comment && (
                    <p className="text-sm text-foreground mb-3">{review.comment}</p>
                  )}

                  {review.merchant_reply && (
                    <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-primary">
                      <div className="flex items-center gap-1 mb-1">
                        <MessageCircle className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium text-primary">Balasan Penjual</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.merchant_reply}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
