import { useState, useEffect } from 'react';
import { Plus, UserCheck } from 'lucide-react';
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
  DialogTrigger,
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

interface AddCourierDialogProps {
  onSuccess: () => void;
}

export function AddCourierDialog({ onSuccess }: AddCourierDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [villagesList, setVillagesList] = useState<{ id: string; name: string; subdistrict: string | null }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ user_id: string; full_name: string | null; phone: string | null }[]>([]);

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
    village_id: '',
  });

  useEffect(() => {
    if (open) {
      fetchVillagesData();
      loadAvailableUsers();
      loadProvinces();
    }
  }, [open]);

  const fetchVillagesData = async () => {
    const { data } = await supabase.from('villages').select('id, name, subdistrict').order('name');
    if (data) setVillagesList(data);
  };

  const loadProvinces = async () => {
    const data = await fetchProvinces();
    setProvinces(data);
  };

  const loadAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data: courierRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'courier');
      if (!courierRoles || courierRoles.length === 0) { setAvailableUsers([]); setLoadingUsers(false); return; }

      const courierUserIds = courierRoles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', courierUserIds);

      const { data: linkedCouriers } = await supabase.from('couriers').select('user_id').not('user_id', 'is', null);
      const linkedUserIds = new Set(linkedCouriers?.map(c => c.user_id) || []);

      setAvailableUsers((profiles || []).filter(p => !linkedUserIds.has(p.user_id)));
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
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

    // Auto-match village_id
    const match = villagesList.find(v =>
      v.subdistrict?.trim().toUpperCase() === selected.name.trim().toUpperCase() ||
      v.name.trim().toUpperCase() === selected.name.trim().toUpperCase()
    );
    if (match) {
      setFormData(prev => ({ ...prev, village_id: match.id }));
      toast.info(`Wilayah desa otomatis terisi: ${match.name}`);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.ktp_number) {
      toast.error('Nama, telepon, dan No. KTP wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const userId = formData.user_id === 'none_value' || !formData.user_id ? null : formData.user_id;
      const { error } = await supabase.from('couriers').insert({
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
        ktp_image_url: 'https://placeholder.co/400x300?text=KTP',
        photo_url: 'https://placeholder.co/200x200?text=Foto',
        vehicle_type: formData.vehicle_type,
        vehicle_plate: formData.vehicle_plate || null,
        vehicle_image_url: 'https://placeholder.co/400x300?text=Kendaraan',
        registration_status: 'APPROVED',
        status: 'ACTIVE',
        approved_at: new Date().toISOString(),
        village_id: formData.village_id || null,
      });

      if (error) throw error;

      toast.success('Kurir berhasil ditambahkan dan otomatis aktif');
      setOpen(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error adding courier:', error);
      toast.error('Gagal menambahkan kurir');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', user_id: '', phone: '', email: '',
      province_code: '', province_name: '', regency_code: '', regency_name: '',
      district_code: '', district_name: '', village_code: '', village_name: '',
      address: '', ktp_number: '', vehicle_type: 'motor', vehicle_plate: '', village_id: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Kurir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Kurir Baru</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Nama Lengkap *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nama kurir sesuai KTP" />
            </div>
            <div className="space-y-2">
              <Label>No. Telepon *</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@contoh.com" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>No. KTP *</Label>
            <Input value={formData.ktp_number} onChange={(e) => setFormData({ ...formData, ktp_number: e.target.value })} placeholder="16 digit nomor KTP" maxLength={16} />
          </div>

          {/* User Assignment */}
          <div className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Hubungkan ke User (Opsional)
            </h4>
            <Select value={formData.user_id || 'none_value'} onValueChange={(v) => setFormData({ ...formData, user_id: v })} disabled={loadingUsers}>
              <SelectTrigger><SelectValue placeholder={loadingUsers ? 'Memuat...' : 'Pilih user'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none_value">-- Tanpa User --</SelectItem>
                {availableUsers.map(user => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.full_name || 'Tanpa Nama'} ({user.phone || user.user_id.slice(0, 8)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">User dengan role kurir yang belum terhubung ke kurir lain</p>
          </div>

          {/* Address Dropdowns */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Alamat</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provinsi</Label>
                <Select value={formData.province_code || undefined} onValueChange={handleProvinceChange}>
                  <SelectTrigger><SelectValue placeholder="Pilih Provinsi" /></SelectTrigger>
                  <SelectContent>{provinces.map(p => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kabupaten/Kota</Label>
                <Select value={formData.regency_code || undefined} onValueChange={handleRegencyChange} disabled={!formData.province_code}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kabupaten/Kota" /></SelectTrigger>
                  <SelectContent>{regencies.map(r => <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kecamatan</Label>
                <Select value={formData.district_code || undefined} onValueChange={handleDistrictChange} disabled={!formData.regency_code}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kecamatan" /></SelectTrigger>
                  <SelectContent>{districts.map(d => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kelurahan/Desa</Label>
                <Select value={formData.village_code || undefined} onValueChange={handleSubdistrictChange} disabled={!formData.district_code}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kelurahan" /></SelectTrigger>
                  <SelectContent>{subdistricts.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Alamat Lengkap</Label>
            <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Jl. Contoh No. 123" rows={2} />
          </div>

          {/* Vehicle & Village */}
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

          <div className="space-y-2">
            <Label>Wilayah Desa</Label>
            <Select value={formData.village_id || 'none'} onValueChange={(v) => setFormData({ ...formData, village_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Pilih Desa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa Wilayah</SelectItem>
                {villagesList.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Otomatis terisi jika kelurahan cocok dengan desa wisata</p>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Menyimpan...' : 'Tambah Kurir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}