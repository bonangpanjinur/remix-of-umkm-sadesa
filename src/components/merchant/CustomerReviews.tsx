import { useState, useEffect } from 'react';
import { Star, MessageSquare, Send, Image, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Review {
  id: string;
  product_id: string;
  buyer_id: string;
  rating: number;
  comment: string | null;
  image_urls: string[];
  merchant_reply: string | null;
  merchant_replied_at: string | null;
  created_at: string;
  product_name?: string;
  buyer_name?: string;
  buyer_avatar?: string | null;
}

interface CustomerReviewsProps {
  merchantId: string;
}

export function CustomerReviews({ merchantId }: CustomerReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unreplied' | 'replied'>('all');

  useEffect(() => {
    fetchReviews();
  }, [merchantId]);

  const fetchReviews = async () => {
    try {
      // Fetch reviews with product info
      const { data: reviewData, error } = await supabase
        .from('reviews')
        .select(`
          *,
          products:product_id (name)
        `)
        .eq('merchant_id', merchantId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch buyer profiles
      const buyerIds = [...new Set((reviewData || []).map(r => r.buyer_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', buyerIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, { name: p.full_name, avatar: p.avatar_url }])
      );

      const enrichedReviews: Review[] = (reviewData || []).map(r => ({
        ...r,
        product_name: r.products?.name || 'Produk tidak ditemukan',
        buyer_name: profileMap.get(r.buyer_id)?.name || 'Pembeli',
        buyer_avatar: profileMap.get(r.buyer_id)?.avatar,
      }));

      setReviews(enrichedReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitReply = async (reviewId: string) => {
    if (!replyText.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          merchant_reply: replyText.trim(),
          merchant_replied_at: new Date().toISOString(),
        })
        .eq('id', reviewId);

      if (error) throw error;

      setReviews(prev => prev.map(r => 
        r.id === reviewId 
          ? { ...r, merchant_reply: replyText.trim(), merchant_replied_at: new Date().toISOString() }
          : r
      ));
      toast.success('Balasan terkirim');
      setReplyingTo(null);
      setReplyText('');
    } catch (error) {
      toast.error('Gagal mengirim balasan');
    } finally {
      setSending(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating 
                ? 'text-yellow-500 fill-yellow-500' 
                : 'text-muted-foreground'
            }`}
          />
        ))}
      </div>
    );
  };

  const filteredReviews = reviews.filter(r => {
    if (filter === 'unreplied') return !r.merchant_reply;
    if (filter === 'replied') return !!r.merchant_reply;
    return true;
  });

  const stats = {
    total: reviews.length,
    unreplied: reviews.filter(r => !r.merchant_reply).length,
    avgRating: reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0,
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Ulasan Pelanggan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Ulasan Pelanggan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Ulasan</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-center gap-1">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              <span className="text-2xl font-bold">{stats.avgRating.toFixed(1)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Rating Rata-rata</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-warning">{stats.unreplied}</p>
            <p className="text-xs text-muted-foreground">Belum Dibalas</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            Semua
          </Button>
          <Button
            size="sm"
            variant={filter === 'unreplied' ? 'default' : 'outline'}
            onClick={() => setFilter('unreplied')}
          >
            Belum Dibalas
            {stats.unreplied > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.unreplied}
              </Badge>
            )}
          </Button>
          <Button
            size="sm"
            variant={filter === 'replied' ? 'default' : 'outline'}
            onClick={() => setFilter('replied')}
          >
            Sudah Dibalas
          </Button>
        </div>

        {/* Reviews List */}
        {filteredReviews.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {filter === 'all' ? 'Belum ada ulasan' : 'Tidak ada ulasan'}
          </p>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <div key={review.id} className="border rounded-lg p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={review.buyer_avatar || undefined} />
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{review.buyer_name}</p>
                      {renderStars(review.rating)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(review.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                    </p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {review.product_name}
                    </Badge>
                  </div>
                </div>

                {/* Comment */}
                {review.comment && (
                  <p className="text-sm">{review.comment}</p>
                )}

                {/* Images */}
                {review.image_urls && review.image_urls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {review.image_urls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Review ${index + 1}`}
                        className="w-20 h-20 rounded object-cover flex-shrink-0"
                      />
                    ))}
                  </div>
                )}

                {/* Merchant Reply */}
                {review.merchant_reply && (
                  <div className="bg-primary/5 border-l-4 border-primary p-3 rounded-r-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">Balasan Toko</Badge>
                      <span className="text-xs text-muted-foreground">
                        {review.merchant_replied_at && format(new Date(review.merchant_replied_at), 'dd MMM yyyy', { locale: id })}
                      </span>
                    </div>
                    <p className="text-sm">{review.merchant_reply}</p>
                  </div>
                )}

                {/* Reply Form */}
                {!review.merchant_reply && (
                  replyingTo === review.id ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Tulis balasan Anda..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                        >
                          Batal
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => submitReply(review.id)}
                          disabled={sending || !replyText.trim()}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Kirim
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReplyingTo(review.id)}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Balas
                    </Button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
