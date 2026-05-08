import { useState, useEffect } from 'react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Calendar, MapPin, Edit2, Trash2, Search } from 'lucide-react';
import { format, isAfter, isBefore } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Event {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  organizer: string | null;
  village_id: string;
}

const EVENT_TYPES = [
  { value: 'pasar_malam', label: 'Pasar Malam' },
  { value: 'festival', label: 'Festival' },
  { value: 'pameran', label: 'Pameran' },
  { value: 'lomba', label: 'Lomba' },
  { value: 'bazaar', label: 'Bazaar' },
  { value: 'lainnya', label: 'Lainnya' },
];

function getEventStatus(event: Event) {
  const now = new Date();
  const start = new Date(event.start_date);
  const end = event.end_date ? new Date(event.end_date) : null;
  if (isAfter(start, now)) return { label: 'Akan Datang', color: 'bg-blue-100 text-blue-800' };
  if (!end || isAfter(end, now)) return { label: 'Sedang Berlangsung', color: 'bg-emerald-100 text-emerald-800' };
  return { label: 'Selesai', color: 'bg-gray-100 text-gray-600' };
}

const EMPTY_FORM = { name: '', description: '', event_type: 'festival', location: '', start_date: '', end_date: '', organizer: '' };

export default function DesaEventPage() {
  const { user } = useAuth();
  const [villageId, setVillageId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const fetchVillage = async () => {
      if (!user) return;
      const { data } = await supabase.from('user_villages').select('village_id').eq('user_id', user.id).maybeSingle();
      if (data?.village_id) setVillageId(data.village_id);
    };
    fetchVillage();
  }, [user]);

  useEffect(() => { if (villageId) fetchEvents(); }, [villageId]);

  const fetchEvents = async () => {
    if (!villageId) return;
    setLoading(true);
    const { data } = await supabase
      .from('village_events' as any)
      .select('*')
      .eq('village_id', villageId)
      .order('start_date', { ascending: false });
    setEvents((data || []) as unknown as Event[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (ev: Event) => {
    setEditing(ev);
    setForm({
      name: ev.name,
      description: ev.description || '',
      event_type: ev.event_type,
      location: ev.location || '',
      start_date: ev.start_date.substring(0, 10),
      end_date: ev.end_date ? ev.end_date.substring(0, 10) : '',
      organizer: ev.organizer || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.start_date || !villageId) {
      toast.error('Nama dan tanggal mulai harus diisi');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        village_id: villageId,
        name: form.name.trim(),
        description: form.description || null,
        event_type: form.event_type,
        location: form.location || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        organizer: form.organizer || null,
        status: 'upcoming',
      };

      if (editing) {
        const { error } = await supabase.from('village_events' as any).update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Event berhasil diperbarui');
      } else {
        const { error } = await supabase.from('village_events' as any).insert(payload);
        if (error) throw error;
        toast.success('Event berhasil ditambahkan');
      }
      setDialogOpen(false);
      fetchEvents();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus event ini?')) return;
    const { error } = await supabase.from('village_events' as any).delete().eq('id', id);
    if (error) { toast.error('Gagal menghapus event'); return; }
    toast.success('Event dihapus');
    fetchEvents();
  };

  const filtered = events.filter(ev => {
    const matchSearch = ev.name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterStatus === 'all') return true;
    const status = getEventStatus(ev);
    if (filterStatus === 'upcoming') return status.label === 'Akan Datang';
    if (filterStatus === 'ongoing') return status.label === 'Sedang Berlangsung';
    if (filterStatus === 'done') return status.label === 'Selesai';
    return true;
  });

  const upcoming = events.filter(ev => getEventStatus(ev).label === 'Akan Datang').length;
  const ongoing = events.filter(ev => getEventStatus(ev).label === 'Sedang Berlangsung').length;

  return (
    <DesaLayout title="Manajemen Event Desa" subtitle="Pasar malam, festival, pameran, dan kegiatan desa">
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Event', value: events.length, color: 'text-foreground' },
            { label: 'Akan Datang', value: upcoming, color: 'text-blue-600' },
            { label: 'Berlangsung', value: ongoing, color: 'text-emerald-600' },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari event..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="upcoming">Akan Datang</SelectItem>
              <SelectItem value="ongoing">Berlangsung</SelectItem>
              <SelectItem value="done">Selesai</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />Tambah Event
          </Button>
        </div>

        {/* Event list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Belum ada event desa</p>
              <Button size="sm" className="mt-3" onClick={openCreate}>Tambah Event Pertama</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(ev => {
              const status = getEventStatus(ev);
              const typeLabel = EVENT_TYPES.find(t => t.value === ev.event_type)?.label || ev.event_type;
              return (
                <Card key={ev.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-emerald-50 flex flex-col items-center justify-center shrink-0 text-center">
                        <p className="text-lg font-bold text-emerald-700 leading-none">
                          {format(new Date(ev.start_date), 'dd', { locale: idLocale })}
                        </p>
                        <p className="text-xs text-emerald-600">
                          {format(new Date(ev.start_date), 'MMM', { locale: idLocale })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{ev.name}</h3>
                          <Badge className={`text-xs shrink-0 ${status.color}`}>{status.label}</Badge>
                          <Badge variant="outline" className="text-xs shrink-0">{typeLabel}</Badge>
                        </div>
                        {ev.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ev.description}</p>}
                        <div className="flex flex-wrap gap-3 mt-1.5">
                          {ev.location && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{ev.location}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(ev.start_date), 'dd MMM yyyy', { locale: idLocale })}
                            {ev.end_date && ` – ${format(new Date(ev.end_date), 'dd MMM yyyy', { locale: idLocale })}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ev)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(ev.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Event' : 'Tambah Event'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Event *</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Festival Desa 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipe Event</Label>
                <Select value={form.event_type} onValueChange={v => setForm(p => ({ ...p, event_type: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Penyelenggara</Label>
                <Input className="mt-1" value={form.organizer} onChange={e => setForm(p => ({ ...p, organizer: e.target.value }))} placeholder="BUMDes" />
              </div>
            </div>
            <div>
              <Label>Lokasi</Label>
              <Input className="mt-1" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Lapangan Desa" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tanggal Mulai *</Label>
                <Input type="date" className="mt-1" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>Tanggal Selesai</Label>
                <Input type="date" className="mt-1" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea className="mt-1 resize-none" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Deskripsi event..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DesaLayout>
  );
}
