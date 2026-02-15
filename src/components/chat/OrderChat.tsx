import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageCircle, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  auto_delete_at: string | null;
}

interface OrderChatProps {
  orderId: string;
  otherUserId: string;
  otherUserName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderChat({ orderId, otherUserId, otherUserName, isOpen, onClose }: OrderChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [autoDeleteInfo, setAutoDeleteInfo] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !orderId || !user) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data);
        // Check auto-delete status
        const withDelete = data.find(m => m.auto_delete_at);
        if (withDelete) {
          setAutoDeleteInfo(withDelete.auto_delete_at);
        }
        // Mark unread as read
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

    // Realtime subscription
    const channel = supabase
      .channel(`chat-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages(prev => [...prev, newMsg]);
          if (newMsg.receiver_id === user.id) {
            supabase.from('chat_messages').update({ is_read: true }).eq('id', newMsg.id);
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, orderId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    try {
      await supabase.from('chat_messages').insert({
        order_id: orderId,
        sender_id: user.id,
        receiver_id: otherUserId,
        message: newMessage.trim(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

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
              <p className="text-xs text-muted-foreground">Chat Pesanan</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

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
            return (
              <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[75%] rounded-2xl px-3 py-2',
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-secondary text-secondary-foreground rounded-bl-md'
                )}>
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

        {/* Input */}
        <div className="p-3 border-t border-border flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ketik pesan..."
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend} disabled={!newMessage.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
