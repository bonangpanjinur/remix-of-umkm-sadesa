import { useState, useEffect } from 'react';
import { Clock, Save, Plus, Check, X, Shield } from 'lucide-react';
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
import {
  fetchProvinces,
  fetchRegencies,
  fetchDistricts,
  fetchVillages,
  Region,
} from '@/lib/addressApi';
import { AdminLocationPicker } from './AdminLocationPicker';
import { getAvailableMerchantUsers, type MerchantUser } from '@/lib/adminApi';

interface MerchantAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface VillageData {
  id: string;
  name: string;
  district: string;
  regency: string;
  subdistrict: string | null;
}

const BUSINESS_CATEGORIES = [
  { value: 'kuliner', label: 'Kuliner' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'kriya', label: 'Kriya & Kerajinan' },
  { value: 'jasa', label: 'Jasa' },
  { value: 'pertanian', label: 'Pertanian' },
  { value: 'lainnya', label: 'Lainnya' },
];

export function MerchantAddDialog({
  open,
  onOpenChange,
  onSuccess,
}: MerchantAddDialogProps) {
  const [loading, setLoading] = useState(false);
  
  // Address data states
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [regencies, setRegencies] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [apiVillages, setApiVillages] = useState<Region[]>([]);
  const [dbVillages, setDbVillages] = useState<VillageData[]>([]);
  
  // Loading states
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);
  
  const [availableUsers, setAvailableUsers] = useState<MerchantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Verifikator validation state
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [tradeGroupName, setTradeGroupName] = useState<string | null>(null);
  const [isCodeValid, setIsCodeValid] = useState<boolean | null>(null);
  const [debouncedCode, setDebouncedCode] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    user_id: '',
    phone: '',
    province_code: '',
    province_name: '',
    regency_code: '',
    regency_name: '',
    district_code: '',
    district_name: '',
    village_code: '',
    village_name: '',
    address: '',
    open_time: '08:00',
    close_time: '17:00',
    business_category: 'kuliner',
    business_description: '',
    is_open: true,
    status: 'ACTIVE',
    registration_status: 'APPROVED',
    village_id: '', // Linked village ID if exists
    badge: 'none',
    order_mode: 'ADMIN_ASSISTED',
    is_verified: false,
    image_url: '',
    location_lat: null as number | null,
    location_lng: null as number | null,
    verifikator_code: '',
  });

  // Load provinces and available users on dialog open
  useEffect(() => {
    if (open) {
      loadProvinces();
      loadAvailableUsers();
    }
  }, [open]);

  // Debounce effect for verifikator code
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCode(formData.verifikator_code);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.verifikator_code]);

  useEffect(() => {
    if (debouncedCode) {
      validateVerifikatorCode(debouncedCode);
    } else {
      setTradeGroupName(null);
      setIsCodeValid(null);
    }
  }, [debouncedCode]);

  const validateVerifikatorCode = async (code: string) => {
    if (!code) {
      setTradeGroupName(null);
      setIsCodeValid(null);
      return;
    }

    setIsValidatingCode(true);
    try {
      const { data, error } = await supabase
        .from('verifikator_codes')
        .select('trade_group')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTradeGroupName(data.trade_group);
        setIsCodeValid(true);
      } else {
        setTradeGroupName(null);
        setIsCodeValid(false);
      }
    } catch (error) {
      console.error('Error validating code:', error);
      setIsCodeValid(false);
    } finally {
      setIsValidatingCode(false);
    }
  };

  const loadAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      const users = await getAvailableMerchantUsers();
      setAvailableUsers(users);
    } catch (error) {
      console.error('Error loading available users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadProvinces = async () => {
    setLoadingProvinces(true);
    try {
      const data = await fetchProvinces();
      setProvinces(data);
    } catch (error) {
      console.error('Error loading provinces:', error);
      toast.error('Gagal memuat data provinsi');
    } finally {
      setLoadingProvinces(false);
    }
  };

  const handleProvinceChange = async (code: string) => {
    const selected = provinces.find(p => p.code === code);
    if (!selected) return;

    setFormData({
      ...formData,
      province_code: code,
      province_name: selected.name,
      regency_code: '',
      regency_name: '',
      district_code: '',
      district_name: '',
      village_code: '',
      village_name: '',
      village_id: '',
    });

    setRegencies([]);
    setDistricts([]);
    setApiVillages([]);
    setDbVillages([]);

    setLoadingRegencies(true);
    try {
      const data = await fetchRegencies(code);
      setRegencies(data);
    } catch (error) {
      console.error('Error loading regencies:', error);
      toast.error('Gagal memuat data kabupaten/kota');
    } finally {
      setLoadingRegencies(false);
    }
  };

  const handleRegencyChange = async (code: string) => {
    const selected = regencies.find(r => r.code === code);
    if (!selected) return;

    setFormData({
      ...formData,
      regency_code: code,
      regency_name: selected.name,
      district_code: '',
      district_name: '',
      village_code: '',
      village_name: '',
      village_id: '',
    });

    setDistricts([]);
    setApiVillages([]);
    setDbVillages([]);

    setLoadingDistricts(true);
    try {
      const data = await fetchDistricts(code);
      setDistricts(data);
    } catch (error) {
      console.error('Error loading districts:', error);
      toast.error('Gagal memuat data kecamatan');
    } finally {
      setLoadingDistricts(false);
    }
  };

  const handleDistrictChange = async (code: string) => {
    const selected = districts.find(d => d.code === code);
    if (!selected) return;

    setFormData({
      ...formData,
      district_code: code,
      district_name: selected.name,
      village_code: '',
      village_name: '',
      village_id: '',
    });

    setApiVillages([]);
    setDbVillages([]);

    setLoadingVillages(true);
    try {
      // Fetch API villages
      const apiData = await fetchVillages(code);
      setApiVillages(apiData);

      // Fetch DB villages that match this location
      const { data: dbData, error } = await supabase
        .from('villages')
        .select('id, name, district, regency, subdistrict')
        .eq('district', selected.name)
        .eq('regency', formData.regency_name)
        .eq('is_active', true);

      if (error) throw error;
      setDbVillages(dbData || []);
    } catch (error) {
      console.error('Error loading villages:', error);
      toast.error('Gagal memuat data kelurahan');
    } finally {
      setLoadingVillages(false);
    }
  };

  const handleVillageChange = (code: string) => {
    const selected = apiVillages.find(v => v.code === code);
    if (!selected) return;

    // Try to find matching village in database
    const matchingDbVillage = dbVillages.find(
      v => v.name.toLowerCase() === selected.name.toLowerCase()
    );

    setFormData({
      ...formData,
      village_code: code,
      village_name: selected.name,
      village_id: matchingDbVillage?.id || '', // Link to village if exists
    });
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Nama merchant wajib diisi');
      return;
    }

    if (formData.verifikator_code && isCodeValid === false) {
      toast.error('Kode verifikator tidak valid. Silakan cek kembali atau kosongkan.');
      return;
    }

    if (!formData.phone.trim()) {
      toast.error('Nomor telepon wajib diisi');
      return;
    }

    if (!formData.province_code) {
      toast.error('Provinsi wajib dipilih');
      return;
    }

    if (!formData.regency_code) {
      toast.error('Kabupaten/Kota wajib dipilih');
      return;
    }

    if (!formData.district_code) {
      toast.error('Kecamatan wajib dipilih');
      return;
    }

    if (!formData.village_code) {
      toast.error('Kelurahan/Desa wajib dipilih');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('merchants')
        .insert({
          name: formData.name,
          // user_id is automatically handled by Supabase Trigger (on_merchant_signup) if null
          user_id: (formData.user_id === 'none_value' || !formData.user_id) ? null : formData.user_id,
          phone: formData.phone || null,
          address: formData.address || null,
          open_time: formData.open_time,
          close_time: formData.close_time,
          business_category: formData.business_category,
          business_description: formData.business_description || null,
          is_open: formData.is_open,
          status: formData.status,
          registration_status: formData.registration_status,
          village_id: formData.village_id || null,
          province: formData.province_name,
          city: formData.regency_name,
          district: formData.district_name,
          subdistrict: formData.village_name,
          registered_at: new Date().toISOString(),
          order_mode: formData.order_mode,
          badge: formData.badge === 'none' ? null : formData.badge,
          is_verified: formData.is_verified,
          image_url: formData.image_url || null,
          location_lat: formData.location_lat,
          location_lng: formData.location_lng,
          verifikator_code: formData.verifikator_code || null,
          trade_group: tradeGroupName || null,
        });

      if (error) throw error;

      // Assign both buyer and merchant roles to user if linked
      const linkedUserId = (formData.user_id === 'none_value' || !formData.user_id) ? null : formData.user_id;
      if (linkedUserId) {
        // Assign buyer role
        await supabase.from('user_roles').upsert(
          { user_id: linkedUserId, role: 'buyer' },
          { onConflict: 'user_id,role' }
        );
        // Assign merchant role
        await supabase.from('user_roles').upsert(
          { user_id: linkedUserId, role: 'merchant' },
          { onConflict: 'user_id,role' }
        );
      }

      toast.success('Merchant baru berhasil ditambahkan');
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: '',
        user_id: '',
        phone: '',
        province_code: '',
        province_name: '',
        regency_code: '',
        regency_name: '',
        district_code: '',
        district_name: '',
        village_code: '',
        village_name: '',
        address: '',
        open_time: '08:00',
        close_time: '17:00',
        business_category: 'kuliner',
        business_description: '',
        is_open: true,
        status: 'ACTIVE',
        registration_status: 'APPROVED',
        village_id: '',
        badge: 'none',
        order_mode: 'ADMIN_ASSISTED',
        is_verified: false,
        image_url: '',
        location_lat: null,
        location_lng: null,
        verifikator_code: '',
      });
      setTradeGroupName(null);
      setIsCodeValid(null);
    } catch (error) {
      console.error('Error adding merchant:', error);
      toast.error('Gagal menambahkan merchant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Tambah Merchant Baru
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Basic Information */}
          <div className="border-b pb-4">
            <h3 className="font-semibold text-sm mb-3">Informasi Dasar</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>URL Gambar Merchant</Label>
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
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
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Badge Merchant</Label>
                <Select
                  value={formData.badge}
                  onValueChange={(v) => setFormData({ ...formData, badge: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa Badge</SelectItem>
                    <SelectItem value="VERIFIED">Verified</SelectItem>
                    <SelectItem value="POPULAR">Popular</SelectItem>
                    <SelectItem value="NEW">New</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4 pt-8">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_verified}
                    onCheckedChange={(v) => setFormData({ ...formData, is_verified: v })}
                  />
                  <Label>Terverifikasi</Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Merchant *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nama toko/usaha"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user_id">Pemilik (User Merchant)</Label>
                <Select
                  value={formData.user_id}
                  onValueChange={(v) => setFormData({ ...formData, user_id: v })}
                  disabled={loadingUsers}
                >
                  <SelectTrigger id="user_id">
                    <SelectValue placeholder={loadingUsers ? "Memuat user..." : "Pilih pemilik (opsional)"} />
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

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Nomor Telepon *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label>Status Merchant</Label>
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
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="category">Kategori Bisnis</Label>
                <Select
                  value={formData.business_category}
                  onValueChange={(v) => setFormData({ ...formData, business_category: v })}
                >
                  <SelectTrigger id="category">
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

            <div className="space-y-2 mt-4">
              <Label>Deskripsi Bisnis</Label>
              <Textarea
                value={formData.business_description}
                onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
                placeholder="Deskripsi singkat tentang usaha"
                rows={2}
              />
            </div>
          </div>

          {/* Location Information */}
          <div className="border-b pb-4">
            <h3 className="font-semibold text-sm mb-3">Lokasi & Alamat</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provinsi *</Label>
                <Select
                  value={formData.province_code}
                  onValueChange={handleProvinceChange}
                  disabled={loadingProvinces}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingProvinces ? "Memuat..." : "Pilih Provinsi"} />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((p) => (
                      <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kabupaten/Kota *</Label>
                <Select
                  value={formData.regency_code}
                  onValueChange={handleRegencyChange}
                  disabled={!formData.province_code || loadingRegencies}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingRegencies ? "Memuat..." : "Pilih Kabupaten/Kota"} />
                  </SelectTrigger>
                  <SelectContent>
                    {regencies.map((r) => (
                      <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Kecamatan *</Label>
                <Select
                  value={formData.district_code}
                  onValueChange={handleDistrictChange}
                  disabled={!formData.regency_code || loadingDistricts}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingDistricts ? "Memuat..." : "Pilih Kecamatan"} />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((d) => (
                      <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kelurahan/Desa *</Label>
                <Select
                  value={formData.village_code}
                  onValueChange={handleVillageChange}
                  disabled={!formData.district_code || loadingVillages}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingVillages ? "Memuat..." : "Pilih Kelurahan/Desa"} />
                  </SelectTrigger>
                  <SelectContent>
                    {apiVillages.map((v) => (
                      <SelectItem key={v.code} value={v.code}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label>Alamat Lengkap</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Nama jalan, nomor rumah, dll"
                rows={2}
              />
            </div>

            {/* Map Location Picker */}
            <div className="mt-4">
              <AdminLocationPicker
                value={formData.location_lat && formData.location_lng ? { lat: formData.location_lat, lng: formData.location_lng } : null}
                onChange={(loc) => setFormData({ ...formData, location_lat: loc.lat, location_lng: loc.lng })}
              />
            </div>
          </div>

          {/* Verifikator Code */}
          <div className="border-b pb-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Verifikator
            </h3>
            <div className="space-y-2">
              <Label>Kode Verifikator / Kelompok Dagang</Label>
              <div className="relative">
                <Input
                  value={formData.verifikator_code}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, verifikator_code: val });
                    if (!val) {
                      setIsCodeValid(null);
                      setTradeGroupName(null);
                    }
                  }}
                  placeholder="Masukkan kode verifikator"
                  className={isCodeValid === false ? "border-destructive pr-10" : isCodeValid === true ? "border-success pr-10" : "pr-10"}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isValidatingCode ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : isCodeValid === true ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : isCodeValid === false ? (
                    <X className="h-4 w-4 text-destructive" />
                  ) : null}
                </div>
              </div>
              
              {isCodeValid === true && tradeGroupName && (
                <p className="text-xs text-success font-medium flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Terhubung ke: {tradeGroupName}
                </p>
              )}
              
              {isCodeValid === false && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <X className="h-3 w-3" />
                  Kode tidak valid atau tidak aktif
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Pastikan kode valid untuk menghubungkan merchant dengan kelompok dagang yang tepat
              </p>
            </div>
          </div>

          {/* Operational Information */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Operasional</h3>
            
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

            <div className="flex items-center gap-3 mt-4">
              <Switch
                checked={formData.is_open}
                onCheckedChange={(v) => setFormData({ ...formData, is_open: v })}
              />
              <Label>Toko sedang buka</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Menyimpan...' : 'Simpan Merchant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
