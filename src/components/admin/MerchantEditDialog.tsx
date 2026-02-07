import { useState, useEffect } from 'react';
import { Clock, Save } from 'lucide-react';
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
import { ImageUpload } from '@/components/ui/ImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AddressDropdowns } from './AddressDropdowns';
import { AdminLocationPicker } from './AdminLocationPicker';
import { getAvailableMerchantUsers, type MerchantUser } from '@/lib/adminApi';

interface MerchantEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId: string;
  initialData: {
    name: string;
    user_id?: string | null;
    phone: string | null;
    address: string | null;
    province: string | null;
    city: string | null;
    district: string | null;
    subdistrict: string | null;
    open_time: string | null;
    close_time: string | null;
    business_category: string | null;
    business_description: string | null;
    is_open: boolean;
    status: string;
    badge: string | null;
    order_mode: string;
    is_verified: boolean | null;
    image_url: string | null;
    cover_image_url?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
  };
  onSuccess: () => void;
}

const BUSINESS_CATEGORIES = [
  { value: 'kuliner', label: 'Kuliner' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'kriya', label: 'Kriya & Kerajinan' },
  { value: 'jasa', label: 'Jasa' },
  { value: 'pertanian', label: 'Pertanian' },
  { value: 'lainnya', label: 'Lainnya' },
];

const BADGES = [
  { value: 'none', label: 'Tanpa Badge' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'POPULAR', label: 'Popular' },
  { value: 'NEW', label: 'New' },
];

export function MerchantEditDialog({
  open,
  onOpenChange,
  merchantId,
  initialData,
  onSuccess,
}: MerchantEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<MerchantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    user_id: '',
    phone: '',
    address: '',
    province_code: '',
    province_name: '',
    regency_code: '',
    regency_name: '',
    district_code: '',
    district_name: '',
    village_code: '',
    village_name: '',
    open_time: '08:00',
    close_time: '17:00',
    business_category: 'kuliner',
    business_description: '',
    is_open: true,
    status: 'ACTIVE',
    badge: 'none',
    order_mode: 'ADMIN_ASSISTED',
    is_verified: false,
    image_url: null as string | null,
    cover_image_url: null as string | null,
    location_lat: null as number | null,
    location_lng: null as number | null,
  });

  useEffect(() => {
    if (open && initialData) {
      setFormData({
        name: initialData.name || '',
        user_id: initialData.user_id || '',
        phone: initialData.phone || '',
        address: initialData.address || '',
        province_code: '',
        province_name: initialData.province || '',
        regency_code: '',
        regency_name: initialData.city || '',
        district_code: '',
        district_name: initialData.district || '',
        village_code: '',
        village_name: initialData.subdistrict || '',
        open_time: initialData.open_time || '08:00',
        close_time: initialData.close_time || '17:00',
        business_category: initialData.business_category || 'kuliner',
        business_description: initialData.business_description || '',
        is_open: initialData.is_open ?? true,
        status: initialData.status || 'ACTIVE',
        badge: initialData.badge || 'none',
        order_mode: initialData.order_mode || 'ADMIN_ASSISTED',
        is_verified: initialData.is_verified ?? false,
        image_url: initialData.image_url || null,
        cover_image_url: initialData.cover_image_url || null,
        location_lat: initialData.location_lat ?? null,
        location_lng: initialData.location_lng ?? null,
      });
      loadAvailableUsers(initialData.user_id);
    }
  }, [open, initialData]);

  const loadAvailableUsers = async (currentUserId?: string | null) => {
    setLoadingUsers(true);
    try {
      const users = await getAvailableMerchantUsers(currentUserId);
      setAvailableUsers(users);
    } catch (error) {
      console.error('Error loading available users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddressChange = (data: {
    provinceCode: string;
    provinceName: string;
    regencyCode: string;
    regencyName: string;
    districtCode: string;
    districtName: string;
    villageCode: string;
    villageName: string;
  }) => {
    setFormData(prev => ({
      ...prev,
      province_code: data.provinceCode,
      province_name: data.provinceName,
      regency_code: data.regencyCode,
      regency_name: data.regencyName,
      district_code: data.districtCode,
      district_name: data.districtName,
      village_code: data.villageCode,
      village_name: data.villageName,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Nama merchant wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('merchants')
        .update({
          name: formData.name,
          user_id: (formData.user_id === 'none_value' || !formData.user_id) ? null : formData.user_id,
          phone: formData.phone || null,
          address: formData.address || null,
          province: formData.province_name || null,
          city: formData.regency_name || null,
          district: formData.district_name || null,
          subdistrict: formData.village_name || null,
          open_time: formData.open_time,
          close_time: formData.close_time,
          business_category: formData.business_category,
          business_description: formData.business_description || null,
          is_open: formData.is_open,
          status: formData.status,
          badge: formData.badge === 'none' ? null : formData.badge,
          order_mode: formData.order_mode,
          is_verified: formData.is_verified,
          image_url: formData.image_url || null,
          cover_image_url: formData.cover_image_url || null,
          location_lat: formData.location_lat,
          location_lng: formData.location_lng,
          updated_at: new Date().toISOString(),
        })
        .eq('id', merchantId);

      if (error) throw error;

      toast.success('Data merchant berhasil diperbarui');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating merchant:', error);
      toast.error('Gagal memperbarui merchant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Data Merchant</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Photo Uploads */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Foto Merchant</h3>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Foto Sampul</Label>
                <ImageUpload
                  bucket="merchant-images"
                  path={`covers/${merchantId}`}
                  value={formData.cover_image_url}
                  onChange={(url) => setFormData({ ...formData, cover_image_url: url })}
                  aspectRatio="wide"
                  placeholder="Upload foto sampul merchant"
                />
              </div>
              <div className="space-y-2">
                <Label>Foto Profil</Label>
                <ImageUpload
                  bucket="merchant-images"
                  path={`profiles/${merchantId}`}
                  value={formData.image_url}
                  onChange={(url) => setFormData({ ...formData, image_url: url })}
                  aspectRatio="square"
                  placeholder="Upload foto profil merchant"
                />
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Informasi Dasar</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nama Merchant *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nama toko/usaha"
                />
              </div>
              <div className="space-y-2">
                <Label>Pemilik (User Merchant)</Label>
                <Select
                  value={formData.user_id || 'none_value'}
                  onValueChange={(v) => setFormData({ ...formData, user_id: v })}
                  disabled={loadingUsers}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingUsers ? "Memuat user..." : "Pilih pemilik"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none_value">-- Belum Ada Pemilik --</SelectItem>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || 'Tanpa Nama'} ({user.phone || user.user_id.slice(0, 8)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nomor Telepon</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label>Kategori Bisnis</Label>
                <Select
                  value={formData.business_category}
                  onValueChange={(v) => setFormData({ ...formData, business_category: v })}
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
            </div>

            <div className="space-y-2">
              <Label>Deskripsi Bisnis</Label>
              <Textarea
                value={formData.business_description}
                onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
                placeholder="Deskripsi singkat tentang usaha"
                rows={2}
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Lokasi & Alamat</h3>
            
            <AddressDropdowns
              provinceCode={formData.province_code}
              regencyCode={formData.regency_code}
              districtCode={formData.district_code}
              villageCode={formData.village_code}
              provinceName={formData.province_name}
              regencyName={formData.regency_name}
              districtName={formData.district_name}
              villageName={formData.village_name}
              onChange={handleAddressChange}
            />

            <div className="space-y-2">
              <Label>Alamat Lengkap</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Nama jalan, nomor rumah, dll"
                rows={2}
              />
            </div>

            <AdminLocationPicker
              value={formData.location_lat && formData.location_lng ? { lat: formData.location_lat, lng: formData.location_lng } : null}
              onChange={(loc) => setFormData({ ...formData, location_lat: loc.lat, location_lng: loc.lng })}
            />
          </div>

          {/* Operational */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Operasional & Sistem</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Jam Buka
                </Label>
                <Input
                  type="time"
                  value={formData.open_time}
                  onChange={(e) => setFormData({ ...formData, open_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Jam Tutup
                </Label>
                <Input
                  type="time"
                  value={formData.close_time}
                  onChange={(e) => setFormData({ ...formData, close_time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
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
              <div className="space-y-2">
                <Label>Mode Pesanan</Label>
                <Select
                  value={formData.order_mode}
                  onValueChange={(v) => setFormData({ ...formData, order_mode: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN_ASSISTED">Dibantu Admin</SelectItem>
                    <SelectItem value="SELF">Mandiri</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Badge</Label>
                <Select
                  value={formData.badge}
                  onValueChange={(v) => setFormData({ ...formData, badge: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BADGES.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_open}
                  onCheckedChange={(v) => setFormData({ ...formData, is_open: v })}
                />
                <Label>Toko Buka</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_verified}
                  onCheckedChange={(v) => setFormData({ ...formData, is_verified: v })}
                />
                <Label>Terverifikasi</Label>
              </div>
            </div>
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
