import { useState, useEffect } from 'react';
import { Save, Image as ImageIcon, MapPin, UserCheck } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  fetchProvinces, fetchRegencies, fetchDistricts, fetchVillages,
  type Region 
} from '@/lib/addressApi';
import { reverseGeocode } from '@/hooks/useGeocoding';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { AdminLocationPicker } from './AdminLocationPicker';

interface VillageEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  villageId: string;
  initialData: {
    name: string;
    province?: string;
    regency: string;
    district: string;
    subdistrict: string | null;
    description: string | null;
    image_url?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    is_active: boolean;
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

function findCodeByName(items: Region[], name: string | null): string {
  if (!name) return '';
  const normalized = name.trim().toUpperCase();
  return items.find(i => i.name.trim().toUpperCase() === normalized)?.code || '';
}

export function VillageEditDialog({
  open,
  onOpenChange,
  villageId,
  initialData,
  onSuccess,
}: VillageEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingAddr, setLoadingAddr] = useState(false);
  
  // Owner state
  const [currentOwner, setCurrentOwner] = useState<OwnerInfo | null>(null);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('none_value');

  const [formData, setFormData] = useState({
    name: '',
    province_code: '',
    province_name: '',
    regency_code: '',
    regency_name: '',
    district_code: '',
    district_name: '',
    subdistrict_code: '',
    subdistrict_name: '',
    description: '',
    image_url: '',
    location_lat: null as number | null,
    location_lng: null as number | null,
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    is_active: true,
  });

  // Region lists
  const [provincesList, setProvincesList] = useState<Region[]>([]);
  const [regenciesList, setRegenciesList] = useState<Region[]>([]);
  const [districtsList, setDistrictsList] = useState<Region[]>([]);
  const [subdistrictsList, setSubdistrictsList] = useState<Region[]>([]);

  useEffect(() => {
    if (!open || !initialData) return;

    setFormData({
      name: initialData.name || '',
      province_code: '',
      province_name: initialData.province || '',
      regency_code: '',
      regency_name: initialData.regency || '',
      district_code: '',
      district_name: initialData.district || '',
      subdistrict_code: '',
      subdistrict_name: initialData.subdistrict || '',
      description: initialData.description || '',
      image_url: initialData.image_url || '',
      location_lat: initialData.location_lat ?? null,
      location_lng: initialData.location_lng ?? null,
      contact_name: initialData.contact_name || '',
      contact_phone: initialData.contact_phone || '',
      contact_email: initialData.contact_email || '',
      is_active: initialData.is_active ?? true,
    });

    resolveAddressCodes(initialData.province, initialData.regency, initialData.district, initialData.subdistrict);
    loadOwnerAndUsers();
  }, [open, initialData, villageId]);

  // --- Owner logic ---
  const loadOwnerAndUsers = async () => {
    setLoadingUsers(true);
    try {
      // Get current linked user from user_villages
      const { data: userVillage } = await supabase
        .from('user_villages')
        .select('user_id')
        .eq('village_id', villageId)
        .maybeSingle();

      if (userVillage?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .eq('user_id', userVillage.user_id)
          .maybeSingle();
        setCurrentOwner(profile || { user_id: userVillage.user_id, full_name: null, phone: null });
        setSelectedUserId(userVillage.user_id);
      } else {
        setCurrentOwner(null);
        setSelectedUserId('none_value');
      }

      // Get all admin_desa role users
      const { data: desaRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin_desa');

      if (!desaRoles || desaRoles.length === 0) {
        // Also check buyer users who could be assigned
        setAvailableUsers([]);
        setLoadingUsers(false);
        return;
      }

      const desaUserIds = desaRoles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('user_id', desaUserIds);

      // Get already-linked user_ids (excluding this village)
      const { data: linkedVillages } = await supabase
        .from('user_villages')
        .select('user_id')
        .neq('village_id', villageId);

      const linkedUserIds = new Set(linkedVillages?.map(v => v.user_id) || []);

      const available = (profiles || []).filter(
        p => !linkedUserIds.has(p.user_id) && p.user_id !== userVillage?.user_id
      );
      setAvailableUsers(available);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // --- Address resolution ---
  const resolveAddressCodes = async (
    provinceName?: string | null,
    regencyName?: string | null,
    districtName?: string | null,
    subdistrictName?: string | null
  ) => {
    if (!provinceName) {
      const provList = await fetchProvinces();
      setProvincesList(provList);
      return;
    }
    setLoadingAddr(true);
    try {
      const provList = await fetchProvinces();
      setProvincesList(provList);
      const provCode = findCodeByName(provList, provinceName);
      if (!provCode) { setLoadingAddr(false); return; }

      const regList = await fetchRegencies(provCode);
      setRegenciesList(regList);
      const regCode = findCodeByName(regList, regencyName);

      let distCode = '', villCode = '';
      if (regCode) {
        const distList = await fetchDistricts(regCode);
        setDistrictsList(distList);
        distCode = findCodeByName(distList, districtName);
        if (distCode) {
          const villList = await fetchVillages(distCode);
          setSubdistrictsList(villList);
          villCode = findCodeByName(villList, subdistrictName);
        }
      }

      setFormData(prev => ({
        ...prev,
        province_code: provCode,
        regency_code: regCode,
        district_code: distCode,
        subdistrict_code: villCode,
      }));
    } catch (error) {
      console.error('Error resolving address:', error);
    } finally {
      setLoadingAddr(false);
    }
  };

  // --- Address handlers ---
  const handleProvinceChange = async (code: string) => {
    const selected = provincesList.find(p => p.code === code);
    if (!selected) return;
    setRegenciesList([]); setDistrictsList([]); setSubdistrictsList([]);
    setFormData(prev => ({
      ...prev,
      province_code: code, province_name: selected.name,
      regency_code: '', regency_name: '',
      district_code: '', district_name: '',
      subdistrict_code: '', subdistrict_name: '',
    }));
    const regList = await fetchRegencies(code);
    setRegenciesList(regList);
  };

  const handleRegencyChange = async (code: string) => {
    const selected = regenciesList.find(r => r.code === code);
    if (!selected) return;
    setDistrictsList([]); setSubdistrictsList([]);
    setFormData(prev => ({
      ...prev,
      regency_code: code, regency_name: selected.name,
      district_code: '', district_name: '',
      subdistrict_code: '', subdistrict_name: '',
    }));
    const distList = await fetchDistricts(code);
    setDistrictsList(distList);
  };

  const handleDistrictChange = async (code: string) => {
    const selected = districtsList.find(d => d.code === code);
    if (!selected) return;
    setSubdistrictsList([]);
    setFormData(prev => ({
      ...prev,
      district_code: code, district_name: selected.name,
      subdistrict_code: '', subdistrict_name: '',
    }));
    const villList = await fetchVillages(code);
    setSubdistrictsList(villList);
  };

  const handleSubdistrictChange = (code: string) => {
    const selected = subdistrictsList.find(s => s.code === code);
    if (!selected) return;
    setFormData(prev => ({ ...prev, subdistrict_code: code, subdistrict_name: selected.name }));
  };

  // --- Map → auto-fill address ---
  const handleLocationChange = async (loc: { lat: number; lng: number }) => {
    setFormData(prev => ({ ...prev, location_lat: loc.lat, location_lng: loc.lng }));
    
    // Reverse geocode to fill address
    try {
      const result = await reverseGeocode(loc.lat, loc.lng);
      if (result) {
        // Try to match to dropdown data
        const provList = provincesList.length > 0 ? provincesList : await fetchProvinces();
        if (provincesList.length === 0) setProvincesList(provList);
        
        const provCode = findCodeByName(provList, result.province);
        if (provCode) {
          const regList = await fetchRegencies(provCode);
          setRegenciesList(regList);
          const regCode = findCodeByName(regList, result.city);

          let distCode = '', villCode = '';
          if (regCode) {
            const distList = await fetchDistricts(regCode);
            setDistrictsList(distList);
            distCode = findCodeByName(distList, result.district);
            if (distCode) {
              const villList = await fetchVillages(distCode);
              setSubdistrictsList(villList);
              villCode = findCodeByName(villList, result.village);
            }
          }

          setFormData(prev => ({
            ...prev,
            province_code: provCode, province_name: result.province || prev.province_name,
            regency_code: regCode, regency_name: result.city || prev.regency_name,
            district_code: distCode, district_name: result.district || prev.district_name,
            subdistrict_code: villCode, subdistrict_name: result.village || prev.subdistrict_name,
          }));
        }
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  };

  // --- Submit ---
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
          name: formData.name.trim(),
          province: formData.province_name || null,
          regency: formData.regency_name || null,
          district: formData.district_name || null,
          subdistrict: formData.subdistrict_name || null,
          description: formData.description || null,
          image_url: formData.image_url || null,
          location_lat: formData.location_lat,
          location_lng: formData.location_lng,
          contact_name: formData.contact_name || null,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', villageId);

      if (error) throw error;

      // Handle user_villages assignment
      const currentOwnerId = currentOwner?.user_id;
      const newOwnerId = selectedUserId === 'none_value' ? null : selectedUserId;

      if (newOwnerId !== currentOwnerId) {
        // Remove old link
        if (currentOwnerId) {
          await supabase.from('user_villages').delete().eq('village_id', villageId);
        }
        // Add new link
        if (newOwnerId) {
          await supabase.from('user_villages').upsert({
            user_id: newOwnerId,
            village_id: villageId,
            role: 'admin',
          }, { onConflict: 'user_id,village_id' });

          // Ensure user has admin_desa role
          const { data: existingRole } = await supabase
            .from('user_roles')
            .select('id')
            .eq('user_id', newOwnerId)
            .eq('role', 'admin_desa')
            .maybeSingle();

          if (!existingRole) {
            await supabase.from('user_roles').insert({ user_id: newOwnerId, role: 'admin_desa' });
          }
        }
      }

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Data Desa Wisata</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Basic Info + Image */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label>Nama Desa *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nama desa wisata"
                />
              </div>
              <div>
                <Label>Deskripsi</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Deskripsi desa wisata"
                  rows={4}
                />
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <ImageIcon className="h-4 w-4" />
                Gambar Utama
              </Label>
              <ImageUpload
                bucket="village-images"
                path={`villages/${villageId}`}
                value={formData.image_url}
                onChange={(url) => setFormData({ ...formData, image_url: url || '' })}
                aspectRatio="video"
              />
            </div>
          </div>

          {/* Owner (User Admin Desa) */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Pengelola (User Admin Desa)
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
              <Label>{currentOwner ? 'Ganti Pengelola' : 'Pilih Pengelola'}</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={loadingUsers}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? 'Memuat...' : 'Pilih user'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none_value">-- Lepas Pengelola --</SelectItem>
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
              <p className="text-xs text-muted-foreground">
                Menampilkan user dengan role admin desa yang belum terhubung ke desa lain
              </p>
            </div>
          </div>

          {/* Map + Auto-fill */}
          <div className="border-t pt-4">
            <Label className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" />
              Lokasi Peta (klik peta untuk auto-isi alamat)
            </Label>
            <AdminLocationPicker
              value={formData.location_lat && formData.location_lng ? { lat: formData.location_lat, lng: formData.location_lng } : null}
              onChange={handleLocationChange}
            />
          </div>

          {/* Address Dropdowns */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Alamat Lengkap</p>
            {loadingAddr && <p className="text-xs text-muted-foreground animate-pulse mb-2">Memuat data alamat...</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provinsi *</Label>
                <Select value={formData.province_code} onValueChange={handleProvinceChange} disabled={loadingAddr}>
                  <SelectTrigger>
                    <SelectValue placeholder={formData.province_name || 'Pilih provinsi'} />
                  </SelectTrigger>
                  <SelectContent>
                    {provincesList.map(p => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kabupaten/Kota *</Label>
                <Select value={formData.regency_code} onValueChange={handleRegencyChange} disabled={!formData.province_code || loadingAddr}>
                  <SelectTrigger>
                    <SelectValue placeholder={formData.regency_name || 'Pilih kabupaten/kota'} />
                  </SelectTrigger>
                  <SelectContent>
                    {regenciesList.map(r => <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kecamatan *</Label>
                <Select value={formData.district_code} onValueChange={handleDistrictChange} disabled={!formData.regency_code || loadingAddr}>
                  <SelectTrigger>
                    <SelectValue placeholder={formData.district_name || 'Pilih kecamatan'} />
                  </SelectTrigger>
                  <SelectContent>
                    {districtsList.map(d => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kelurahan/Desa *</Label>
                <Select value={formData.subdistrict_code} onValueChange={handleSubdistrictChange} disabled={!formData.district_code || loadingAddr}>
                  <SelectTrigger>
                    <SelectValue placeholder={formData.subdistrict_name || 'Pilih kelurahan'} />
                  </SelectTrigger>
                  <SelectContent>
                    {subdistrictsList.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Informasi Kontak</p>
            <div className="space-y-3">
              <div>
                <Label>Nama Kontak</Label>
                <Input value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} placeholder="Nama penanggung jawab" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Telepon</Label>
                  <Input value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} placeholder="08xxxxxxxxxx" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} placeholder="email@example.com" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
            <Label>Desa aktif</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading || loadingAddr}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}