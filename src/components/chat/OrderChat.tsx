import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageCircle, X, Clock, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { formatPrice } from '@/lib/utils';

export type ChatType = 'buyer_merchant' | 'buyer_courier' | 'merchant_courier';

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  auto_delete_at: string | null;
  chat_type: string | null;
  image_url: string | null;
}

interface OrderInfo {
  shortId: string;
  total: number;
  items: { productName: string; quantity: number; imageUrl: string | null }[];
}

interface OrderChatProps {
  orderId: string;
  otherUserId: string;
  otherUserName: string;
  isOpen: boolean;
  onClose: () => void;
  chatType?: ChatType;
  senderRole?: string;
}

const QUICK_REPLIES: Record<string, string[]> = {
  merchant_courier: ['Barang sudah siap diambil', 'Tolong hubungi saya dulu', 'Alamat pickup berubah'],
  buyer_courier: ['Sudah di mana?', 'Saya tunggu di depan rumah', 'Tolong hubungi saya'],
  buyer_merchant: [],
};

const ROLE_LABELS: Record<string, { self: string; other: string }> = {
  buyer_merchant: { self: 'Pembeli', other: 'Penjual' },
  buyer_courier: { self: 'Pembeli', other: 'Kurir' },
  merchant_courier: { self: 'Penjual', other: 'Kurir' },
};

export function OrderChat({ orderId, otherUserId, otherUserName, isOpen, onClose, chatType = 'buyer_merchant', senderRole }: OrderChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [autoDeleteInfo, setAutoDeleteInfo] = useState<string | null>(null);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch order info (items + products)
  useEffect(() => {
    if (!isOpen || !orderId) return;

    const fetchOrderInfo = async () => {
      const { data: order } = await supabase
        .from('orders')
        .select('id, total')
        .eq('id', orderId)
        .single();

      const { data: items } = await supabase
        .from('order_items')
        .select('product_name, quantity, product_id')
        .eq('order_id', orderId);

      if (!order || !items) return;

      // Fetch product images
      const productIds = items.map(i => i.product_id).filter(Boolean) as string[];
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

      setOrderInfo({
        shortId: order.id.substring(0, 8).toUpperCase(),
        total: order.total,
        items: items.map(i => ({
          productName: i.product_name,
          quantity: i.quantity,
          imageUrl: i.product_id ? (imageMap[i.product_id] || null) : null,
        })),
      });
    };

    fetchOrderInfo();
  }, [isOpen, orderId]);

  // Memoize unique sender IDs to avoid re-fetching on every render
  const senderIdsKey = useMemo(() => {
    return [...new Set(messages.map(m => m.sender_id))].sort().join(',');
  }, [messages]);

  // Fetch sender names from profiles
  useEffect(() => {
    if (!isOpen || !senderIdsKey) return;

    const uniqueSenderIds = senderIdsKey.split(',').filter(Boolean);
    const missingIds = uniqueSenderIds.filter(id => !senderNames[id]);

    if (missingIds.length === 0) return;

    const fetchNames = async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', missingIds);

      const { data: merchants } = await supabase
        .from('merchants')
        .select('user_id, name')
        .in('user_id', missingIds);

      const { data: couriers } = await supabase
        .from('couriers')
        .select('user_id, name')
        .in('user_id', missingIds);

      const nameMap: Record<string, string> = { ...senderNames };

      missingIds.forEach(id => {
        const merchant = merchants?.find(m => m.user_id === id);
        const courier = couriers?.find(c => c.user_id === id);
        const profile = profiles?.find(p => p.user_id === id);

        if (merchant) {
          nameMap[id] = merchant.name;
        } else if (courier) {
          nameMap[id] = courier.name;
        } else if (profile?.full_name) {
          nameMap[id] = profile.full_name;
        } else {
          nameMap[id] = 'Pengguna';
        }
      });

      setSenderNames(nameMap);
    };

    fetchNames();
  }, [isOpen, senderIdsKey]);

  useEffect(() => {
    if (!isOpen || !orderId || !user) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('order_id', orderId)
        .eq('chat_type', chatType)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data as ChatMessage[]);
        const withDelete = data.find(m => m.auto_delete_at);
        if (withDelete) setAutoDeleteInfo(withDelete.auto_delete_at);
        
        const unread = data.filter(m => m.receiver_id === user.id && !m.is_read);
        if (unread.length > 0) {
          await supabase
            .from('chat_messages')
            .update({ is_read: true })
            .in('id', unread.map(m => m.id));
        }
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat-${orderId}-${chatType}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg.chat_type === chatType) {
            setMessages(prev => [...prev, newMsg]);
            if (newMsg.receiver_id === user.id) {
              supabase.from('chat_messages').update({ is_read: true }).eq('id', newMsg.id);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${orderId}` },
        () => {
          setMessages([]);
          setAutoDeleteInfo(null);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOpen, orderId, user, chatType]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const text = (messageText || newMessage).trim();
    if (!text || !user || sending) return;

    setSending(true);
    try {
      await supabase.from('chat_messages').insert({
        order_id: orderId,
        sender_id: user.id,
        receiver_id: otherUserId,
        message: text,
        chat_type: chatType,
      });
      if (!messageText) setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const getRoleLabel = (senderId: string): string => {
    const labels = ROLE_LABELS[chatType];
    if (!labels) return '';
    if (senderId === user?.id) return labels.self;
    return labels.other;
  };

  const quickReplies = QUICK_REPLIES[chatType] || [];

  if (!isOpen) return null;

  const firstItem = orderInfo?.items?.[0];
  const otherItemsCount = (orderInfo?.items?.length || 0) - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-sm">{otherUserName}</h3>
              <p className="text-xs text-muted-foreground">
                {chatType === 'buyer_merchant' ? 'Chat Pesanan' : 
                 chatType === 'buyer_courier' ? 'Chat Kurir' : 'Chat Penjual-Kurir'}
                {orderInfo && <span className="ml-1 font-mono">#{orderInfo.shortId}</span>}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Order Info Card */}
        {orderInfo && firstItem && (
          <div className="px-4 py-2.5 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {firstItem.imageUrl ? (
                  <img src={firstItem.imageUrl} alt={firstItem.productName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{firstItem.productName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {firstItem.quantity}x
                  {otherItemsCount > 0 && ` +${otherItemsCount} produk lainnya`}
                  <span className="mx-1">•</span>
                  <span className="font-medium text-foreground">{formatPrice(orderInfo.total)}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Auto-delete warning */}
        {autoDeleteInfo && (
          <div className="px-4 py-2 bg-warning/10 text-warning text-xs flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Chat akan otomatis dihapus {formatDistanceToNow(new Date(autoDeleteInfo), { locale: idLocale, addSuffix: true })}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Belum ada pesan. Mulai chat tentang pesanan ini.
            </div>
          )}
          {messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            const senderDisplayName = senderNames[msg.sender_id] || 'Memuat...';
            const roleLabel = getRoleLabel(msg.sender_id);
            return (
              <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[75%] rounded-2xl px-3 py-2',
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-secondary text-secondary-foreground rounded-bl-md'
                )}>
                  {/* Sender name label with role */}
                  <p className={cn(
                    'text-[11px] font-semibold mb-0.5',
                    isMine ? 'text-primary-foreground/80' : 'text-primary'
                  )}>
                    {isMine ? 'Anda' : senderDisplayName}
                    {roleLabel && (
                      <span className={cn(
                        'ml-1 font-normal',
                        isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'
                      )}>
                        ({roleLabel})
                      </span>
                    )}
                  </p>
                  {msg.image_url && (
                    <img src={msg.image_url} alt="Chat image" className="rounded-lg mb-1 max-h-40 object-cover" />
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  <p className={cn(
                    'text-[10px] mt-1',
                    isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}>
                    {format(new Date(msg.created_at), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies */}
        {quickReplies.length > 0 && messages.length === 0 && (
          <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => handleSend(reply)}
                className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-border flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ketik pesan..."
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1"
          />
          <Button size="icon" onClick={() => handleSend()} disabled={!newMessage.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
