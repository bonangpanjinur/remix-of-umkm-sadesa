import { useState, useEffect, useCallback } from 'react';
import { Clock, Save, CreditCard, QrCode, UserCheck, Shield, Check, X } from 'lucide-react';
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
import { AdminLocationPicker } from './AdminLocationPicker';
import {
  fetchProvinces,
  fetchRegencies,
  fetchDistricts,
  fetchVillages as fetchVillagesList,
  Region,
} from '@/lib/addressApi';

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
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_account_name?: string | null;
    qris_image_url?: string | null;
    payment_cod_enabled?: boolean | null;
    payment_transfer_enabled?: boolean | null;
    verifikator_code?: string | null;
    classification_price?: string | null;
  };
  onSuccess: () => void;
}

interface OwnerInfo {
  user_id: string;
  full_name: string | null;
  phone: string | null;
}

interface AvailableUser {
  user_id: string;
  full_name: string | null;
  phone: string | null;
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

const PRICE_CLASSIFICATIONS = [
  { value: 'none', label: 'Belum ditentukan' },
  { value: 'UNDER_5K', label: 'Sangat Murah (< Rp 5.000)' },
  { value: 'FROM_5K_TO_10K', label: 'Murah (Rp 5.000 - Rp 10.000)' },
  { value: 'FROM_10K_TO_20K', label: 'Sedang (Rp 10.000 - Rp 20.000)' },
  { value: 'ABOVE_20K', label: 'Premium (> Rp 20.000)' },
];

// Helper: find code by matching name (case-insensitive, trimmed)
function findCodeByName(items: Region[], name: string | null): string {
  if (!name) return '';
  const normalized = name.trim().toUpperCase();
  const match = items.find(
    (item) => item.name.trim().toUpperCase() === normalized
  );
  return match?.code || '';
}

export function MerchantEditDialog({
  open,
  onOpenChange,
  merchantId,
  initialData,
  onSuccess,
}: MerchantEditDialogProps) {
  const [loading, setLoading] = useState(false);

  // Owner state
  const [currentOwner, setCurrentOwner] = useState<OwnerInfo | null>(null);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Address state
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [regencies, setRegencies] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [villages, setVillages] = useState<Region[]>([]);
  const [loadingAddr, setLoadingAddr] = useState(false);

  // Verifikator validation state
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [tradeGroupName, setTradeGroupName] = useState<string | null>(null);
  const [isCodeValid, setIsCodeValid] = useState<boolean | null>(null);

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
    bank_name: '',
    bank_account_number: '',
    bank_account_name: '',
    qris_image_url: null as string | null,
    payment_cod_enabled: true,
    payment_transfer_enabled: true,
    verifikator_code: '',
    classification_price: 'none',
  });

  // Initialize form + load address codes + load users when dialog opens
  useEffect(() => {
    if (!open || !initialData) return;

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
      bank_name: initialData.bank_name || '',
      bank_account_number: initialData.bank_account_number || '',
      bank_account_name: initialData.bank_account_name || '',
      qris_image_url: initialData.qris_image_url || null,
      payment_cod_enabled: initialData.payment_cod_enabled ?? true,
      payment_transfer_enabled: initialData.payment_transfer_enabled ?? true,
      verifikator_code: initialData.verifikator_code || '',
      classification_price: initialData.classification_price || 'none',
    });

    if (initialData.verifikator_code) {
      validateVerifikatorCode(initialData.verifikator_code);
    } else {
      setTradeGroupName(null);
      setIsCodeValid(null);
    }

    loadOwnerAndUsers(initialData.user_id);
    resolveAddressCodes(initialData.province, initialData.city, initialData.district, initialData.subdistrict);
  }, [open, initialData]);

  // --- Owner / User logic ---
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

  const loadOwnerAndUsers = async (currentUserId?: string | null) => {
    setLoadingUsers(true);
    try {
      // 1. Load current owner profile
      if (currentUserId) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .eq('user_id', currentUserId)
          .maybeSingle();
        setCurrentOwner(ownerProfile || { user_id: currentUserId, full_name: null, phone: null });
      } else {
        setCurrentOwner(null);
      }

      // 2. Get all merchant-role user_ids
      const { data: merchantRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'merchant');

      if (!merchantRoles || merchantRoles.length === 0) {
        setAvailableUsers([]);
        return;
      }

      const merchantUserIds = merchantRoles.map((r) => r.user_id);

      // 3. Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('user_id', merchantUserIds);

      // 4. Get already-linked user_ids (excluding this merchant)
      const { data: linkedMerchants } = await supabase
        .from('merchants')
        .select('user_id')
        .not('user_id', 'is', null)
        .neq('id', merchantId);

      const linkedUserIds = new Set(linkedMerchants?.map((m) => m.user_id) || []);

      // 5. Filter: only users NOT linked to other merchants, also exclude current owner
      const available = (profiles || []).filter(
        (p) => !linkedUserIds.has(p.user_id) && p.user_id !== currentUserId
      );
      setAvailableUsers(available);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // --- Address name-to-code resolution ---
  const resolveAddressCodes = async (
    provinceName: string | null,
    cityName: string | null,
    districtName: string | null,
    villageName: string | null
  ) => {
    if (!provinceName) return;

    setLoadingAddr(true);
    try {
      // Load provinces and resolve
      const provList = await fetchProvinces();
      setProvinces(provList);
      const provCode = findCodeByName(provList, provinceName);

      if (!provCode) {
        setLoadingAddr(false);
        return;
      }

      // Load regencies and resolve
      const regList = await fetchRegencies(provCode);
      setRegencies(regList);
      const regCode = findCodeByName(regList, cityName);

      let distCode = '';
      let villCode = '';

      if (regCode) {
        const distList = await fetchDistricts(regCode);
        setDistricts(distList);
        distCode = findCodeByName(distList, districtName);

        if (distCode) {
          const villList = await fetchVillagesList(distCode);
          setVillages(villList);
          villCode = findCodeByName(villList, villageName);
        }
      }

      // Set resolved codes
      setFormData((prev) => ({
        ...prev,
        province_code: provCode,
        regency_code: regCode,
        district_code: distCode,
        village_code: villCode,
      }));
    } catch (error) {
      console.error('Error resolving address codes:', error);
    } finally {
      setLoadingAddr(false);
    }
  };

  // --- Address dropdown handlers ---
  const handleProvinceChange = async (code: string) => {
    const selected = provinces.find((p) => p.code === code);
    if (!selected) return;
    setRegencies([]);
    setDistricts([]);
    setVillages([]);
    setFormData((prev) => ({
      ...prev,
      province_code: code,
      province_name: selected.name,
      regency_code: '',
      regency_name: '',
      district_code: '',
      district_name: '',
      village_code: '',
      village_name: '',
    }));
    const regList = await fetchRegencies(code);
    setRegencies(regList);
  };

  const handleRegencyChange = async (code: string) => {
    const selected = regencies.find((r) => r.code === code);
    if (!selected) return;
    setDistricts([]);
    setVillages([]);
    setFormData((prev) => ({
      ...prev,
      regency_code: code,
      regency_name: selected.name,
      district_code: '',
      district_name: '',
      village_code: '',
      village_name: '',
    }));
    const distList = await fetchDistricts(code);
    setDistricts(distList);
  };

  const handleDistrictChange = async (code: string) => {
    const selected = districts.find((d) => d.code === code);
    if (!selected) return;
    setVillages([]);
    setFormData((prev) => ({
      ...prev,
      district_code: code,
      district_name: selected.name,
      village_code: '',
      village_name: '',
    }));
    const villList = await fetchVillagesList(code);
    setVillages(villList);
  };

  const handleVillageChange = (code: string) => {
    const selected = villages.find((v) => v.code === code);
    if (!selected) return;
    setFormData((prev) => ({
      ...prev,
      village_code: code,
      village_name: selected.name,
    }));
  };

  // --- Submit ---
  const handleSubmit = async () => {
        if (!formData.name) {
      toast.error('Nama merchant harus diisi');
      return;
    }

    if (formData.verifikator_code && isCodeValid === false) {
      toast.error('Kode verifikator tidak valid. Silakan cek kembali atau kosongkan.');
      return;
    }

    setLoading(true);
    try {
      const userId = formData.user_id === 'none_value' || !formData.user_id ? null : formData.user_id;
      const { error } = await supabase
        .from('merchants')
        .update({
          name: formData.name,
          user_id: userId,
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
          bank_name: formData.bank_name || null,
          bank_account_number: formData.bank_account_number || null,
          bank_account_name: formData.bank_account_name || null,
          qris_image_url: formData.qris_image_url || null,
          payment_cod_enabled: formData.payment_cod_enabled,
          payment_transfer_enabled: formData.payment_transfer_enabled,
          verifikator_code: formData.verifikator_code || null,
          trade_group: tradeGroupName || null,
          classification_price: formData.classification_price === 'none' ? null : formData.classification_price,
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
                <Label>Nomor Telepon</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori Bisnis</Label>
                <Select
                  value={formData.business_category}
                  onValueChange={(v) => setFormData({ ...formData, business_category: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUSINESS_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Klasifikasi Harga</Label>
                <Select
                  value={formData.classification_price}
                  onValueChange={(v) => setFormData({ ...formData, classification_price: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRICE_CLASSIFICATIONS.map((cls) => (
                      <SelectItem key={cls.value} value={cls.value}>{cls.label}</SelectItem>
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

          {/* Owner (User Merchant) */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Pemilik (User Merchant)
            </h3>

            {/* Show current owner */}
            {currentOwner ? (
              <div className="p-3 bg-accent/50 rounded-lg border border-accent">
                <p className="text-sm font-medium flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Terhubung dengan: <span className="text-primary">{currentOwner.full_name || 'Tanpa Nama'}</span>
                  {currentOwner.phone && (
                    <span className="text-muted-foreground">({currentOwner.phone})</span>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic p-3 bg-muted rounded-lg">
                Belum terhubung ke user manapun
              </p>
            )}

            {/* Dropdown: change/assign owner */}
            <div className="space-y-2">
              <Label>{currentOwner ? 'Ganti Pemilik' : 'Pilih Pemilik'}</Label>
              <Select
                value={formData.user_id || 'none_value'}
                onValueChange={(v) => setFormData({ ...formData, user_id: v })}
                disabled={loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? 'Memuat user...' : 'Pilih pemilik'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none_value">-- Lepas Pemilik --</SelectItem>
                  {currentOwner && (
                    <SelectItem value={currentOwner.user_id}>
                      ✅ {currentOwner.full_name || 'Tanpa Nama'} ({currentOwner.phone || currentOwner.user_id.slice(0, 8)}) — saat ini
                    </SelectItem>
                  )}
                  {availableUsers.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name || 'Tanpa Nama'} ({user.phone || user.user_id.slice(0, 8)})
                    </SelectItem>
                  ))}
                  {availableUsers.length === 0 && !currentOwner && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Tidak ada user merchant tersedia
                    </div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Hanya menampilkan user dengan role merchant yang belum terhubung ke merchant lain
              </p>
            </div>
          </div>

          {/* Verifikator Code */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Verifikator
            </h3>
            <div className="space-y-2">
              <Label>Kode Verifikator / Kelompok Dagang</Label>
              <div className="flex gap-2">
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
                  className={isCodeValid === false ? "border-destructive" : isCodeValid === true ? "border-success" : ""}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => validateVerifikatorCode(formData.verifikator_code)}
                  disabled={isValidatingCode || !formData.verifikator_code}
                >
                  {isValidatingCode ? "Mengecek..." : "Cek Kode"}
                </Button>
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

          {/* Location */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Lokasi & Alamat</h3>

            {loadingAddr && (
              <p className="text-xs text-muted-foreground animate-pulse">Memuat data alamat...</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provinsi</Label>
                <Select
                  value={formData.province_code}
                  onValueChange={handleProvinceChange}
                  disabled={loadingAddr}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.province_name || 'Pilih Provinsi'} />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((p) => (
                      <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kabupaten/Kota</Label>
                <Select
                  value={formData.regency_code}
                  onValueChange={handleRegencyChange}
                  disabled={!formData.province_code || loadingAddr}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.regency_name || 'Pilih Kabupaten/Kota'} />
                  </SelectTrigger>
                  <SelectContent>
                    {regencies.map((r) => (
                      <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kecamatan</Label>
                <Select
                  value={formData.district_code}
                  onValueChange={handleDistrictChange}
                  disabled={!formData.regency_code || loadingAddr}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.district_name || 'Pilih Kecamatan'} />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((d) => (
                      <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kelurahan/Desa</Label>
                <Select
                  value={formData.village_code}
                  onValueChange={handleVillageChange}
                  disabled={!formData.district_code || loadingAddr}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.village_name || 'Pilih Kelurahan/Desa'} />
                  </SelectTrigger>
                  <SelectContent>
                    {villages.map((v) => (
                      <SelectItem key={v.code} value={v.code}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BADGES.map((b) => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
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

          {/* Payment Settings */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Pengaturan Pembayaran
            </h3>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.payment_cod_enabled}
                  onCheckedChange={(v) => setFormData({ ...formData, payment_cod_enabled: v })}
                />
                <Label>COD Aktif</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.payment_transfer_enabled}
                  onCheckedChange={(v) => setFormData({ ...formData, payment_transfer_enabled: v })}
                />
                <Label>Transfer Aktif</Label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nama Bank</Label>
                <Input
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="BRI, BCA, dll"
                />
              </div>
              <div className="space-y-2">
                <Label>No. Rekening</Label>
                <Input
                  value={formData.bank_account_number}
                  onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                  placeholder="Nomor rekening"
                />
              </div>
              <div className="space-y-2">
                <Label>Atas Nama</Label>
                <Input
                  value={formData.bank_account_name}
                  onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                  placeholder="Nama pemilik"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <QrCode className="h-3.5 w-3.5" />
                QRIS
              </Label>
              <ImageUpload
                bucket="merchant-images"
                path={`qris/${merchantId}`}
                value={formData.qris_image_url}
                onChange={(url) => setFormData({ ...formData, qris_image_url: url })}
                placeholder="Upload gambar QRIS merchant"
              />
            </div>

            {!formData.bank_name && !formData.bank_account_number && (
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                💡 Jika kosong, akan menggunakan rekening & QRIS admin sebagai default
              </p>
            )}
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