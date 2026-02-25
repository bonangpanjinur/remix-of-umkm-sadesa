import { useState, useEffect } from 'react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { OrderChat, ChatType } from '@/components/chat/OrderChat';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, AlertCircle, Clock, User, Truck, ShoppingBag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ChatThread {
  orderId: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  chatType: ChatType;
  autoDeleteAt: string | null;
  productName?: string;
  productImage?: string | null;
}

export default function MerchantChatPage() {
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'buyer_merchant' | 'merchant_courier'>('all');

  useEffect(() => {
    const fetchMerchant = async () => {
      if (!user) return;
      const { data } = await supabase.from('merchants').select('id').eq('user_id', user.id).single();
      setMerchantId(data?.id || null);
    };
    fetchMerchant();
  }, [user]);

  useEffect(() => {
    if (!merchantId || !user) return;
    fetchThreads();

    const channel = supabase
      .channel('merchant-chats')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => fetchThreads())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [merchantId, user]);

  const fetchThreads = async () => {
    if (!merchantId || !user) return;

    try {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .in('chat_type', ['buyer_merchant', 'merchant_courier'])
        .order('created_at', { ascending: false });

      if (!messages || messages.length === 0) { setThreads([]); setLoading(false); return; }

      const threadMap = new Map<string, ChatThread>();
      for (const msg of messages) {
        const key = `${msg.order_id}-${msg.chat_type}`;
        if (!threadMap.has(key)) {
          const otherUserId = msg.sender_id === user!.id ? msg.receiver_id : msg.sender_id;
          threadMap.set(key, {
            orderId: msg.order_id,
            otherUserId,
            otherUserName: '',
            lastMessage: msg.message,
            lastMessageAt: msg.created_at,
            unreadCount: 0,
            chatType: (msg.chat_type || 'buyer_merchant') as ChatType,
            autoDeleteAt: msg.auto_delete_at,
          });
        }
        if (msg.receiver_id === user!.id && !msg.is_read) {
          threadMap.get(key)!.unreadCount++;
        }
      }

      const userIds = [...new Set([...threadMap.values()].map(t => t.otherUserId))];
      const [{ data: profiles }, { data: merchants }, { data: couriers }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
        supabase.from('merchants').select('user_id, name').in('user_id', userIds),
        supabase.from('couriers').select('user_id, name').in('user_id', userIds),
      ]);

      for (const thread of threadMap.values()) {
        const profile = (profiles || []).find(p => p.user_id === thread.otherUserId);
        const merchant = (merchants || []).find(m => m.user_id === thread.otherUserId);
        const courier = (couriers || []).find(c => c.user_id === thread.otherUserId);
        thread.otherUserName = profile?.full_name || merchant?.name || courier?.name || (thread.chatType === 'merchant_courier' ? 'Kurir' : 'Pembeli');
      }

      // Fetch order items for product info
      const orderIds = [...new Set([...threadMap.values()].map(t => t.orderId))];
      if (orderIds.length > 0) {
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('order_id, product_name, product_id')
          .in('order_id', orderIds);

        const productIds = [...new Set((orderItems || []).map(i => i.product_id).filter(Boolean))] as string[];
        let imageMap: Record<string, string | null> = {};
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('products')
            .select('id, image_url')
            .in('id', productIds);
          if (products) {
            imageMap = Object.fromEntries(products.map(p => [p.id, p.image_url]));
          }
        }

        for (const thread of threadMap.values()) {
          const firstItem = (orderItems || []).find(i => i.order_id === thread.orderId);
          if (firstItem) {
            thread.productName = firstItem.product_name;
            thread.productImage = firstItem.product_id ? (imageMap[firstItem.product_id] || null) : null;
          }
        }
      }

      setThreads(Array.from(threadMap.values()));
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MerchantLayout title="Chat" subtitle="Percakapan dengan pembeli & kurir">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  if (!merchantId) {
    return (
      <MerchantLayout title="Chat" subtitle="Percakapan dengan pembeli & kurir">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Toko tidak ditemukan</p>
        </div>
      </MerchantLayout>
    );
  }

  const filtered = activeTab === 'all' ? threads : threads.filter(t => t.chatType === activeTab);

  return (
    <MerchantLayout title="Chat" subtitle="Percakapan dengan pembeli & kurir">
      <Tabs defaultValue="all" onValueChange={(v) => setActiveTab(v as any)}>
        <div className="bg-card rounded-xl shadow-sm p-1.5 mb-4">
          <TabsList className="w-full bg-transparent h-auto p-0 gap-1">
            <TabsTrigger value="all" className="flex-1 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Semua</TabsTrigger>
            <TabsTrigger value="buyer_merchant" className="flex-1 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <User className="h-3 w-3 mr-1" /> Pembeli
            </TabsTrigger>
            <TabsTrigger value="merchant_courier" className="flex-1 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Truck className="h-3 w-3 mr-1" /> Kurir
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageCircle className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Belum ada percakapan</p>
          <p className="text-xs text-muted-foreground mt-1">Chat akan muncul saat pembeli/kurir mengirim pesan</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(thread => (
            <Card key={`${thread.orderId}-${thread.chatType}`} className="cursor-pointer hover:bg-accent/50 transition" onClick={() => setSelectedThread(thread)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {thread.productImage ? (
                    <img src={thread.productImage} alt={thread.productName || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{thread.otherUserName}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {thread.chatType === 'merchant_courier' ? 'Kurir' : 'Pembeli'}
                    </Badge>
                    {thread.unreadCount > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{thread.unreadCount}</Badge>
                    )}
                  </div>
                  {thread.productName && (
                    <p className="text-[11px] text-primary/80 truncate">{thread.productName}</p>
                  )}
                  <p className="text-xs text-muted-foreground truncate">{thread.lastMessage}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(thread.lastMessageAt), { locale: idLocale, addSuffix: true })}
                  </p>
                  {thread.autoDeleteAt && (
                    <div className="flex items-center gap-0.5 text-[10px] text-warning mt-0.5">
                      <Clock className="h-2.5 w-2.5" /><span>Auto-hapus</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedThread && (
        <OrderChat
          orderId={selectedThread.orderId}
          otherUserId={selectedThread.otherUserId}
          otherUserName={selectedThread.otherUserName}
          chatType={selectedThread.chatType}
          isOpen={!!selectedThread}
          onClose={() => setSelectedThread(null)}
        />
      )}
    </MerchantLayout>
  );
}
