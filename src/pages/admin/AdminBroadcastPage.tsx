import { useState, useEffect } from 'react';
import { 
  Bell, 
  Plus, 
  Send, 
  Trash2, 
  Edit, 
  MoreHorizontal, 
  Users,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  target_audience: string;
  target_roles: string[];
  status: string;
  sent_at: string | null;
  sent_count: number;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: 'buyer', label: 'Pembeli' },
  { value: 'merchant', label: 'Merchant' },
  { value: 'courier', label: 'Kurir' },
  { value: 'verifikator', label: 'Verifikator' },
  { value: 'admin_desa', label: 'Admin Desa' },
];

export default function AdminBroadcastPage() {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    target_audience: 'ALL',
    target_roles: [] as string[],
  });

  const fetchBroadcasts = async () => {
    try {
      const { data, error } = await supabase
        .from('broadcast_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBroadcasts(data || []);
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      target_audience: 'ALL',
      target_roles: [],
    });
  };

  const handleSendBroadcast = async () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error('Judul dan pesan harus diisi');
      return;
    }

    setSending(true);
    try {
      // Create broadcast record
      const { data: broadcast, error: createError } = await supabase
        .from('broadcast_notifications')
        .insert({
          title: formData.title,
          message: formData.message,
          target_audience: formData.target_audience,
          target_roles: formData.target_roles,
          status: 'SENDING',
          created_by: user?.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Get target users based on audience
      let userIds: string[] = [];
      
      if (formData.target_audience === 'ALL') {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('is_blocked', false);
        userIds = (profiles || []).map(p => p.user_id);
      } else if (formData.target_audience === 'ROLES' && formData.target_roles.length > 0) {
        // Cast to proper type for query
        type AppRole = 'admin' | 'buyer' | 'verifikator' | 'merchant' | 'courier' | 'admin_desa';
        const rolesFilter = formData.target_roles as AppRole[];
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', rolesFilter);
        userIds = [...new Set((roles || []).map(r => r.user_id))];
      }

      // Create notifications for each user
      if (userIds.length > 0) {
        const notifications = userIds.map(userId => ({
          user_id: userId,
          title: formData.title,
          message: formData.message,
          type: 'broadcast',
          link: null,
        }));

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (notifError) throw notifError;
      }

      // Update broadcast status
      await supabase
        .from('broadcast_notifications')
        .update({
          status: 'SENT',
          sent_at: new Date().toISOString(),
          sent_count: userIds.length,
        })
        .eq('id', broadcast.id);

      toast.success(`Notifikasi berhasil dikirim ke ${userIds.length} pengguna`);
      setDialogOpen(false);
      resetForm();
      fetchBroadcasts();
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast.error('Gagal mengirim notifikasi');
    } finally {
      setSending(false);
    }
  };

  const deleteBroadcast = async (id: string) => {
    if (!confirm('Yakin ingin menghapus?')) return;
    try {
      await supabase.from('broadcast_notifications').delete().eq('id', id);
      toast.success('Broadcast dihapus');
      fetchBroadcasts();
    } catch {
      toast.error('Gagal menghapus');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Terkirim</Badge>;
      case 'SENDING':
        return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />Mengirim</Badge>;
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Gagal</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAudienceLabel = (audience: string, roles: string[]) => {
    if (audience === 'ALL') return 'Semua Pengguna';
    if (audience === 'ROLES') {
      return roles.map(r => ROLE_OPTIONS.find(o => o.value === r)?.label || r).join(', ');
    }
    return audience;
  };

  return (
    <AdminLayout title="Broadcast Notifikasi" subtitle="Kirim notifikasi massal ke pengguna">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground">{broadcasts.length} broadcast</span>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Buat Broadcast
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : broadcasts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Bell className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>Belum ada broadcast</p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            Kirim Broadcast Pertama
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {broadcasts.map(b => (
            <Card key={b.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{b.title}</h3>
                      {getStatusBadge(b.status)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{b.message}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {getAudienceLabel(b.target_audience, b.target_roles || [])}
                      </span>
                      {b.sent_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          {b.sent_count} terkirim
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(b.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                      </span>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => deleteBroadcast(b.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Kirim Broadcast
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Judul *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Judul notifikasi"
              />
            </div>

            <div>
              <Label>Pesan *</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Isi pesan notifikasi..."
                rows={4}
              />
            </div>

            <div>
              <Label>Target Penerima</Label>
              <Select
                value={formData.target_audience}
                onValueChange={(value) => setFormData({ ...formData, target_audience: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Pengguna</SelectItem>
                  <SelectItem value="ROLES">Berdasarkan Role</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.target_audience === 'ROLES' && (
              <div className="space-y-2">
                <Label>Pilih Role</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map(role => (
                    <div key={role.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={role.value}
                        checked={formData.target_roles.includes(role.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({ ...formData, target_roles: [...formData.target_roles, role.value] });
                          } else {
                            setFormData({ ...formData, target_roles: formData.target_roles.filter(r => r !== role.value) });
                          }
                        }}
                      />
                      <label htmlFor={role.value} className="text-sm">{role.label}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSendBroadcast} disabled={sending}>
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Kirim Sekarang
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
