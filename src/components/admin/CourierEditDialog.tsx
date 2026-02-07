import { useState, useEffect } from 'react';
import { Save, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  fetchProvinces, fetchRegencies, fetchDistricts, fetchVillages as fetchSubdistrictsList,
  type Region,
} from '@/lib/addressApi';

interface CourierEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courier: any;
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

function findCodeByName(items: Region[], name: string | null): string {
  if (!name) return '';
  const normalized = name.trim().toUpperCase();
  return items.find(i => i.name.trim().toUpperCase() === normalized)?.code || '';
}

export function CourierEditDialog({ open, onOpenChange, courier, onSuccess }: CourierEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [villages, setVillages] = useState<{ id: string; name: string; subdistrict: string | null }[]>([]);

  // Owner state
  const [currentOwner, setCurrentOwner] = useState<OwnerInfo | null>(null);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Address lists
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [regencies, setRegencies] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [subdistricts, setSubdistricts] = useState<Region[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    user_id: '',
    phone: '',
    email: '',
    province_code: '',
    province_name: '',
    regency_code: '',
    regency_name: '',
    district_code: '',
    district_name: '',
    village_code: '',
    village_name: '',
    address: '',
    ktp_number: '',
    vehicle_type: 'motor',
    vehicle_plate: '',
    status: 'ACTIVE',
    village_id: '',
  });

  useEffect(() => {
    if (!open || !courier) return;

    setFormData({
      name: courier.name || '',
      user_id: courier.user_id || '',
      phone: courier.phone || '',
      email: courier.email || '',
      province_code: '',
      province_name: courier.province || '',
      regency_code: '',
      regency_name: courier.city || '',
      district_code: '',
      district_name: courier.district || '',
      village_code: '',
      village_name: courier.subdistrict || '',
      address: courier.address || '',
      ktp_number: courier.ktp_number || '',
      vehicle_type: courier.vehicle_type || 'motor',
      vehicle_plate: courier.vehicle_plate || '',
      status: courier.status || 'ACTIVE',
      village_id: courier.village_id || '',
    });

    fetchVillagesData();
    resolveAddressCodes(courier.province, courier.city, courier.district, courier.subdistrict);
    loadOwnerAndUsers(courier.user_id);
  }, [open, courier]);

  const fetchVillagesData = async () => {
    const { data } = await supabase.from('villages').select('id, name, subdistrict').order('name');
    if (data) setVillages(data);
  };

  // --- Owner logic ---
  const loadOwnerAndUsers = async (currentUserId?: string | null) => {
    setLoadingUsers(true);
    try {
      if (currentUserId) {
        const { data: profile } = await supabase
          .from('profiles').select('user_id, full_name, phone')
          .eq('user_id', currentUserId).maybeSingle();
        setCurrentOwner(profile || { user_id: currentUserId, full_name: null, phone: null });
      } else {
        setCurrentOwner(null);
      }

      // Get courier-role users
      const { data: courierRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'courier');
      if (!courierRoles || courierRoles.length === 0) { setAvailableUsers([]); setLoadingUsers(false); return; }

      const courierUserIds = courierRoles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', courierUserIds);

      const { data: linkedCouriers } = await supabase.from('couriers').select('user_id').not('user_id', 'is', null).neq('id', courier?.id || '');
      const linkedUserIds = new Set(linkedCouriers?.map(c => c.user_id) || []);

      const available = (profiles || []).filter(p => !linkedUserIds.has(p.user_id) && p.user_id !== currentUserId);
      setAvailableUsers(available);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // --- Address resolution ---
  const resolveAddressCodes = async (prov: string | null, city: string | null, dist: string | null, sub: string | null) => {
    if (!prov) {
      const provList = await fetchProvinces();
      setProvinces(provList);
      return;
    }
    setLoadingAddr(true);
    try {
      const provList = await fetchProvinces();
      setProvinces(provList);
      const provCode = findCodeByName(provList, prov);
      if (!provCode) { setLoadingAddr(false); return; }

      const regList = await fetchRegencies(provCode);
      setRegencies(regList);
      const regCode = findCodeByName(regList, city);

      let distCode = '', villCode = '';
      if (regCode) {
        const distList = await fetchDistricts(regCode);
        setDistricts(distList);
        distCode = findCodeByName(distList, dist);
        if (distCode) {
          const villList = await fetchSubdistrictsList(distCode);
          setSubdistricts(villList);
          villCode = findCodeByName(villList, sub);
        }
      }

      setFormData(prev => ({
        ...prev,
        province_code: provCode,
        regency_code: regCode,
        district_code: distCode,
        village_code: villCode,
      }));
    } catch (error) {
      console.error('Error resolving address:', error);
    } finally {
      setLoadingAddr(false);
    }
  };

  // --- Address handlers ---
  const handleProvinceChange = async (code: string) => {
    const selected = provinces.find(p => p.code === code);
    if (!selected) return;
    setRegencies([]); setDistricts([]); setSubdistricts([]);
    setFormData(prev => ({
      ...prev,
      province_code: code, province_name: selected.name,
      regency_code: '', regency_name: '', district_code: '', district_name: '',
      village_code: '', village_name: '',
    }));
    const regList = await fetchRegencies(code);
    setRegencies(regList);
  };

  const handleRegencyChange = async (code: string) => {
    const selected = regencies.find(r => r.code === code);
    if (!selected) return;
    setDistricts([]); setSubdistricts([]);
    setFormData(prev => ({
      ...prev,
      regency_code: code, regency_name: selected.name,
      district_code: '', district_name: '', village_code: '', village_name: '',
    }));
    const distList = await fetchDistricts(code);
    setDistricts(distList);
  };

  const handleDistrictChange = async (code: string) => {
    const selected = districts.find(d => d.code === code);
    if (!selected) return;
    setSubdistricts([]);
    setFormData(prev => ({
      ...prev,
      district_code: code, district_name: selected.name,
      village_code: '', village_name: '',
    }));
    const villList = await fetchSubdistrictsList(code);
    setSubdistricts(villList);
  };

  const handleSubdistrictChange = (code: string) => {
    const selected = subdistricts.find(s => s.code === code);
    if (!selected) return;
    setFormData(prev => ({ ...prev, village_code: code, village_name: selected.name }));

    // Auto-match village_id from kelurahan name
    autoMatchVillageId(selected.name);
  };

  // Auto-match village_id based on kelurahan/desa name
  const autoMatchVillageId = (subdistrictName: string) => {
    const match = villages.find(v =>
      v.subdistrict?.trim().toUpperCase() === subdistrictName.trim().toUpperCase() ||
      v.name.trim().toUpperCase() === subdistrictName.trim().toUpperCase()
    );
    if (match) {
      setFormData(prev => ({ ...prev, village_id: match.id }));
      toast.info(`Wilayah desa otomatis terisi: ${match.name}`);
    }
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Nama dan telepon wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const userId = formData.user_id === 'none_value' || !formData.user_id ? null : formData.user_id;
      const { error } = await supabase
        .from('couriers')
        .update({
          name: formData.name,
          user_id: userId,
          phone: formData.phone,
          email: formData.email || null,
          province: formData.province_name,
          city: formData.regency_name,
          district: formData.district_name,
          subdistrict: formData.village_name,
          address: formData.address,
          ktp_number: formData.ktp_number,
          vehicle_type: formData.vehicle_type,
          vehicle_plate: formData.vehicle_plate || null,
          status: formData.status,
          village_id: formData.village_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', courier.id);

      if (error) throw error;

      toast.success('Data kurir berhasil diperbarui');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating courier:', error);
      toast.error('Gagal memperbarui data kurir');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Data Kurir</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Nama Lengkap *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nama sesuai KTP" />
            </div>
            <div className="space-y-2">
              <Label>No. Telepon *</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="08xxxx" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@contoh.com" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>No. KTP</Label>
            <Input value={formData.ktp_number} onChange={(e) => setFormData({ ...formData, ktp_number: e.target.value })} maxLength={16} placeholder="16 digit nomor KTP" />
          </div>

          {/* Owner (User Kurir) */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Pemilik Akun (User Kurir)
            </h3>

            {currentOwner ? (
              <div className="p-3 bg-accent/50 rounded-lg border border-accent">
                <p className="text-sm font-medium flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Terhubung dengan: <span className="text-primary">{currentOwner.full_name || 'Tanpa Nama'}</span>
                  {currentOwner.phone && <span className="text-muted-foreground">({currentOwner.phone})</span>}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic p-3 bg-muted rounded-lg">
                Belum terhubung ke user manapun
              </p>
            )}

            <div className="space-y-2">
              <Label>{currentOwner ? 'Ganti User' : 'Pilih User'}</Label>
              <Select value={formData.user_id || 'none_value'} onValueChange={(v) => setFormData({ ...formData, user_id: v })} disabled={loadingUsers}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? 'Memuat...' : 'Pilih user'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none_value">-- Lepas User --</SelectItem>
                  {currentOwner && (
                    <SelectItem value={currentOwner.user_id}>
                      ✅ {currentOwner.full_name || 'Tanpa Nama'} ({currentOwner.phone || currentOwner.user_id.slice(0, 8)}) — saat ini
                    </SelectItem>
                  )}
                  {availableUsers.map(user => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name || 'Tanpa Nama'} ({user.phone || user.user_id.slice(0, 8)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">User dengan role kurir yang belum terhubung ke kurir lain</p>
            </div>
          </div>

          {/* Address Dropdowns */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Alamat</h4>
            {loadingAddr && <p className="text-xs text-muted-foreground animate-pulse mb-2">Memuat data alamat...</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provinsi</Label>
                <Select value={formData.province_code} onValueChange={handleProvinceChange} disabled={loadingAddr}>
                  <SelectTrigger><SelectValue placeholder={formData.province_name || 'Pilih Provinsi'} /></SelectTrigger>
                  <SelectContent>{provinces.map(p => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kabupaten/Kota</Label>
                <Select value={formData.regency_code} onValueChange={handleRegencyChange} disabled={!formData.province_code || loadingAddr}>
                  <SelectTrigger><SelectValue placeholder={formData.regency_name || 'Pilih Kabupaten/Kota'} /></SelectTrigger>
                  <SelectContent>{regencies.map(r => <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kecamatan</Label>
                <Select value={formData.district_code} onValueChange={handleDistrictChange} disabled={!formData.regency_code || loadingAddr}>
                  <SelectTrigger><SelectValue placeholder={formData.district_name || 'Pilih Kecamatan'} /></SelectTrigger>
                  <SelectContent>{districts.map(d => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kelurahan/Desa</Label>
                <Select value={formData.village_code} onValueChange={handleSubdistrictChange} disabled={!formData.district_code || loadingAddr}>
                  <SelectTrigger><SelectValue placeholder={formData.village_name || 'Pilih Kelurahan'} /></SelectTrigger>
                  <SelectContent>{subdistricts.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Alamat Lengkap</Label>
            <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Nama jalan, nomor rumah, dll" rows={2} />
          </div>

          {/* Vehicle & Status */}
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Jenis Kendaraan</Label>
              <Select value={formData.vehicle_type} onValueChange={(v) => setFormData({ ...formData, vehicle_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="motor">Motor</SelectItem>
                  <SelectItem value="mobil">Mobil</SelectItem>
                  <SelectItem value="sepeda">Sepeda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plat Nomor</Label>
              <Input value={formData.vehicle_plate} onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value.toUpperCase() })} placeholder="B 1234 ABC" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Wilayah Desa</Label>
              <Select value={formData.village_id || 'none'} onValueChange={(v) => setFormData({ ...formData, village_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Desa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa Wilayah</SelectItem>
                  {villages.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Otomatis terisi jika kelurahan cocok dengan desa wisata</p>
            </div>
            <div className="space-y-2">
              <Label>Status Akun</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Aktif</SelectItem>
                  <SelectItem value="INACTIVE">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}