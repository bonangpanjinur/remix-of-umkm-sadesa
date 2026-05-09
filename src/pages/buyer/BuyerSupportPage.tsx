import { useState } from 'react';
import {
  TicketCheck, Plus, MessageSquare, Clock, CheckCircle2,
  XCircle, AlertCircle, Send, ArrowLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Konfigurasi status / Status configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open:        { label: 'Baru',          color: 'bg-amber-100 text-amber-700',   icon: Clock },
  in_progress: { label: 'Diproses',      color: 'bg-blue-100 text-blue-700',     icon: RefreshCw },
  waiting:     { label: 'Balas Anda',    color: 'bg-purple-100 text-purple-700', icon: AlertCircle },
  resolved:    { label: 'Selesai',       color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  closed:      { label: 'Ditutup',       color: 'bg-gray-100 text-gray-600',     icon: XCircle },
};

const CATEGORIES = [
  { value: 'order',     label: 'Masalah Pesanan' },
  { value: 'payment',  label: 'Masalah Pembayaran' },
  { value: 'account',  label: 'Masalah Akun' },
  { value: 'technical',label: 'Kendala Teknis' },
  { value: 'other',    label: 'Lainnya' },
];

interface SupportMessage {
  id: string;
  sender_role: 'user' | 'admin';
  message: string;
  created_at: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  messages?: SupportMessage[];
}

interface NewTicketForm {
  subject: string;
  category: string;
  message: string;
}

export default function BuyerSupportPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView]                 = useState<'list' | 'detail' | 'new'>('list');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText]       = useState('');
  const [form, setForm]                 = useState<NewTicketForm>({ subject: '', category: '', message: '' });

  // Ambil tiket milik user / Fetch user's tickets
  const { data: tickets = [], isLoading, refetch } = useQuery<SupportTicket[]>({
    queryKey: ['buyer-support-tickets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, subject, category, status, created_at, updated_at')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Ambil pesan tiket yang dipilih / Fetch messages for selected ticket
  const { data: messages = [] } = useQuery<SupportMessage[]>({
    queryKey: ['buyer-ticket-messages', selectedTicket?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select('id, sender_role, message, created_at')
        .eq('ticket_id', selectedTicket!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as SupportMessage[];
    },
    enabled: !!selectedTicket && view === 'detail',
    staleTime: 10_000,
  });

  // Buat tiket baru / Create new ticket
  const createMutation = useMutation({
    mutationFn: async (f: NewTicketForm) => {
      const now = new Date().toISOString();
      const { data: ticket, error: tErr } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user!.id,
          subject: f.subject,
          category: f.category,
          status: 'open',
          priority: 'medium',
          created_at: now,
          updated_at: now,
          last_message_at: now,
          message_count: 1,
        })
        .select('id')
        .single();
      if (tErr) throw tErr;

      const { error: mErr } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: user!.id,
          sender_role: 'user',
          message: f.message,
          created_at: now,
        });
      if (mErr) throw mErr;
      return ticket;
    },
    onSuccess: () => {
      toast.success('Tiket berhasil dikirim! Tim support kami akan merespons segera.');
      setForm({ subject: '', category: '', message: '' });
      queryClient.invalidateQueries({ queryKey: ['buyer-support-tickets', user?.id] });
      setView('list');
    },
    onError: () => toast.error('Gagal membuat tiket. Coba lagi.'),
  });

  // Kirim balasan / Send reply
  const replyMutation = useMutation({
    mutationFn: async (text: string) => {
      const now = new Date().toISOString();
      const { error: mErr } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: selectedTicket!.id,
          sender_id: user!.id,
          sender_role: 'user',
          message: text,
          created_at: now,
        });
      if (mErr) throw mErr;

      await supabase
        .from('support_tickets')
        .update({ status: 'open', updated_at: now, last_message_at: now })
        .eq('id', selectedTicket!.id);
    },
    onSuccess: () => {
      toast.success('Pesan terkirim');
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['buyer-ticket-messages', selectedTicket?.id] });
      queryClient.invalidateQueries({ queryKey: ['buyer-support-tickets', user?.id] });
    },
    onError: () => toast.error('Gagal mengirim pesan'),
  });

  const openDetail = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setView('detail');
  };

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 py-4 max-w-lg mx-auto">

          {/* Tampilan Daftar / List View */}
          {view === 'list' && (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-xl font-bold">Bantuan & Support</h1>
                  <p className="text-sm text-muted-foreground">Ajukan pertanyaan atau laporkan masalah</p>
                </div>
                <Button size="sm" onClick={() => setView('new')}>
                  <Plus className="h-4 w-4 mr-1" /> Buat Tiket
                </Button>
              </div>

              {/* Info SLA */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  Tim kami akan merespons tiket Anda dalam <strong>24 jam kerja</strong>. Untuk bantuan cepat, cek juga halaman FAQ.
                </p>
              </div>

              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse mb-3" />
                ))
              ) : tickets.length === 0 ? (
                <div className="text-center py-14">
                  <TicketCheck className="h-14 w-14 mx-auto mb-3 text-muted-foreground/30" />
                  <h3 className="font-medium text-base mb-1">Belum ada tiket</h3>
                  <p className="text-sm text-muted-foreground mb-4">Ada pertanyaan atau masalah? Hubungi kami!</p>
                  <Button onClick={() => setView('new')}>
                    <Plus className="h-4 w-4 mr-1" /> Buat Tiket Pertama
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {tickets.map(ticket => {
                    const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['open'];
                    const StatusIcon = st.icon;
                    return (
                      <Card
                        key={ticket.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => openDetail(ticket)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{ticket.subject}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge className={`text-[10px] px-1.5 py-0 ${st.color} border-0`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {st.label}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true, locale: idLocale })}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Tampilan Detail Tiket / Ticket Detail View */}
          {view === 'detail' && selectedTicket && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <Button variant="ghost" size="icon" onClick={() => setView('list')}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold truncate text-sm">{selectedTicket.subject}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className={`text-[10px] px-1.5 py-0 border-0 ${STATUS_CONFIG[selectedTicket.status]?.color || ''}`}>
                      {STATUS_CONFIG[selectedTicket.status]?.label}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      #{selectedTicket.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Thread Pesan / Message Thread */}
              <div className="space-y-3 mb-4">
                {messages.map(msg => {
                  const isUser = msg.sender_role === 'user';
                  return (
                    <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted rounded-tl-sm'
                      }`}>
                        <p className={`text-[10px] font-medium mb-1 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {isUser ? 'Anda' : 'Tim Support DesaMart'}
                        </p>
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${isUser ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                          {format(new Date(msg.created_at), 'dd MMM HH:mm', { locale: idLocale })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Balas / Reply */}
              {['open', 'in_progress', 'waiting', 'resolved'].includes(selectedTicket.status) && selectedTicket.status !== 'closed' && (
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <Textarea
                      placeholder="Tulis pesan Anda..."
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      rows={3}
                      className="resize-none text-sm"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => replyMutation.mutate(replyText)}
                      disabled={!replyText.trim() || replyMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {replyMutation.isPending ? 'Mengirim...' : 'Kirim Pesan'}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {selectedTicket.status === 'closed' && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Tiket ini telah ditutup. Buat tiket baru jika masih perlu bantuan.
                </div>
              )}
            </>
          )}

          {/* Form Tiket Baru / New Ticket Form */}
          {view === 'new' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <Button variant="ghost" size="icon" onClick={() => setView('list')}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h2 className="font-bold">Buat Tiket Support</h2>
                  <p className="text-xs text-muted-foreground">Jelaskan masalah Anda dengan detail</p>
                </div>
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Kategori Masalah *</Label>
                    <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kategori..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Judul / Subjek *</Label>
                    <Input
                      placeholder="Ringkasan singkat masalah Anda"
                      value={form.subject}
                      onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                      maxLength={120}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Deskripsi Masalah *</Label>
                    <Textarea
                      placeholder="Jelaskan masalah Anda secara detail. Sertakan nomor pesanan jika relevan..."
                      value={form.message}
                      onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                      rows={5}
                      className="resize-none"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => createMutation.mutate(form)}
                    disabled={
                      !form.subject.trim() || !form.category || !form.message.trim()
                      || createMutation.isPending
                    }
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {createMutation.isPending ? 'Mengirim...' : 'Kirim Tiket'}
                  </Button>
                </CardContent>
              </Card>

              {/* Tips */}
              <div className="mt-4 p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Tips untuk respons lebih cepat:</p>
                <p>• Cantumkan nomor pesanan jika masalah terkait pesanan</p>
                <p>• Sertakan screenshot jika ada error</p>
                <p>• Jelaskan langkah-langkah yang sudah Anda coba</p>
              </div>
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
