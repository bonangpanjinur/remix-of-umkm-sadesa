import { useState, useEffect } from 'react';
import { Mountain, Plus, Edit, MoreHorizontal, ImageIcon, Eye, MapPin } from 'lucide-react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TourismRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  facilities: string[] | null;
  is_active: boolean;
  view_count: number;
  wa_link: string | null;
  sosmed_link: string | null;
  location_lat: number | null;
  location_lng: number | null;
}

interface TourismForm {
  name: string;
  description: string;
  image_url: string | null;
  wa_link: string;
  sosmed_link: string;
  facilities: string;
  is_active: boolean;
}

const defaultForm: TourismForm = {
  name: '',
  description: '',
  image_url: null,
  wa_link: '',
  sosmed_link: '',
  facilities: '',
  is_active: true,
};

export default function DesaTourismPage() {
  const { user } = useAuth();
  const [villageId, setVillageId] = useState<string | null>(null);
  const [tourism, setTourism] = useState<TourismRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTourism, setEditingTourism] = useState<TourismRow | null>(null);
  const [form, setForm] = useState<TourismForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Get village
        const { data: villages } = await supabase
          .from('villages')
          .select('id')
          .eq('registration_status', 'APPROVED')
          .limit(1);

        if (!villages || villages.length === 0) {
          setLoading(false);
          return;
        }

        const villageData = villages[0];
        setVillageId(villageData.id);

        const { data, error } = await supabase
          .from('tourism')
          .select('*')
          .eq('village_id', villageData.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTourism(data || []);
      } catch (error) {
        console.error('Error:', error);
        toast.error('Gagal memuat data wisata');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const openCreateDialog = () => {
    setEditingTourism(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEditDialog = (item: TourismRow) => {
    setEditingTourism(item);
    setForm({
      name: item.name,
      description: item.description || '',
      image_url: item.image_url,
      wa_link: item.wa_link || '',
      sosmed_link: item.sosmed_link || '',
      facilities: item.facilities?.join(', ') || '',
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!villageId || !form.name) {
      toast.error('Nama wisata wajib diisi');
      return;
    }

    setSaving(true);

    try {
      const tourismData = {
        name: form.name,
        description: form.description || null,
        image_url: form.image_url,
        wa_link: form.wa_link || null,
        sosmed_link: form.sosmed_link || null,
        facilities: form.facilities ? form.facilities.split(',').map(f => f.trim()) : [],
        is_active: form.is_active,
        village_id: villageId,
      };

      if (editingTourism) {
        const { error } = await supabase
          .from('tourism')
          .update(tourismData)
          .eq('id', editingTourism.id);

        if (error) throw error;
        toast.success('Wisata berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('tourism')
          .insert(tourismData);

        if (error) throw error;
        toast.success('Wisata berhasil ditambahkan');
      }

      setDialogOpen(false);
      // Refresh
      const { data } = await supabase
        .from('tourism')
        .select('*')
        .eq('village_id', villageId)
        .order('created_at', { ascending: false });
      setTourism(data || []);
    } catch (error) {
      toast.error('Gagal menyimpan wisata');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('tourism')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      setTourism(tourism.map(t => 
        t.id === id ? { ...t, is_active: !currentActive } : t
      ));
      toast.success(currentActive ? 'Wisata dinonaktifkan' : 'Wisata diaktifkan');
    } catch (error) {
      toast.error('Gagal mengubah status');
    }
  };

  const columns = [
    {
      key: 'tourism',
      header: 'Wisata',
      render: (item: TourismRow) => (
        <div className="flex items-center gap-3">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {item.description || '-'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'facilities',
      header: 'Fasilitas',
      render: (item: TourismRow) => (
        <div className="flex flex-wrap gap-1">
          {(item.facilities || []).slice(0, 2).map((f, i) => (
            <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
          ))}
          {(item.facilities || []).length > 2 && (
            <Badge variant="outline" className="text-xs">+{item.facilities!.length - 2}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'view_count',
      header: 'Views',
      render: (item: TourismRow) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span>{item.view_count}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: TourismRow) => (
        item.is_active 
          ? <Badge className="bg-primary/10 text-primary">Aktif</Badge>
          : <Badge variant="outline">Nonaktif</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: TourismRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(item)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleActive(item.id, item.is_active)}>
              {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DesaLayout title="Wisata" subtitle="Kelola destinasi wisata desa">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mountain className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">{tourism.length} wisata</span>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Wisata
        </Button>
      </div>

      <DataTable
        data={tourism}
        columns={columns}
        searchKey="name"
        searchPlaceholder="Cari nama wisata..."
        loading={loading}
        emptyMessage="Belum ada wisata terdaftar"
      />

      {/* Tourism Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTourism ? 'Edit Wisata' : 'Tambah Wisata Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Gambar Wisata</Label>
              <ImageUpload
                bucket="tourism-images"
                path={villageId || 'temp'}
                value={form.image_url}
                onChange={(url) => setForm(prev => ({ ...prev, image_url: url }))}
                aspectRatio="video"
                maxSizeMB={10}
                placeholder="Upload gambar wisata"
              />
            </div>
            <div className="space-y-2">
              <Label>Nama Wisata *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nama destinasi wisata"
              />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Deskripsi wisata"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Link WhatsApp</Label>
              <Input
                value={form.wa_link}
                onChange={(e) => setForm(prev => ({ ...prev, wa_link: e.target.value }))}
                placeholder="https://wa.me/628xxx"
              />
            </div>
            <div className="space-y-2">
              <Label>Link Social Media</Label>
              <Input
                value={form.sosmed_link}
                onChange={(e) => setForm(prev => ({ ...prev, sosmed_link: e.target.value }))}
                placeholder="https://instagram.com/xxx"
              />
            </div>
            <div className="space-y-2">
              <Label>Fasilitas (pisahkan dengan koma)</Label>
              <Input
                value={form.facilities}
                onChange={(e) => setForm(prev => ({ ...prev, facilities: e.target.value }))}
                placeholder="Parkir, Toilet, Musholla"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(c) => setForm(prev => ({ ...prev, is_active: c }))}
              />
              <Label htmlFor="is_active">Aktif</Label>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DesaLayout>
  );
}
