import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageCircle, X, Clock, ShoppingBag, User, Store, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
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
  buyer_merchant: ['Apakah stok masih ada?', 'Kapan pesanan saya dikirim?', 'Terima kasih!'],
};

export function OrderChat({ orderId, otherUserId, otherUserName, isOpen, onClose, chatType = 'buyer_merchant', senderRole }: OrderChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [autoDeleteInfo, setAutoDeleteInfo] = useState<string | null>(null);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [orderInfo, setOrderInfo] = useState<OrderInfo & { buyerId: string; merchantId: string | null; courierId: string | null } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch order info (items + products)
  useEffect(() => {
    if (!isOpen || !orderId) return;

    const fetchOrderInfo = async () => {
      const { data: order } = await supabase
        .from('orders')
        .select('id, total, buyer_id, merchant_id, courier_id')
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
        buyerId: order.buyer_id,
        merchantId: order.merchant_id,
        courierId: order.courier_id,
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
        .order('created_at', { ascending: true });

      if (data) {
        // Filter by chat type if needed, or show all for this order
        const filtered = chatType ? data.filter(m => m.chat_type === chatType) : data;
        setMessages(filtered as ChatMessage[]);
        
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
          if (!chatType || newMsg.chat_type === chatType) {
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

  const getRoleInfo = (senderId: string) => {
    if (!orderInfo) return { label: '', color: 'bg-muted', icon: null };
    
    // Determine sender's role based on order data
    if (senderId === orderInfo.buyerId) {
      return { label: 'Pembeli', color: 'bg-blue-100 text-blue-700', icon: <User className="h-2 w-2 mr-0.5" /> };
    }
    
    // Check if sender is merchant (can be by ID or by checking if they own the merchant_id)
    // We'll use a simple comparison with merchantId first
    if (senderId === orderInfo.merchantId) {
      return { label: 'Pedagang', color: 'bg-orange-100 text-orange-700', icon: <Store className="h-2 w-2 mr-0.5" /> };
    }
    
    // Check if sender is courier
    if (senderId === orderInfo.courierId) {
      return { label: 'Kurir', color: 'bg-green-100 text-green-700', icon: <Truck className="h-2 w-2 mr-0.5" /> };
    }
    
    // Fallback for when roles are not explicitly linked yet or different user
    return { label: 'Pengguna', color: 'bg-muted text-muted-foreground', icon: null };
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{otherUserName}</h3>
              <p className="text-[10px] text-muted-foreground">
                Order #{orderInfo?.shortId || '...'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Order Brief */}
        {orderInfo && (
          <div className="p-3 bg-accent/30 border-b border-border flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-background overflow-hidden border border-border flex-shrink-0">
              {firstItem?.imageUrl ? (
                <img src={firstItem.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium truncate">
                {firstItem?.productName}
                {otherItemsCount > 0 && ` +${otherItemsCount} produk lainnya`}
              </p>
              <p className="text-[10px] text-primary font-semibold">{formatPrice(orderInfo.total)}</p>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
          {autoDeleteInfo && (
            <div className="flex items-center justify-center gap-1.5 p-2 bg-warning/10 rounded-lg border border-warning/20 mb-4">
              <Clock className="h-3 w-3 text-warning" />
              <p className="text-[10px] text-warning font-medium">
                Pesan akan dihapus otomatis setelah pesanan selesai
              </p>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10">
              <MessageCircle className="h-12 w-12 opacity-20 mb-2" />
              <p className="text-xs">Belum ada pesan. Mulai percakapan sekarang!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.sender_id === user?.id;
              const roleInfo = getRoleInfo(msg.sender_id);
              const showDate = idx === 0 || 
                format(new Date(messages[idx-1].created_at), 'yyyy-MM-dd') !== format(new Date(msg.created_at), 'yyyy-MM-dd');
              
              return (
                <div key={msg.id} className="space-y-2">
                  {showDate && (
                    <div className="flex justify-center my-4">
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        {format(new Date(msg.created_at), 'd MMMM yyyy', { locale: idLocale })}
                      </span>
                    </div>
                  )}
                  <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {isMe ? 'Anda' : (senderNames[msg.sender_id] || otherUserName)}
                      </span>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded flex items-center font-bold uppercase tracking-wider", roleInfo.color)}>
                        {roleInfo.icon}
                        {roleInfo.label}
                      </span>
                    </div>
                    <div className={cn(
                      "max-w-[85%] px-3 py-2 rounded-2xl text-sm shadow-sm",
                      isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"
                    )}>
                      {msg.message}
                      <div className={cn(
                        "text-[9px] mt-1 flex items-center justify-end gap-1 opacity-70",
                        isMe ? "text-primary-foreground" : "text-muted-foreground"
                      )}>
                        {format(new Date(msg.created_at), 'HH:mm')}
                        {isMe && (
                          <span className="text-[10px] font-bold">
                            {msg.is_read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background rounded-b-2xl">
          {quickReplies.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
              {quickReplies.map((reply) => (
                <Button
                  key={reply}
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 rounded-full whitespace-nowrap bg-accent/50 hover:bg-accent"
                  onClick={() => handleSend(reply)}
                >
                  {reply}
                </Button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Ketik pesan..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 h-10 rounded-full bg-muted border-none focus-visible:ring-primary"
            />
            <Button 
              size="icon" 
              className="rounded-full h-10 w-10 shrink-0" 
              disabled={!newMessage.trim() || sending}
              onClick={() => handleSend()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
