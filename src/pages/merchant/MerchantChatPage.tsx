import { useState, useEffect } from 'react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { OrderChat } from '@/components/chat/OrderChat';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ChatThread {
  orderId: string;
  buyerId: string;
  buyerName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  autoDeleteAt: string | null;
}

export default function MerchantChatPage() {
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);

  useEffect(() => {
    const fetchMerchant = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();
      setMerchantId(data?.id || null);
    };
    fetchMerchant();
  }, [user]);

  useEffect(() => {
    if (!merchantId || !user) return;
    fetchThreads();

    // Realtime for new messages
    const channel = supabase
      .channel('merchant-chats')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => fetchThreads()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [merchantId, user]);

  const fetchThreads = async () => {
    if (!merchantId || !user) return;

    try {
      // Get all orders for this merchant that have chat messages
      const { data: orders } = await supabase
        .from('orders')
        .select('id, buyer_id')
        .eq('merchant_id', merchantId)
        .not('status', 'in', '("CANCELLED","REJECTED")');

      if (!orders || orders.length === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      const orderIds = orders.map(o => o.id);

      // Get chat messages grouped by order
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (!messages || messages.length === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      // Get buyer profiles
      const buyerIds = [...new Set(orders.map(o => o.buyer_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', buyerIds);

      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      // Group messages by order
      const threadMap = new Map<string, ChatThread>();
      messages.forEach(msg => {
        if (!threadMap.has(msg.order_id)) {
          const order = orders.find(o => o.id === msg.order_id);
          threadMap.set(msg.order_id, {
            orderId: msg.order_id,
            buyerId: order?.buyer_id || '',
            buyerName: nameMap.get(order?.buyer_id || '') || 'Pembeli',
            lastMessage: msg.message,
            lastMessageAt: msg.created_at,
            unreadCount: 0,
            autoDeleteAt: msg.auto_delete_at,
          });
        }
        if (msg.receiver_id === user!.id && !msg.is_read) {
          const thread = threadMap.get(msg.order_id)!;
          thread.unreadCount++;
        }
      });

      setThreads(Array.from(threadMap.values()));
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MerchantLayout title="Chat" subtitle="Percakapan dengan pembeli">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  if (!merchantId) {
    return (
      <MerchantLayout title="Chat" subtitle="Percakapan dengan pembeli">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Toko tidak ditemukan</p>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Chat" subtitle="Percakapan dengan pembeli">
      {threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageCircle className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Belum ada percakapan</p>
          <p className="text-xs text-muted-foreground mt-1">Chat akan muncul saat pembeli mengirim pesan</p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map(thread => (
            <Card
              key={thread.orderId}
              className="cursor-pointer hover:bg-accent/50 transition"
              onClick={() => setSelectedThread(thread)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{thread.buyerName}</span>
                    {thread.unreadCount > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        {thread.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{thread.lastMessage}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(thread.lastMessageAt), { locale: idLocale, addSuffix: true })}
                  </p>
                  {thread.autoDeleteAt && (
                    <div className="flex items-center gap-0.5 text-[10px] text-warning mt-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      <span>Auto-hapus</span>
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
          otherUserId={selectedThread.buyerId}
          otherUserName={selectedThread.buyerName}
          isOpen={!!selectedThread}
          onClose={() => setSelectedThread(null)}
        />
      )}
    </MerchantLayout>
  );
}
