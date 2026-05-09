import { useState } from 'react';
import { Package, Plus, Edit, Trash2, Users, Clock, Star, Eye, EyeOff, DollarSign } from 'lucide-react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface TourismPackage {
  id: string;
  village_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  duration_days: number;
  min_persons: number;
  max_persons: number;
  includes: string[];
  itinerary: any[];
  is_active: boolean;
  guide_id: string | null;
  created_at: string;
}

interface TourismBooking {
  id: string;
  package_id: string | null;
  buyer_id: string;
  visit_date: string;
  persons: number;
  total_price: number;
  status: string;
  notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  created_at: string;
}

interface Guide {
  id: string;
  name: string;
}

const defaultForm = {
  name: '', description: '', image_url: '', price: '', duration_days: '1',
  min_persons: '1', max_persons: '20', includes: '', is_active: true, guide_id: '',
};

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'Dikonfirmasi', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
  COMPLETED: { label: 'Selesai', color: 'bg-blue-100 text-blue-700' },
};

export default function DesaPaketWisataPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TourismPackage | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [activeTab, setActiveTab] = useState('packages');

  const { data: villageId } = useQuery<string | null>({
    queryKey: ['desa-village-id', user?.id],
    queryFn: async () => {
      const { data: uv } = await supabase.from('user_villages').select('village_id').eq('user_id', user!.id).maybeSingle();
      return uv?.village_id ?? null;
    },
    enabled: !!user,
  });

  const { data: packages = [], isLoading } = useQuery<TourismPackage[]>({
    queryKey: ['tourism-packages', villageId],
    queryFn: async () => {
      const { data } = await supabase.from('tourism_packages').select('*').eq('village_id', villageId!).order('created_at', { ascending: false });
      return (data || []) as TourismPackage[];
    },
    enabled: !!villageId,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<TourismBooking[]>({
    queryKey: ['tourism-bookings', villageId],
    queryFn: async () => {
      const { data } = await supabase.from('tourism_bookings').select('*').eq('village_id', villageId!).order('created_at', { ascending: false }).limit(50);
      return (data || []) as TourismBooking[];
    },
    enabled: !!villageId,
  });

  const { data: guides = [] } = useQuery<Guide[]>({
    queryKey: ['tourism-guides-list', villageId],
    queryFn: async () => {
      const { data } = await supabase.from('tourism_guides').select('id, name').eq('village_id', villageId!);
      return (data || []) as Guide[];
    },
    enabled: !!villageId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!villageId) throw new Error('Village ID tidak ditemukan');
      const payload = {
        village_id: villageId,
        name: form.name.trim(),
        description: form.description || null,
        image_url: form.image_url || null,
        price: parseInt(form.price) || 0,
        duration_days: parseInt(form.duration_days) || 1,
        min_persons: parseInt(form.min_persons) || 1,
        max_persons: parseInt(form.max_persons) || 20,
        includes: form.includes ? form.includes.split('\n').map(s => s.trim()).filter(Boolean) : [],
        is_active: form.is_active,
        guide_id: form.guide_id || null,
      };
      if (editing) {
        const { error } = await supabase.from('tourism_packages').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tourism_packages').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-packages', villageId] });
      toast.success(editing ? 'Paket diperbarui' : 'Paket wisata berhasil dibuat');
      setDialogOpen(false);
      setEditing(null);
      setForm(defaultForm);
    },
    onError: (err: any) => toast.error(err.message || 'Gagal menyimpan'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tourism_packages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-packages', villageId] });
      toast.success('Paket dihapus');
    },
    onError: () => toast.error('Gagal menghapus'),
  });

  const updateBookingStatus = async (id: string, status: string) => {
    await supabase.from('tourism_bookings').update({ status }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['tourism-bookings', villageId] });
    toast.success(`Status booking diperbarui: ${BOOKING_STATUS[status]?.label}`);
  };

  const openEdit = (pkg: TourismPackage) => {
    setEditing(pkg);
    setForm({
      name: pkg.name,
      description: pkg.description || '',
      image_url: pkg.image_url || '',
      price: String(pkg.price),
      duration_days: String(pkg.duration_days),
      min_persons: String(pkg.min_persons),
      max_persons: String(pkg.max_persons),
      includes: (pkg.includes || []).join('\n'),
      is_active: pkg.is_active,
      guide_id: pkg.guide_id || '',
    });
    setDialogOpen(true);
  };

  return (
    <DesaLayout
      title="Paket Wisata"
      subtitle="Kelola paket wisata dan booking dari pengunjung"
      actions={
        <Button onClick={() => { setEditing(null); setForm(defaultForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Buat Paket Baru
        </Button>
      }
    >
      <div className="max-w-5xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="packages" className="gap-2">
              <Package className="h-4 w-4" /> Paket Wisata ({packages.length})
            </TabsTrigger>
            <TabsTrigger value="bookings" className="gap-2">
              <Users className="h-4 w-4" /> Booking Masuk
              {bookings.filter(b => b.status === 'PENDING').length > 0 && (
                <Badge variant="destructive" className="ml-1">{bookings.filter(b => b.status === 'PENDING').length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Packages Tab */}
          <TabsContent value="packages">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1,2].map(i => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : packages.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Belum ada paket wisata</p>
                <p className="text-sm mt-1">Buat paket wisata pertama untuk menarik pengunjung!</p>
                <Button className="mt-4" onClick={() => { setEditing(null); setForm(defaultForm); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Buat Paket Pertama
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packages.map(pkg => (
                  <Card key={pkg.id} className={!pkg.is_active ? 'opacity-60' : ''}>
                    {pkg.image_url && (
                      <div className="h-40 overflow-hidden rounded-t-xl">
                        <img src={pkg.image_url} alt={pkg.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{pkg.name}</h3>
                            {!pkg.is_active && <Badge variant="secondary">Nonaktif</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{pkg.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{formatPrice(pkg.price)}/orang</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{pkg.duration_days} hari</span>
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{pkg.min_persons}–{pkg.max_persons} orang</span>
                      </div>
                      {pkg.includes?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {pkg.includes.slice(0, 3).map((inc, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{inc}</Badge>
                          ))}
                          {pkg.includes.length > 3 && <Badge variant="secondary" className="text-xs">+{pkg.includes.length - 3}</Badge>}
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(pkg)} className="flex-1">
                          <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => {
                          if (confirm('Hapus paket ini?')) deleteMutation.mutate(pkg.id);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            {bookingsLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Belum ada booking masuk</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map(booking => {
                  const statusConf = BOOKING_STATUS[booking.status] || BOOKING_STATUS.PENDING;
                  const pkg = packages.find(p => p.id === booking.package_id);
                  return (
                    <Card key={booking.id}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`${statusConf.color} border-0 text-xs`}>{statusConf.label}</Badge>
                            <span className="text-xs text-muted-foreground">#{booking.id.slice(0, 8).toUpperCase()}</span>
                          </div>
                          <p className="font-medium text-sm">{pkg?.name || 'Paket Wisata'}</p>
                          <div className="text-xs text-muted-foreground mt-0.5 space-x-3">
                            <span>{booking.contact_name || 'Pengunjung'} · {booking.contact_phone}</span>
                            <span>{booking.persons} orang</span>
                            <span>{booking.visit_date ? format(new Date(booking.visit_date), 'dd MMM yyyy', { locale: idLocale }) : '-'}</span>
                          </div>
                          {booking.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{booking.notes}"</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-sm">{formatPrice(booking.total_price)}</p>
                          {booking.status === 'PENDING' && (
                            <div className="flex gap-1 mt-2">
                              <Button size="sm" className="h-7 text-xs px-3" onClick={() => updateBookingStatus(booking.id, 'CONFIRMED')}>
                                Konfirmasi
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs px-3 text-destructive border-red-200" onClick={() => updateBookingStatus(booking.id, 'CANCELLED')}>
                                Tolak
                              </Button>
                            </div>
                          )}
                          {booking.status === 'CONFIRMED' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-3 mt-2" onClick={() => updateBookingStatus(booking.id, 'COMPLETED')}>
                              Tandai Selesai
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Paket Wisata' : 'Buat Paket Wisata Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nama Paket *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Paket Alam Desa 2 Hari 1 Malam" />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Ceritakan pengalaman yang akan didapat pengunjung..." />
            </div>
            <div className="space-y-2">
              <Label>URL Foto Paket</Label>
              <Input value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Harga per Orang (Rp)</Label>
                <Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="150000" />
              </div>
              <div className="space-y-2">
                <Label>Durasi (hari)</Label>
                <Input type="number" min={1} value={form.duration_days} onChange={e => setForm(p => ({ ...p, duration_days: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Min. Peserta</Label>
                <Input type="number" min={1} value={form.min_persons} onChange={e => setForm(p => ({ ...p, min_persons: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Maks. Peserta</Label>
                <Input type="number" min={1} value={form.max_persons} onChange={e => setForm(p => ({ ...p, max_persons: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fasilitas Termasuk (satu per baris)</Label>
              <Textarea value={form.includes} onChange={e => setForm(p => ({ ...p, includes: e.target.value }))} rows={4} placeholder="Makan 3x sehari&#10;Penginapan&#10;Pemandu wisata&#10;Transportasi antar jemput" />
            </div>
            {guides.length > 0 && (
              <div className="space-y-2">
                <Label>Pemandu Wisata</Label>
                <Select value={form.guide_id} onValueChange={v => setForm(p => ({ ...p, guide_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih pemandu (opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tanpa pemandu</SelectItem>
                    {guides.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
              <Label>Paket Aktif (tampil di halaman wisata)</Label>
            </div>
            <Separator />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name}>
                {saveMutation.isPending ? 'Menyimpan...' : editing ? 'Perbarui' : 'Buat Paket'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DesaLayout>
  );
}
