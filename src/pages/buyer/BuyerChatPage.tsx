import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { OrderChat, ChatType } from '@/components/chat/OrderChat';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Store, Truck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface ChatThread {
  orderId: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  chatType: ChatType;
}

export default function BuyerChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'buyer_merchant' | 'buyer_courier'>('all');
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchThreads();

    const channel = supabase
      .channel('buyer-chats')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => fetchThreads())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchThreads = async () => {
    if (!user) return;
    try {
      // Get all chat messages where user is sender or receiver
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .in('chat_type', ['buyer_merchant', 'buyer_courier'])
        .order('created_at', { ascending: false });

      if (!messages || messages.length === 0) { setThreads([]); setLoading(false); return; }

      // Group by order_id + chat_type
      const threadMap = new Map<string, ChatThread>();
      for (const msg of messages) {
        const key = `${msg.order_id}-${msg.chat_type}`;
        if (!threadMap.has(key)) {
          const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
          threadMap.set(key, {
            orderId: msg.order_id,
            otherUserId,
            otherUserName: '',
            lastMessage: msg.message,
            lastMessageAt: msg.created_at,
            unreadCount: 0,
            chatType: (msg.chat_type || 'buyer_merchant') as ChatType,
          });
        }
        if (msg.receiver_id === user.id && !msg.is_read) {
          threadMap.get(key)!.unreadCount++;
        }
      }

      // Fetch names
      const userIds = [...new Set([...threadMap.values()].map(t => t.otherUserId))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      for (const thread of threadMap.values()) {
        thread.otherUserName = nameMap.get(thread.otherUserId) || (thread.chatType === 'buyer_courier' ? 'Kurir' : 'Penjual');
      }

      setThreads(Array.from(threadMap.values()));
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = activeTab === 'all' ? threads : threads.filter(t => t.chatType === activeTab);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary px-5 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-primary-foreground">Chat Saya</h1>
        </div>
      </div>

      <div className="container max-w-md mx-auto px-4 -mt-3">
        <Tabs defaultValue="all" onValueChange={(v) => setActiveTab(v as any)}>
          <div className="bg-card rounded-xl shadow-sm p-1.5 mb-4">
            <TabsList className="w-full bg-transparent h-auto p-0 gap-1">
              <TabsTrigger value="all" className="flex-1 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Semua
              </TabsTrigger>
              <TabsTrigger value="buyer_merchant" className="flex-1 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Store className="h-3 w-3 mr-1" /> Penjual
              </TabsTrigger>
              <TabsTrigger value="buyer_courier" className="flex-1 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Truck className="h-3 w-3 mr-1" /> Kurir
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageCircle className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Belum ada percakapan</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(thread => (
              <Card key={`${thread.orderId}-${thread.chatType}`} className="cursor-pointer hover:bg-accent/50 transition" onClick={() => setSelectedThread(thread)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {thread.chatType === 'buyer_courier' ? <Truck className="h-5 w-5 text-primary" /> : <Store className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{thread.otherUserName}</span>
                      {thread.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{thread.unreadCount}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{thread.lastMessage}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(new Date(thread.lastMessageAt), { locale: idLocale, addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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
      <BottomNav />
    </div>
  );
}
