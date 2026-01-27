import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Send, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}

interface OrderData {
  id: string;
  merchant_id: string;
  status: string;
  merchants: { name: string } | null;
}

export default function ReviewsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (orderId && user) {
      fetchOrderData();
    }
  }, [orderId, user]);

  const fetchOrderData = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, merchant_id, status, merchants(name)')
        .eq('id', orderId)
        .eq('buyer_id', user?.id)
        .single();

      if (orderError || !orderData) {
        toast.error('Pesanan tidak ditemukan');
        navigate('/orders');
        return;
      }

      if (orderData.status !== 'DONE' && orderData.status !== 'DELIVERED') {
        toast.error('Pesanan belum selesai');
        navigate('/orders');
        return;
      }

      setOrder(orderData);

      const { data: itemsData } = await supabase
        .from('order_items')
        .select('id, product_id, product_name, product_price, quantity')
        .eq('order_id', orderId);

      setItems(itemsData || []);

      // Initialize ratings
      const initialRatings: Record<string, number> = {};
      const initialComments: Record<string, string> = {};
      (itemsData || []).forEach(item => {
        if (item.product_id) {
          initialRatings[item.product_id] = 5;
          initialComments[item.product_id] = '';
        }
      });
      setRatings(initialRatings);
      setComments(initialComments);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!order || !user) return;

    setSubmitting(true);
    try {
      const reviews = items
        .filter(item => item.product_id)
        .map(item => ({
          buyer_id: user.id,
          merchant_id: order.merchant_id,
          product_id: item.product_id,
          order_id: order.id,
          rating: ratings[item.product_id] || 5,
          comment: comments[item.product_id] || null,
        }));

      const { error } = await supabase.from('reviews').insert(reviews);

      if (error) throw error;

      toast.success('Terima kasih atas ulasan Anda!');
      navigate('/orders');
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Gagal mengirim ulasan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mobile-shell bg-background flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-5 py-4">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>

          <h1 className="text-xl font-bold mb-1">Beri Ulasan</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Pesanan dari {order?.merchants?.name}
          </p>

          <div className="space-y-4">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card rounded-xl p-4 border border-border"
              >
                <h3 className="font-medium mb-3">{item.product_name}</h3>
                
                {/* Star Rating */}
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => {
                        if (item.product_id) {
                          setRatings(prev => ({ ...prev, [item.product_id]: star }));
                        }
                      }}
                      className="p-1"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= (item.product_id ? ratings[item.product_id] || 0 : 0)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {item.product_id ? ratings[item.product_id] || 0 : 0}/5
                  </span>
                </div>

                {/* Comment */}
                <Textarea
                  placeholder="Tulis ulasan Anda (opsional)..."
                  value={item.product_id ? comments[item.product_id] || '' : ''}
                  onChange={(e) => {
                    if (item.product_id) {
                      setComments(prev => ({ ...prev, [item.product_id]: e.target.value }));
                    }
                  }}
                  rows={3}
                />
              </motion.div>
            ))}
          </div>

          <Button 
            className="w-full mt-6"
            onClick={handleSubmit}
            disabled={submitting}
          >
            <Send className="h-4 w-4 mr-2" />
            {submitting ? 'Mengirim...' : 'Kirim Ulasan'}
          </Button>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
