import { useState } from 'react';
import {
  TicketCheck, MessageSquare, Clock, CheckCircle2, XCircle,
  AlertCircle, Search, Filter, RefreshCw, Send, ChevronDown, ChevronUp,
  User, Calendar, Tag
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Konfigurasi status tiket / Ticket status config
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open:        { label: 'Baru',          color: 'bg-amber-100 text-amber-700 border-amber-300',   icon: Clock },
  in_progress: { label: 'Diproses',      color: 'bg-blue-100 text-blue-700 border-blue-300',      icon: RefreshCw },
  waiting:     { label: 'Menunggu User', color: 'bg-purple-100 text-purple-700 border-purple-300', icon: AlertCircle },
  resolved:    { label: 'Selesai',       color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: CheckCircle2 },
  closed:      { label: 'Ditutup',       color: 'bg-gray-100 text-gray-600 border-gray-300',      icon: XCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  order:      'Pesanan',
  payment:    'Pembayaran',
  account:    'Akun',
  technical:  'Teknis',
  other:      'Lainnya',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Rendah',  color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Sedang',  color: 'bg-amber-100 text-amber-700' },
  high:   { label: 'Tinggi',  color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Mendesak',color: 'bg-red-100 text-red-700' },
};

interface SupportMessage {
  id: string;
  sender_role: 'user' | 'admin';
  message: string;
  created_at: string;
  sender_name?: string;
}

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  messages?: SupportMessage[];
  last_message_at?: string;
  message_count?: number;
}

export default function AdminSupportTicketsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab]           = useState('open');
  const [searchQuery, setSearchQuery]       = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText]           = useState('');
  const [nextStatus, setNextStatus]         = useState('in_progress');
  const [expandedId, setExpandedId]         = useState<string | null>(null);

  // Ambil semua tiket / Fetch all tickets
  const { data: tickets = [], isLoading, refetch } = useQuery<SupportTicket[]>({
    queryKey: ['admin-support-tickets', statusTab, categoryFilter, priorityFilter],
    queryFn: async () => {
      let query = supabase
        .from('support_tickets')
        .select('id, user_id, subject, category, priority, status, created_at, updated_at, last_message_at, message_count')
        .order('updated_at', { ascending: false });

      if (statusTab !== 'all') query = query.eq('status', statusTab);
      if (categoryFilter !== 'all') query = query.eq('category', categoryFilter);
      if (priorityFilter !== 'all') query = query.eq('priority', priorityFilter);

      const { data, error } = await query;
      if (error) throw error;

      // Enrich dengan data user / Enrich with user data
      const userIds = [...new Set((data || []).map((t: any) => t.user_id))];
      let profileMap: Record<string, { name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        profileMap = Object.fromEntries(
          (profiles || []).map((p: any) => [p.user_id, { name: p.full_name || 'Pengguna', email: p.email || '' }])
        );
      }

      return (data || []).map((t: any) => ({
        ...t,
        user_name: profileMap[t.user_id]?.name || 'Pengguna',
        user_email: profileMap[t.user_id]?.email || '',
      }));
    },
    staleTime: 30_000,
  });

  // Ambil pesan untuk tiket yang dipilih / Fetch messages for selected ticket
  const { data: messages = [] } = useQuery<SupportMessage[]>({
    queryKey: ['admin-ticket-messages', selectedTicket?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select('id, sender_role, message, created_at, sender_id')
        .eq('ticket_id', selectedTicket!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const senderIds = [...new Set((data || []).map((m: any) => m.sender_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', senderIds);
        nameMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name || 'Pengguna']));
      }

      return (data || []).map((m: any) => ({
        ...m,
        sender_name: nameMap[m.sender_id] || (m.sender_role === 'admin' ? 'Tim Support' : 'Pengguna'),
      }));
    },
    enabled: !!selectedTicket,
    staleTime: 10_000,
  });

  // Kirim balasan / Send reply
  const replyMutation = useMutation({
    mutationFn: async ({ text, newStatus }: { text: string; newStatus: string }) => {
      if (!selectedTicket) throw new Error('No ticket selected');

      const now = new Date().toISOString();

      // Insert pesan / Insert message
      const { error: msgErr } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user!.id,
          sender_role: 'admin',
          message: text,
          created_at: now,
        });
      if (msgErr) throw msgErr;

      // Update status & last_message_at
      const { error: ticketErr } = await supabase
        .from('support_tickets')
        .update({
          status: newStatus,
          updated_at: now,
          last_message_at: now,
        })
        .eq('id', selectedTicket.id);
      if (ticketErr) throw ticketErr;
    },
    onSuccess: () => {
      toast.success('Balasan terkirim');
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-messages', selectedTicket?.id] });
      if (selectedTicket) {
        setSelectedTicket(prev => prev ? { ...prev, status: nextStatus } : null);
      }
    },
    onError: () => toast.error('Gagal mengirim balasan'),
  });

  // Update status saja / Update status only
  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, newStatus }: { ticketId: string; newStatus: string }) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: (_, { newStatus }) => {
      toast.success(`Status tiket diubah ke "${STATUS_CONFIG[newStatus]?.label || newStatus}"`);
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      if (selectedTicket) setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
    },
    onError: () => toast.error('Gagal mengubah status'),
  });

  const filteredTickets = tickets.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.subject.toLowerCase().includes(q)
      || t.user_name?.toLowerCase().includes(q)
      || t.id.toLowerCase().includes(q);
  });

  // Hitung badge per status / Count badges per status
  const statusCounts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const openCount = (statusCounts['open'] || 0) + (statusCounts['in_progress'] || 0);

  return (
    <AdminLayout title="Tiket Support" subtitle="Kelola permintaan bantuan pengguna">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Perlu Dibalas', value: openCount, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Menunggu User', value: statusCounts['waiting'] || 0, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Selesai Hari Ini', value: statusCounts['resolved'] || 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total', value: tickets.length, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(stat => (
          <Card key={stat.label} className={`${stat.bg} border-0`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Panel kiri — daftar tiket / Left panel — ticket list */}
        <div className="lg:w-[45%] space-y-3">
          {/* Filter & Search */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari tiket, pengguna, ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Prioritas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Prioritas</SelectItem>
                    {Object.entries(PRIORITY_CONFIG).map(([v, c]) => (
                      <SelectItem key={v} value={v}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8" onClick={() => refetch()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tab Status */}
          <Tabs value={statusTab} onValueChange={setStatusTab}>
            <TabsList className="w-full h-8 text-xs">
              {[
                { value: 'open',        label: `Baru (${statusCounts['open'] || 0})` },
                { value: 'in_progress', label: `Diproses (${statusCounts['in_progress'] || 0})` },
                { value: 'waiting',     label: `Tunggu (${statusCounts['waiting'] || 0})` },
                { value: 'resolved',    label: 'Selesai' },
                { value: 'all',         label: 'Semua' },
              ].map(t => (
                <TabsTrigger key={t.value} value={t.value} className="text-xs flex-1 px-1">{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Daftar Tiket / Ticket List */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <TicketCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Tidak ada tiket ditemukan</p>
              </div>
            ) : (
              filteredTickets.map(ticket => {
                const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['open'];
                const pr = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG['medium'];
                const isSelected = selectedTicket?.id === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    onClick={() => { setSelectedTicket(ticket); setNextStatus(ticket.status); }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium truncate flex-1">{ticket.subject}</p>
                      <Badge className={`text-[10px] px-1.5 py-0.5 border ${st.color} shrink-0`}>
                        {st.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />{ticket.user_name}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Tag className="h-3 w-3" />{CATEGORY_LABELS[ticket.category] || ticket.category}
                      </span>
                      <Badge className={`text-[10px] px-1.5 py-0.5 ${pr.color} border-0 ml-auto`}>
                        {pr.label}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true, locale: idLocale })}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panel kanan — detail & balasan / Right panel — detail & reply */}
        <div className="lg:flex-1">
          {selectedTicket ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{selectedTicket.subject}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      #{selectedTicket.id.slice(0, 8).toUpperCase()} · {selectedTicket.user_name} · {selectedTicket.user_email}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Select
                      value={selectedTicket.status}
                      onValueChange={v => updateStatusMutation.mutate({ ticketId: selectedTicket.id, newStatus: v })}
                    >
                      <SelectTrigger className="h-7 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                          <SelectItem key={v} value={v}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mt-2">
                  <Badge className={`text-[10px] border ${STATUS_CONFIG[selectedTicket.status]?.color || ''}`}>
                    {STATUS_CONFIG[selectedTicket.status]?.label}
                  </Badge>
                  <Badge className={`text-[10px] border-0 ${PRIORITY_CONFIG[selectedTicket.priority]?.color || ''}`}>
                    Prioritas: {PRIORITY_CONFIG[selectedTicket.priority]?.label}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 ml-auto">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(selectedTicket.created_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                  </span>
                </div>
              </CardHeader>
              <Separator />

              {/* Thread Percakapan / Conversation Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[40vh]">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Belum ada pesan
                  </div>
                ) : (
                  messages.map(msg => {
                    const isAdmin = msg.sender_role === 'admin';
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          isAdmin
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-muted rounded-tl-sm'
                        }`}>
                          <p className={`text-[10px] font-medium mb-1 ${isAdmin ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {msg.sender_name}
                          </p>
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                          <p className={`text-[10px] mt-1 ${isAdmin ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {format(new Date(msg.created_at), 'dd MMM HH:mm', { locale: idLocale })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <Separator />

              {/* Area balas / Reply area */}
              {['open', 'in_progress', 'waiting'].includes(selectedTicket.status) && (
                <div className="p-4 space-y-3">
                  <Textarea
                    placeholder="Tulis balasan untuk pengguna..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Ubah status ke:</span>
                      <Select value={nextStatus} onValueChange={setNextStatus}>
                        <SelectTrigger className="h-7 text-xs w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG)
                            .filter(([v]) => v !== 'open')
                            .map(([v, c]) => (
                              <SelectItem key={v} value={v}>{c.label}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => replyMutation.mutate({ text: replyText, newStatus: nextStatus })}
                      disabled={!replyText.trim() || replyMutation.isPending}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      {replyMutation.isPending ? 'Mengirim...' : 'Kirim Balasan'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground py-20">
              <div>
                <TicketCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Pilih tiket untuk melihat detail dan membalas</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
