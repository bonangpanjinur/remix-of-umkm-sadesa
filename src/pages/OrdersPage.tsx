import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Receipt, ShoppingBag, Package, Truck, CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';

interface Order {
  id: string;
  status: string;
  total: number;
  created_at: string;
  delivery_type: string;
  merchant_name?: string;
  items_count?: number;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  NEW: { label: 'Pesanan Baru', icon: Clock, color: 'text-amber-500' },
  PROCESSED: { label: 'Diproses', icon: Package, color: 'text-blue-500' },
  SENT: { label: 'Dikirim', icon: Truck, color: 'text-primary' },
  DONE: { label: 'Selesai', icon: CheckCircle, color: 'text-green-500' },
  CANCELED: { label: 'Dibatalkan', icon: XCircle, color: 'text-destructive' },
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      setLoading(false);
      return;
    }
    
    if (user) {
      fetchOrders();
    }
  }, [user, authLoading]);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total,
          created_at,
          delivery_type,
          merchants (
            name
          ),
          order_items (
            id
          )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedOrders: Order[] = (data || []).map(order => ({
        id: order.id,
        status: order.status,
        total: order.total,
        created_at: order.created_at,
        delivery_type: order.delivery_type,
        merchant_name: order.merchants?.name || 'Toko',
        items_count: order.order_items?.length || 0,
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="mobile-shell bg-background flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mobile-shell bg-background flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
            <Receipt className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="font-bold text-lg text-foreground mb-1">Belum Login</h2>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Masuk untuk melihat pesanan Anda
          </p>
          <Button onClick={() => navigate('/auth')}>
            Masuk
          </Button>
        </div>
        <BottomNav />
      </div>
    );
  }
  
  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      
      <div className="flex-1 overflow-y-auto pb-24">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-5 py-4"
        >
          <h1 className="text-xl font-bold text-foreground mb-1">Pesanan Saya</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Kelola dan lacak pesanan Anda
          </p>
          
          {/* Cart Summary if items exist */}
          {items.length > 0 && (
            <Link 
              to="/cart"
              className="block bg-brand-light border border-primary/20 rounded-xl p-4 mb-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">Keranjang Aktif</p>
                    <p className="text-xs text-muted-foreground">{items.length} item menunggu checkout</p>
                  </div>
                </div>
                <Button size="sm">Lihat</Button>
              </div>
            </Link>
          )}
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="font-bold text-lg text-foreground mb-1">Belum Ada Pesanan</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Pesanan Anda akan muncul di sini setelah checkout
              </p>
              <Link to="/">
                <Button>Mulai Belanja</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order, index) => {
                const status = statusConfig[order.status] || statusConfig.NEW;
                const StatusIcon = status.icon;
                
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-card rounded-xl p-4 border border-border shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-sm">{order.merchant_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className={`flex items-center gap-1 ${status.color}`}>
                        <StatusIcon className="h-4 w-4" />
                        <span className="text-xs font-medium">{status.label}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        {order.items_count} item • {order.delivery_type === 'INTERNAL' ? 'Kurir Desa' : 'Ambil Sendiri'}
                      </p>
                      <p className="font-bold text-primary">{formatPrice(order.total)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
      
      <BottomNav />
    </div>
  );
}
