import { useState, useEffect } from 'react';
import { Clock, Save, Plus } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MerchantAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Village {
  id: string;
  name: string;
  district: string;
  regency: string;
}

const BUSINESS_CATEGORIES = [
  { value: 'kuliner', label: 'Kuliner' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'kriya', label: 'Kriya & Kerajinan' },
  { value: 'jasa', label: 'Jasa' },
  { value: 'pertanian', label: 'Pertanian' },
  { value: 'lainnya', label: 'Lainnya' },
];

const CLASSIFICATION_PRICES = [
  { value: 'UNDER_5K', label: 'Dibawah Rp 5.000' },
  { value: 'FROM_5K_TO_10K', label: 'Rp 5.000 - Rp 10.000' },
  { value: 'FROM_10K_TO_20K', label: 'Rp 10.000 - Rp 20.000' },
  { value: 'ABOVE_20K', label: 'Diatas Rp 20.000' },
];

export function MerchantAddDialog({
  open,
  onOpenChange,
  onSuccess,
}: MerchantAddDialogProps) {
  const [loading, setLoading] = useState(false);
  const [villages, setVillages] = useState<Village[]>([]);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    open_time: '08:00',
    close_time: '17:00',
    business_category: 'kuliner',
    business_description: '',
    classification_price: 'FROM_5K_TO_10K',
    is_open: true,
    status: 'ACTIVE',
    registration_status: 'APPROVED',
    village_id: '',
  });

  // Fetch villages on dialog open
  useEffect(() => {
    if (open) {
      fetchVillages();
    }
  }, [open]);

  const fetchVillages = async () => {
    setLoadingVillages(true);
    try {
      const { data, error } = await supabase
        .from('villages')
        .select('id, name, district, regency')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setVillages(data || []);
    } catch (error) {
      console.error('Error fetching villages:', error);
      toast.error('Gagal memuat daftar desa');
    } finally {
      setLoadingVillages(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Nama merchant wajib diisi');
      return;
    }

    if (!formData.phone.trim()) {
      toast.error('Nomor telepon wajib diisi');
      return;
    }

    if (!formData.village_id) {
      toast.error('Pilih desa/kelurahan');
      return;
    }

    setLoading(true);
    try {
      // Find selected village to get city/district info
      const selectedVillage = villages.find(v => v.id === formData.village_id);
      
      const { error } = await supabase
        .from('merchants')
        .insert({
          name: formData.name,
          phone: formData.phone || null,
          address: formData.address || null,
          open_time: formData.open_time,
          close_time: formData.close_time,
          business_category: formData.business_category,
          business_description: formData.business_description || null,
          classification_price: formData.classification_price,
          is_open: formData.is_open,
          status: formData.status,
          registration_status: formData.registration_status,
          village_id: formData.village_id,
          city: selectedVillage?.regency || null,
          district: selectedVillage?.district || null,
          registered_at: new Date().toISOString(),
          order_mode: 'ADMIN_ASSISTED',
        });

      if (error) throw error;

      toast.success('Merchant baru berhasil ditambahkan');
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: '',
        phone: '',
        address: '',
        open_time: '08:00',
        close_time: '17:00',
        business_category: 'kuliner',
        business_description: '',
        classification_price: 'FROM_5K_TO_10K',
        is_open: true,
        status: 'ACTIVE',
        registration_status: 'APPROVED',
        village_id: '',
      });
    } catch (error) {
      console.error('Error adding merchant:', error);
      toast.error('Gagal menambahkan merchant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Tambah Merchant Baru
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Nama Merchant *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nama toko/usaha"
              disabled={loading}
            />
          </div>

          <div>
            <Label>Nomor Telepon *</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="08xxxxxxxxxx"
              disabled={loading}
            />
          </div>

          <div>
            <Label>Desa/Kelurahan *</Label>
            <Select
              value={formData.village_id}
              onValueChange={(v) => setFormData({ ...formData, village_id: v })}
              disabled={loading || loadingVillages}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingVillages ? 'Memuat...' : 'Pilih desa/kelurahan'} />
              </SelectTrigger>
              <SelectContent>
                {villages.map((village) => (
                  <SelectItem key={village.id} value={village.id}>
                    {village.name} - {village.district}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Alamat</Label>
            <Textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Alamat lengkap merchant"
              rows={2}
              disabled={loading}
            />
          </div>

          <div>
            <Label>Kategori Bisnis</Label>
            <Select
              value={formData.business_category}
              onValueChange={(v) => setFormData({ ...formData, business_category: v })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Deskripsi Bisnis</Label>
            <Textarea
              value={formData.business_description}
              onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
              placeholder="Deskripsi singkat tentang usaha"
              rows={2}
              disabled={loading}
            />
          </div>

          <div>
            <Label>Klasifikasi Harga</Label>
            <Select
              value={formData.classification_price}
              onValueChange={(v) => setFormData({ ...formData, classification_price: v })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASSIFICATION_PRICES.map((price) => (
                  <SelectItem key={price.value} value={price.value}>
                    {price.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Jam Buka
              </Label>
              <Input
                type="time"
                value={formData.open_time}
                onChange={(e) => setFormData({ ...formData, open_time: e.target.value })}
                disabled={loading}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Jam Tutup
              </Label>
              <Input
                type="time"
                value={formData.close_time}
                onChange={(e) => setFormData({ ...formData, close_time: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label>Status Merchant</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Aktif</SelectItem>
                <SelectItem value="INACTIVE">Nonaktif</SelectItem>
                <SelectItem value="SUSPENDED">Ditangguhkan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Switch
              checked={formData.is_open}
              onCheckedChange={(v) => setFormData({ ...formData, is_open: v })}
              disabled={loading}
            />
            <Label>Toko sedang buka</Label>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
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
