import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VillageEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  villageId: string;
  initialData: {
    name: string;
    district: string;
    regency: string;
    subdistrict: string | null;
    description: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    is_active: boolean;
  };
  onSuccess: () => void;
}

export function VillageEditDialog({
  open,
  onOpenChange,
  villageId,
  initialData,
  onSuccess,
}: VillageEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    district: '',
    regency: '',
    subdistrict: '',
    description: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    is_active: true,
  });

  useEffect(() => {
    if (open && initialData) {
      setFormData({
        name: initialData.name || '',
        district: initialData.district || '',
        regency: initialData.regency || '',
        subdistrict: initialData.subdistrict || '',
        description: initialData.description || '',
        contact_name: initialData.contact_name || '',
        contact_phone: initialData.contact_phone || '',
        contact_email: initialData.contact_email || '',
        is_active: initialData.is_active ?? true,
      });
    }
  }, [open, initialData]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Nama desa wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('villages')
        .update({
          name: formData.name,
          district: formData.district,
          regency: formData.regency,
          subdistrict: formData.subdistrict || null,
          description: formData.description || null,
          contact_name: formData.contact_name || null,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', villageId);

      if (error) throw error;

      toast.success('Data desa berhasil diperbarui');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating village:', error);
      toast.error('Gagal memperbarui data desa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Data Desa Wisata</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Nama Desa *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nama desa wisata"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Kecamatan</Label>
              <Input
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                placeholder="Nama kecamatan"
              />
            </div>
            <div>
              <Label>Kabupaten/Kota</Label>
              <Input
                value={formData.regency}
                onChange={(e) => setFormData({ ...formData, regency: e.target.value })}
                placeholder="Nama kabupaten/kota"
              />
            </div>
          </div>

          <div>
            <Label>Kelurahan/Desa</Label>
            <Input
              value={formData.subdistrict}
              onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
              placeholder="Nama kelurahan/desa"
            />
          </div>

          <div>
            <Label>Deskripsi</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Deskripsi singkat tentang desa wisata"
              rows={3}
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Informasi Kontak</p>
            <div className="space-y-3">
              <div>
                <Label>Nama Kontak</Label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="Nama penanggung jawab"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Telepon</Label>
                  <Input
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
            />
            <Label>Desa aktif</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
