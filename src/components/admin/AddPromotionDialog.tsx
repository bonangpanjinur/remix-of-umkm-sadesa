import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddPromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const PROMO_TYPES = [
  { value: 'banner', label: 'Banner' },
  { value: 'produk_populer', label: 'Produk Populer' },
  { value: 'wisata_populer', label: 'Wisata Populer' },
  { value: 'promo_spesial', label: 'Promo Spesial' },
];

export function AddPromotionDialog({ open, onOpenChange, onSuccess }: AddPromotionDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    type: 'banner',
    image_url: '',
    link_url: '',
    link_type: '',
    is_active: true,
    is_approved: true,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    price: '',
  });

  const resetForm = () => {
    setForm({
      title: '',
      subtitle: '',
      type: 'banner',
      image_url: '',
      link_url: '',
      link_type: '',
      is_active: true,
      is_approved: true,
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      price: '',
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('Judul promosi wajib diisi');
      return;
    }
    if (!form.type) {
      toast.error('Tipe promosi wajib dipilih');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('promotions').insert({
        title: form.title,
        subtitle: form.subtitle || null,
        type: form.type,
        image_url: form.image_url || null,
        link_url: form.link_url || null,
        link_type: form.link_type || null,
        is_active: form.is_active,
        is_approved: form.is_approved,
        start_date: form.start_date || new Date().toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        price: form.price ? parseFloat(form.price) : null,
      });

      if (error) throw error;

      toast.success('Promosi berhasil ditambahkan');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding promotion:', error);
      toast.error('Gagal menambahkan promosi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Promosi Baru</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left column: image */}
          <div className="space-y-3">
            <div>
              <Label>Gambar Promosi</Label>
              <ImageUpload
                value={form.image_url || null}
                onChange={(url) => setForm(prev => ({ ...prev, image_url: url || '' }))}
                bucket="promotions"
                path="promos"
                aspectRatio="video"
                placeholder="Upload gambar promosi"
              />
            </div>
            <div>
              <Label>Harga Iklan (Rp)</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm(prev => ({ ...prev, price: e.target.value }))}
                placeholder="Opsional"
              />
            </div>
          </div>

          {/* Right column: form fields */}
          <div className="space-y-3">
            <div>
              <Label>Judul *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Judul promosi"
              />
            </div>

            <div>
              <Label>Subtitle</Label>
              <Input
                value={form.subtitle}
                onChange={(e) => setForm(prev => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Deskripsi singkat"
              />
            </div>

            <div>
              <Label>Tipe Promosi *</Label>
              <Select value={form.type} onValueChange={(v) => setForm(prev => ({ ...prev, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROMO_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Link URL</Label>
              <Input
                value={form.link_url}
                onChange={(e) => setForm(prev => ({ ...prev, link_url: e.target.value }))}
                placeholder="/products atau URL"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Mulai</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Berakhir</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm(prev => ({ ...prev, is_active: v }))}
                />
                <Label className="cursor-pointer text-sm">Aktif</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_approved}
                  onCheckedChange={(v) => setForm(prev => ({ ...prev, is_approved: v }))}
                />
                <Label className="cursor-pointer text-sm">Disetujui</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan Promosi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
