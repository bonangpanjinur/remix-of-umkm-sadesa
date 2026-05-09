import { useState } from 'react';
import { User, Plus, Edit, Trash2, Phone, Star, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';

interface Guide {
  id: string;
  village_id: string;
  name: string;
  phone: string | null;
  specialization: string | null;
  languages: string[];
  photo_url: string | null;
  daily_rate: number;
  bio: string | null;
  is_available: boolean;
  created_at: string;
}

const defaultForm = {
  name: '', phone: '', specialization: '', languages: '', photo_url: '', daily_rate: '', bio: '', is_available: true,
};

export default function DesaPemanduPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Guide | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: villageId } = useQuery<string | null>({
    queryKey: ['desa-village-id', user?.id],
    queryFn: async () => {
      const { data: uv } = await supabase.from('user_villages').select('village_id').eq('user_id', user!.id).maybeSingle();
      return uv?.village_id ?? null;
    },
    enabled: !!user,
  });

  const { data: guides = [], isLoading } = useQuery<Guide[]>({
    queryKey: ['tourism-guides', villageId],
    queryFn: async () => {
      const { data } = await supabase.from('tourism_guides').select('*').eq('village_id', villageId!).order('name');
      return (data || []) as Guide[];
    },
    enabled: !!villageId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!villageId) throw new Error('Village tidak ditemukan');
      const payload = {
        village_id: villageId,
        name: form.name.trim(),
        phone: form.phone || null,
        specialization: form.specialization || null,
        languages: form.languages ? form.languages.split(',').map(s => s.trim()).filter(Boolean) : [],
        photo_url: form.photo_url || null,
        daily_rate: parseInt(form.daily_rate) || 0,
        bio: form.bio || null,
        is_available: form.is_available,
      };
      if (editing) {
        const { error } = await supabase.from('tourism_guides').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tourism_guides').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-guides', villageId] });
      toast.success(editing ? 'Data pemandu diperbarui' : 'Pemandu berhasil ditambahkan');
      setDialogOpen(false);
      setEditing(null);
      setForm(defaultForm);
    },
    onError: (err: any) => toast.error(err.message || 'Gagal menyimpan'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tourism_guides').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-guides', villageId] });
      toast.success('Pemandu dihapus');
    },
    onError: () => toast.error('Gagal menghapus'),
  });

  const toggleAvailability = async (guide: Guide) => {
    await supabase.from('tourism_guides').update({ is_available: !guide.is_available }).eq('id', guide.id);
    queryClient.invalidateQueries({ queryKey: ['tourism-guides', villageId] });
    toast.success(guide.is_available ? 'Pemandu ditandai tidak tersedia' : 'Pemandu tersedia kembali');
  };

  const openEdit = (guide: Guide) => {
    setEditing(guide);
    setForm({
      name: guide.name,
      phone: guide.phone || '',
      specialization: guide.specialization || '',
      languages: (guide.languages || []).join(', '),
      photo_url: guide.photo_url || '',
      daily_rate: String(guide.daily_rate),
      bio: guide.bio || '',
      is_available: guide.is_available,
    });
    setDialogOpen(true);
  };

  return (
    <DesaLayout
      title="Pemandu Wisata"
      subtitle="Daftar pemandu wisata yang siap memandu pengunjung desa"
      actions={
        <Button onClick={() => { setEditing(null); setForm(defaultForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Tambah Pemandu
        </Button>
      }
    >
      <div className="max-w-3xl space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : guides.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Belum ada pemandu wisata</p>
            <p className="text-sm mt-1">Tambahkan pemandu lokal untuk membantu wisatawan</p>
            <Button className="mt-4" onClick={() => { setEditing(null); setForm(defaultForm); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Tambah Pemandu Pertama
            </Button>
          </div>
        ) : (
          guides.map(guide => (
            <Card key={guide.id}>
              <CardContent className="p-4 flex items-start gap-4">
                <Avatar className="h-16 w-16 flex-shrink-0">
                  <AvatarImage src={guide.photo_url || undefined} />
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                    {guide.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{guide.name}</h3>
                        {guide.is_available ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Tersedia</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Tidak Tersedia</Badge>
                        )}
                      </div>
                      {guide.specialization && (
                        <p className="text-sm text-muted-foreground">{guide.specialization}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium">{formatPrice(guide.daily_rate)}<span className="text-xs text-muted-foreground">/hari</span></p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {guide.phone && (
                      <a
                        href={`https://wa.me/${guide.phone?.replace(/\D/g, '').replace(/^0/, '62')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                      >
                        <Phone className="h-3 w-3" /> {guide.phone}
                      </a>
                    )}
                    {(guide.languages || []).map((lang, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{lang}</Badge>
                    ))}
                  </div>
                  {guide.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{guide.bio}</p>}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => toggleAvailability(guide)} className="h-7 text-xs">
                      {guide.is_available ? <XCircle className="h-3 w-3 mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                      {guide.is_available ? 'Set Tidak Tersedia' : 'Set Tersedia'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(guide)} className="h-7 text-xs">
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm('Hapus pemandu ini?')) deleteMutation.mutate(guide.id); }} className="h-7 text-xs text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Data Pemandu' : 'Tambah Pemandu Wisata'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nama Lengkap *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nama pemandu" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>No. HP / WhatsApp</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
              </div>
              <div className="space-y-2">
                <Label>Tarif Harian (Rp)</Label>
                <Input type="number" value={form.daily_rate} onChange={e => setForm(p => ({ ...p, daily_rate: e.target.value }))} placeholder="200000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Spesialisasi</Label>
              <Input value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))} placeholder="Alam, Budaya, Kuliner, dll." />
            </div>
            <div className="space-y-2">
              <Label>Bahasa (pisah koma)</Label>
              <Input value={form.languages} onChange={e => setForm(p => ({ ...p, languages: e.target.value }))} placeholder="Indonesia, Jawa, Inggris" />
            </div>
            <div className="space-y-2">
              <Label>URL Foto</Label>
              <Input value={form.photo_url} onChange={e => setForm(p => ({ ...p, photo_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Bio / Pengalaman</Label>
              <Textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={3} placeholder="Ceritakan pengalaman dan keahlian pemandu..." />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_available} onCheckedChange={v => setForm(p => ({ ...p, is_available: v }))} />
              <Label>Tersedia untuk booking</Label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name}>
                {saveMutation.isPending ? 'Menyimpan...' : editing ? 'Perbarui' : 'Tambah Pemandu'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DesaLayout>
  );
}
