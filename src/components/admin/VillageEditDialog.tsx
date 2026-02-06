import { useState, useEffect } from 'react';
import { Save, Image as ImageIcon, MapPin } from 'lucide-react';
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

export function VillageEditDialog({
  open,
  onOpenChange,
  villageId,
  initialData,
  onSuccess,
}: VillageEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    province: '',
    regency: '',
    district: '',
    subdistrict: '',
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

  // Load provinces and initial data on dialog open
  useEffect(() => {
    const initData = async () => {
      if (open && initialData) {
        // Load provinces first to get the list
        const provinces = await fetchProvinces();
        setProvincesList(provinces);

        // Find province code by name
        const province = provinces.find(p => p.name === initialData.province);
        const provinceCode = province?.code || '';

        let regencyCode = '';
        let districtCode = '';
        let subdistrictCode = '';

        if (provinceCode) {
          const regencies = await fetchRegencies(provinceCode);
          setRegenciesList(regencies);
          const regency = regencies.find(r => r.name === initialData.regency);
          regencyCode = regency?.code || '';

          if (regencyCode) {
            const districts = await fetchDistricts(regencyCode);
            setDistrictsList(districts);
            const district = districts.find(d => d.name === initialData.district);
            districtCode = district?.code || '';

            if (districtCode) {
              const subdistricts = await fetchVillages(districtCode);
              setSubdistrictsList(subdistricts);
              const subdistrict = subdistricts.find(s => s.name === initialData.subdistrict);
              subdistrictCode = subdistrict?.code || '';
            }
          }
        }

        setFormData({
          name: initialData.name || '',
          province: provinceCode,
          regency: regencyCode,
          district: districtCode,
          subdistrict: subdistrictCode,
          description: initialData.description || '',
          image_url: initialData.image_url || '',
          location_lat: initialData.location_lat ?? null,
          location_lng: initialData.location_lng ?? null,
          contact_name: initialData.contact_name || '',
          contact_phone: initialData.contact_phone || '',
          contact_email: initialData.contact_email || '',
          is_active: initialData.is_active ?? true,
        });
      }
    };

    initData();
  }, [open, initialData]);

  // Load regencies when province changes
  useEffect(() => {
    if (formData.province) {
      loadRegencies(formData.province);
    } else {
      setRegenciesList([]);
      setDistrictsList([]);
      setSubdistrictsList([]);
    }
  }, [formData.province]);

  // Load districts when regency changes
  useEffect(() => {
    if (formData.regency) {
      loadDistricts(formData.regency);
    } else {
      setDistrictsList([]);
      setSubdistrictsList([]);
    }
  }, [formData.regency]);

  // Load subdistricts when district changes
  useEffect(() => {
    if (formData.district) {
      loadSubdistricts(formData.district);
    } else {
      setSubdistrictsList([]);
    }
  }, [formData.district]);

  const loadProvinces = async () => {
    try {
      setLoadingRegions(true);
      const data = await fetchProvinces();
      setProvincesList(data);
    } catch (error) {
      console.error('Error loading provinces:', error);
      toast.error('Gagal memuat data provinsi');
    } finally {
      setLoadingRegions(false);
    }
  };

  const loadRegencies = async (provinceCode: string) => {
    try {
      setLoadingRegions(true);
      const data = await fetchRegencies(provinceCode);
      setRegenciesList(data);
    } catch (error) {
      console.error('Error loading regencies:', error);
      toast.error('Gagal memuat data kabupaten/kota');
    } finally {
      setLoadingRegions(false);
    }
  };

  const loadDistricts = async (regencyCode: string) => {
    try {
      setLoadingRegions(true);
      const data = await fetchDistricts(regencyCode);
      setDistrictsList(data);
    } catch (error) {
      console.error('Error loading districts:', error);
      toast.error('Gagal memuat data kecamatan');
    } finally {
      setLoadingRegions(false);
    }
  };

  const loadSubdistricts = async (districtCode: string) => {
    try {
      setLoadingRegions(true);
      const data = await fetchVillages(districtCode);
      setSubdistrictsList(data);
    } catch (error) {
      console.error('Error loading subdistricts:', error);
      toast.error('Gagal memuat data kelurahan/desa');
    } finally {
      setLoadingRegions(false);
    }
  };

  const getRegionName = (code: string, list: Region[]): string => {
    return list.find(r => r.code === code)?.name || '';
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Nama desa wajib diisi');
      return;
    }

    if (!formData.province) {
      toast.error('Provinsi wajib dipilih');
      return;
    }

    if (!formData.regency) {
      toast.error('Kabupaten/Kota wajib dipilih');
      return;
    }

    if (!formData.district) {
      toast.error('Kecamatan wajib dipilih');
      return;
    }

    if (!formData.subdistrict) {
      toast.error('Kelurahan/Desa wajib dipilih');
      return;
    }

    setLoading(true);
    try {
      // Get full names from selected codes
      const provinceName = getRegionName(formData.province, provincesList);
      const regencyName = getRegionName(formData.regency, regenciesList);
      const districtName = getRegionName(formData.district, districtsList);
      const subdistrictName = getRegionName(formData.subdistrict, subdistrictsList);

      const { error } = await supabase
        .from('villages')
        .update({
          name: formData.name.trim(),
          province: provinceName,
          regency: regencyName,
          district: districtName,
          subdistrict: subdistrictName,
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
                <Label>Deskripsi *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Deskripsi singkat desa wisata"
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
                bucket="tourism-images"
                path={`villages/${Date.now()}`}
                value={formData.image_url}
                onChange={(url) => setFormData({ ...formData, image_url: url || '' })}
                aspectRatio="video"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" />
              Lokasi Peta *
            </Label>
            <AdminLocationPicker
              value={formData.location_lat && formData.location_lng ? { lat: formData.location_lat, lng: formData.location_lng } : null}
              onChange={(loc) => setFormData({ ...formData, location_lat: loc.lat, location_lng: loc.lng })}
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Alamat Lengkap</p>
            <div className="space-y-3">
              {/* Provinsi */}
              <div>
                <Label>Provinsi *</Label>
                <Select 
                  value={formData.province} 
                  onValueChange={(value) => setFormData({ ...formData, province: value })}
                  disabled={loadingRegions}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih provinsi" />
                  </SelectTrigger>
                  <SelectContent>
                    {provincesList.map((province) => (
                      <SelectItem key={province.code} value={province.code}>
                        {province.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Kabupaten/Kota */}
              <div>
                <Label>Kabupaten/Kota *</Label>
                <Select 
                  value={formData.regency} 
                  onValueChange={(value) => setFormData({ ...formData, regency: value })}
                  disabled={!formData.province || loadingRegions}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.province ? "Pilih kabupaten/kota" : "Pilih provinsi dulu"} />
                  </SelectTrigger>
                  <SelectContent>
                    {regenciesList.map((regency) => (
                      <SelectItem key={regency.code} value={regency.code}>
                        {regency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Kecamatan */}
              <div>
                <Label>Kecamatan *</Label>
                <Select 
                  value={formData.district} 
                  onValueChange={(value) => setFormData({ ...formData, district: value })}
                  disabled={!formData.regency || loadingRegions}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.regency ? "Pilih kecamatan" : "Pilih kabupaten/kota dulu"} />
                  </SelectTrigger>
                  <SelectContent>
                    {districtsList.map((district) => (
                      <SelectItem key={district.code} value={district.code}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Kelurahan/Desa */}
              <div>
                <Label>Kelurahan/Desa *</Label>
                <Select 
                  value={formData.subdistrict} 
                  onValueChange={(value) => setFormData({ ...formData, subdistrict: value })}
                  disabled={!formData.district || loadingRegions}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.district ? "Pilih kelurahan/desa" : "Pilih kecamatan dulu"} />
                  </SelectTrigger>
                  <SelectContent>
                    {subdistrictsList.map((subdistrict) => (
                      <SelectItem key={subdistrict.code} value={subdistrict.code}>
                        {subdistrict.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
          <Button onClick={handleSubmit} disabled={loading || loadingRegions}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
