import { useState, useEffect } from 'react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Send, Bell, Users, Store, CheckCircle, Clock, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  sent_count: number;
  status: string;
  sent_at: string | null;
  created_at: string;
  target_audience: string;
}

export default function DesaBroadcastPage() {
  const { user } = useAuth();
  const [villageId, setVillageId] = useState<string | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [merchantCount, setMerchantCount] = useState(0);
  const [form, setForm] = useState({ title: '', message: '', target: 'merchant' });

  useEffect(() => {
    const fetchVillage = async () => {
      if (!user) return;
      const { data } = await supabase.from('user_villages').select('village_id').eq('user_id', user.id).maybeSingle();
      if (data?.village_id) setVillageId(data.village_id);
    };
    fetchVillage();
  }, [user]);

  useEffect(() => { if (villageId) fetchData(); }, [villageId]);

  const fetchData = async () => {
    if (!villageId) return;
    setLoading(true);
    const [broadcastRes, merchantRes] = await Promise.all([
      supabase.from('broadcast_messages' as any)
        .select('*')
        .eq('village_id', villageId)
        .order('created_at', { ascending: false }),
      supabase.from('merchants')
        .select('id', { count: 'exact', head: true })
        .eq('village_id', villageId)
        .eq('registration_status', 'APPROVED'),
    ]);
    setBroadcasts((broadcastRes.data || []) as unknown as BroadcastItem[]);
    setMerchantCount(merchantRes.count || 0);
    setLoading(false);
  };

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim() || !villageId || !user) {
      toast.error('Judul dan pesan harus diisi');
      return;
    }
    setSending(true);
    try {
      // Get target merchants
      const { data: merchants } = await supabase
        .from('merchants')
        .select('user_id')
        .eq('village_id', villageId)
        .eq('registration_status', 'APPROVED');

      const userIds = (merchants || []).map((m: any) => m.user_id).filter(Boolean);

      // Insert notifications
      if (userIds.length > 0) {
        await supabase.from('notifications').insert(
          userIds.map((uid: string) => ({
            user_id: uid,
            title: form.title,
            message: form.message,
            type: 'broadcast',
            link: '/merchant',
          }))
        );
      }

      // Save broadcast record
      await supabase.from('broadcast_messages' as any).insert({
        village_id: villageId,
        sent_by: user.id,
        title: form.title,
        message: form.message,
        target_audience: form.target,
        sent_count: userIds.length,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      toast.success(`Pengumuman terkirim ke ${userIds.length} merchant`);
      setDialogOpen(false);
      setForm({ title: '', message: '', target: 'merchant' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengirim pengumuman');
    } finally {
      setSending(false);
    }
  };

  return (
    <DesaLayout title="Broadcast Pengumuman" subtitle="Kirim pengumuman ke semua merchant desa">
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Broadcast', value: broadcasts.length, icon: Megaphone },
            { label: 'Merchant Desa', value: merchantCount, icon: Store },
            { label: 'Terkirim Bulan Ini', value: broadcasts.filter(b => {
              const d = new Date(b.created_at);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length, icon: CheckCircle },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="p-4 text-center">
                <s.icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Send className="h-4 w-4" />Kirim Pengumuman
          </Button>
        </div>

        {/* Broadcast history */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : broadcasts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Belum ada broadcast yang dikirim</p>
              <Button size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>Kirim Pengumuman Pertama</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {broadcasts.map(b => (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <Megaphone className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm">{b.title}</h3>
                        <Badge className="text-xs shrink-0 bg-emerald-100 text-emerald-800">
                          <CheckCircle className="h-3 w-3 mr-1" />Terkirim
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{b.message}</p>
                      <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />{b.sent_count} penerima
                        </span>
                        {b.sent_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(b.sent_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kirim Pengumuman ke Merchant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              Akan dikirim ke <strong>{merchantCount}</strong> merchant terverifikasi di desa ini
            </div>
            <div>
              <Label>Judul Pengumuman *</Label>
              <Input className="mt-1" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Pengumuman Penting: ..." />
            </div>
            <div>
              <Label>Isi Pengumuman *</Label>
              <Textarea className="mt-1 resize-none" rows={4} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Tulis isi pengumuman di sini..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSend} disabled={sending} className="gap-1.5">
              <Send className="h-4 w-4" />
              {sending ? 'Mengirim...' : `Kirim ke ${merchantCount} Merchant`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DesaLayout>
  );
}
