import { useState, useEffect } from 'react';
import { Image, Plus, Trash2, Edit, MoreHorizontal, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ImageUpload } from '@/components/ui/ImageUpload';

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  is_approved: boolean;
  start_date: string;
  end_date: string | null;
  sort_order: number | null;
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    link_url: '',
    is_active: true,
    end_date: '',
  });

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('id, title, subtitle, image_url, link_url, is_active, is_approved, start_date, end_date, sort_order')
        .eq('type', 'banner')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
      toast.error('Gagal memuat banner');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleOpenDialog = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title,
        subtitle: banner.subtitle || '',
        image_url: banner.image_url || '',
        link_url: banner.link_url || '',
        is_active: banner.is_active,
        end_date: banner.end_date ? banner.end_date.split('T')[0] : '',
      });
    } else {
      setEditingBanner(null);
      setFormData({
        title: '',
        subtitle: '',
        image_url: '',
        link_url: '',
        is_active: true,
        end_date: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Judul harus diisi');
      return;
    }

    try {
      const payload = {
        title: formData.title,
        subtitle: formData.subtitle || null,
        image_url: formData.image_url || null,
        link_url: formData.link_url || null,
        is_active: formData.is_active,
        is_approved: true,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        type: 'banner',
        sort_order: editingBanner?.sort_order || banners.length,
      };

      if (editingBanner) {
        const { error } = await supabase
          .from('promotions')
          .update(payload)
          .eq('id', editingBanner.id);
        if (error) throw error;
        toast.success('Banner berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('promotions')
          .insert(payload);
        if (error) throw error;
        toast.success('Banner berhasil ditambahkan');
      }

      setDialogOpen(false);
      fetchBanners();
    } catch (error) {
      console.error('Error saving banner:', error);
      toast.error('Gagal menyimpan banner');
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await supabase.from('promotions').update({ is_active: !current }).eq('id', id);
      toast.success(current ? 'Banner dinonaktifkan' : 'Banner diaktifkan');
      fetchBanners();
    } catch {
      toast.error('Gagal mengubah status');
    }
  };

  const deleteBanner = async (id: string) => {
    if (!confirm('Yakin ingin menghapus banner ini?')) return;
    try {
      await supabase.from('promotions').delete().eq('id', id);
      toast.success('Banner dihapus');
      fetchBanners();
    } catch {
      toast.error('Gagal menghapus banner');
    }
  };

  const moveOrder = async (id: string, direction: 'up' | 'down') => {
    const index = banners.findIndex(b => b.id === id);
    if (index < 0) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= banners.length) return;

    const newBanners = [...banners];
    [newBanners[index], newBanners[newIndex]] = [newBanners[newIndex], newBanners[index]];

    try {
      await Promise.all(
        newBanners.map((b, i) =>
          supabase.from('promotions').update({ sort_order: i }).eq('id', b.id)
        )
      );
      setBanners(newBanners);
    } catch {
      toast.error('Gagal mengubah urutan');
    }
  };

  return (
    <AdminLayout title="Manajemen Banner" subtitle="Kelola banner homepage">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Image className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground">{banners.length} banner</span>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Banner
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Image className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>Belum ada banner</p>
          <Button className="mt-4" onClick={() => handleOpenDialog()}>
            Tambah Banner Pertama
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className="bg-card border border-border rounded-xl overflow-hidden flex"
            >
              <div className="w-48 h-28 bg-muted shrink-0">
                {banner.image_url ? (
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{banner.title}</h3>
                  {banner.subtitle && (
                    <p className="text-sm text-muted-foreground">{banner.subtitle}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={banner.is_active ? 'default' : 'secondary'}>
                      {banner.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                    {banner.end_date && (
                      <span className="text-xs text-muted-foreground">
                        Berakhir: {format(new Date(banner.end_date), 'dd/MM/yyyy')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => moveOrder(banner.id, 'up')} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => moveOrder(banner.id, 'down')} disabled={index === banners.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(banner)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(banner.id, banner.is_active)}>
                        {banner.is_active ? (
                          <><EyeOff className="h-4 w-4 mr-2" />Nonaktifkan</>
                        ) : (
                          <><Eye className="h-4 w-4 mr-2" />Aktifkan</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteBanner(banner.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Improved Dialog - compact layout */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBanner ? 'Edit Banner' : 'Tambah Banner Baru'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Image upload */}
            <div className="space-y-2">
              <Label>Gambar Banner</Label>
              <ImageUpload
                value={formData.image_url || null}
                onChange={(url) => setFormData({ ...formData, image_url: url || '' })}
                bucket="promotions"
                path="banners"
                aspectRatio="video"
                placeholder="Upload gambar banner (16:9)"
              />
            </div>

            {/* Right: Form fields */}
            <div className="space-y-3">
              <div>
                <Label>Judul *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Judul banner"
                />
              </div>

              <div>
                <Label>Subtitle</Label>
                <Input
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Deskripsi singkat"
                />
              </div>

              <div>
                <Label>Link URL</Label>
                <Input
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder="/products atau URL"
                />
              </div>

              <div>
                <Label>Tanggal Berakhir</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label className="cursor-pointer">Aktif</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
