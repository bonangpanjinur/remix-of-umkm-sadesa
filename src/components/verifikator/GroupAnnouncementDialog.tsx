import { useState, useEffect } from 'react';
import { Megaphone, Send, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface GroupAnnouncementDialogProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export function GroupAnnouncementDialog({ groupId, open, onOpenChange }: GroupAnnouncementDialogProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, groupId]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('group_announcements')
        .select('id, title, message, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(10);
      setHistory(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Judul dan pesan wajib diisi');
      return;
    }
    setSending(true);
    try {
      // Save announcement
      const { error: annError } = await supabase.from('group_announcements').insert({
        group_id: groupId,
        verifikator_id: user?.id,
        title: title.trim(),
        message: message.trim(),
      });
      if (annError) throw annError;

      // Get all group members
      const { data: members } = await supabase
        .from('group_members')
        .select('merchant:merchants(user_id)')
        .eq('group_id', groupId)
        .eq('status', 'ACTIVE');

      let sentCount = 0;
      for (const m of members || []) {
        const userId = (m.merchant as any)?.user_id;
        if (userId) {
          await supabase.from('notifications').insert({
            user_id: userId,
            title: `📢 ${title.trim()}`,
            message: message.trim(),
            type: 'info',
          });
          sentCount++;
        }
      }

      toast.success(`Pengumuman terkirim ke ${sentCount} merchant`);
      setTitle('');
      setMessage('');
      fetchHistory();
    } catch (error: any) {
      toast.error('Gagal mengirim: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Pengumuman Kelompok
          </DialogTitle>
          <DialogDescription>Kirim pengumuman ke semua merchant dalam kelompok</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Judul Pengumuman *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Contoh: Rapat Bulanan" />
          </div>
          <div className="space-y-2">
            <Label>Pesan *</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Tulis pengumuman..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Mengirim...' : 'Kirim'}
          </Button>
        </DialogFooter>

        {/* History */}
        {history.length > 0 && (
          <>
            <Separator className="my-2" />
            <div>
              <h4 className="text-sm font-semibold mb-3">Riwayat Pengumuman</h4>
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {history.map(ann => (
                  <div key={ann.id} className="bg-muted rounded-lg p-3">
                    <p className="text-sm font-medium">{ann.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{ann.message}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(ann.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
