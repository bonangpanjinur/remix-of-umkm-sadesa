import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Send, ArrowLeft, Image as ImageIcon, X, Loader2 } from 'lucide-react';
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
  const [images, setImages] = useState<Record<string, File[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

      // Check if review already exists
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', orderId)
        .eq('buyer_id', user?.id)
        .limit(1);

      if (existingReview && existingReview.length > 0) {
        toast.info('Anda sudah memberikan ulasan untuk pesanan ini');
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
      const initialImages: Record<string, File[]> = {};
      (itemsData || []).forEach(item => {
        if (item.product_id) {
          initialRatings[item.product_id] = 5;
          initialComments[item.product_id] = '';
          initialImages[item.product_id] = [];
        }
      });
      setRatings(initialRatings);
      setComments(initialComments);
      setImages(initialImages);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (productId: string, files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files).slice(0, 3 - (images[productId]?.length || 0));
    if (newFiles.length === 0) {
      toast.error('Maksimal 3 foto per produk');
      return;
    }

    setImages(prev => ({
      ...prev,
      [productId]: [...(prev[productId] || []), ...newFiles]
    }));
  };

  const removeImage = (productId: string, index: number) => {
    setImages(prev => ({
      ...prev,
      [productId]: prev[productId].filter((_, i) => i !== index)
    }));
  };

  const uploadImages = async (productId: string): Promise<string[]> => {
    const productImages = images[productId] || [];
    if (productImages.length === 0) return [];

    setUploadingImages(prev => ({ ...prev, [productId]: true }));
    const urls: string[] = [];

    try {
      for (const file of productImages) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user?.id}/${orderId}/${productId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('review-images')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('review-images')
          .getPublicUrl(fileName);

        if (urlData) {
          urls.push(urlData.publicUrl);
        }
      }
    } finally {
      setUploadingImages(prev => ({ ...prev, [productId]: false }));
    }

    return urls;
  };

  const handleSubmit = async () => {
    if (!order || !user) return;

    setSubmitting(true);
    try {
      const reviews = [];

      for (const item of items) {
        if (!item.product_id) continue;

        const imageUrls = await uploadImages(item.product_id);

        reviews.push({
          buyer_id: user.id,
          merchant_id: order.merchant_id,
          product_id: item.product_id,
          order_id: order.id,
          rating: ratings[item.product_id] || 5,
          comment: comments[item.product_id] || null,
          image_urls: imageUrls.length > 0 ? imageUrls : null,
        });
      }

      const { error } = await supabase.from('reviews').insert(reviews);

      if (error) throw error;

      // Update has_review flag on the order
      await supabase
        .from('orders')
        .update({ has_review: true, updated_at: new Date().toISOString() })
        .eq('id', order.id);

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
                        className={`h-6 w-6 transition-colors ${
                          star <= (item.product_id ? ratings[item.product_id] || 0 : 0)
                            ? 'text-warning fill-warning'
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
                  className="mb-3"
                />

                {/* Image Upload */}
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={el => fileInputRefs.current[item.product_id] = el}
                    onChange={(e) => handleImageSelect(item.product_id, e.target.files)}
                    className="hidden"
                  />
                  
                  {/* Image Previews */}
                  {item.product_id && images[item.product_id]?.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {images[item.product_id].map((file, imgIndex) => (
                        <div key={imgIndex} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Preview ${imgIndex + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border border-border"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(item.product_id, imgIndex)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Photo Button */}
                  {item.product_id && (images[item.product_id]?.length || 0) < 3 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRefs.current[item.product_id]?.click()}
                      disabled={uploadingImages[item.product_id]}
                    >
                      {uploadingImages[item.product_id] ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4 mr-2" />
                      )}
                      Tambah Foto ({images[item.product_id]?.length || 0}/3)
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <Button 
            className="w-full mt-6"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {submitting ? 'Mengirim...' : 'Kirim Ulasan'}
          </Button>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
