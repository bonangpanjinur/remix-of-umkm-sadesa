import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Bike, Upload, Check, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { fetchProvinces, fetchRegencies, fetchDistricts, fetchVillages as fetchSubdistricts, Region } from '@/lib/addressApi';
import { getSettingByKey } from '@/lib/adminApi';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const courierSchema = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter').max(100),
  phone: z.string().min(10, 'Nomor HP minimal 10 digit').max(15),
  email: z.string().email('Email tidak valid').optional().or(z.literal('')),
  ktpNumber: z.string().length(16, 'Nomor KTP harus 16 digit'),
  vehicleType: z.enum(['motor', 'mobil', 'sepeda']),
  vehiclePlate: z.string().optional(),
  province: z.string().min(1, 'Pilih provinsi'),
  city: z.string().min(1, 'Pilih kota/kabupaten'),
  district: z.string().min(1, 'Pilih kecamatan'),
  subdistrict: z.string().min(1, 'Pilih kelurahan'),
  address: z.string().min(10, 'Alamat minimal 10 karakter').max(500),
});

type CourierFormData = z.infer<typeof courierSchema>;

export default function RegisterCourierPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  // Form data
  const [formData, setFormData] = useState<Partial<CourierFormData>>({
    vehicleType: 'motor',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Files
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [vehicleFile, setVehicleFile] = useState<File | null>(null);
  
  // Address data
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [cities, setCities] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [subdistricts, setSubdistricts] = useState<Region[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedCityCode, setSelectedCityCode] = useState('');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('');

  // Check if registration is enabled
  useEffect(() => {
    async function checkEnabled() {
      const setting = await getSettingByKey('registration_courier');
      const enabled = (setting?.value as { enabled?: boolean })?.enabled ?? true;
      setIsEnabled(enabled);
    }
    checkEnabled();
    loadProvinces();
  }, []);

  const loadProvinces = async () => {
    const data = await fetchProvinces();
    setProvinces(data);
  };

  const handleProvinceChange = async (provinceCode: string) => {
    setSelectedProvinceCode(provinceCode);
    const province = provinces.find(p => p.code === provinceCode);
    setFormData(prev => ({ ...prev, province: province?.name || '' }));
    setCities([]);
    setDistricts([]);
    setSubdistricts([]);
    setSelectedCityCode('');
    setSelectedDistrictCode('');
    
    const data = await fetchRegencies(provinceCode);
    setCities(data);
  };

  const handleCityChange = async (cityCode: string) => {
    setSelectedCityCode(cityCode);
    const city = cities.find(c => c.code === cityCode);
    setFormData(prev => ({ ...prev, city: city?.name || '' }));
    setDistricts([]);
    setSubdistricts([]);
    setSelectedDistrictCode('');
    
    const data = await fetchDistricts(cityCode);
    setDistricts(data);
  };

  const handleDistrictChange = async (districtCode: string) => {
    setSelectedDistrictCode(districtCode);
    const district = districts.find(d => d.code === districtCode);
    setFormData(prev => ({ ...prev, district: district?.name || '' }));
    setSubdistricts([]);
    
    const data = await fetchSubdistricts(districtCode);
    setSubdistricts(data);
  };

  const handleSubdistrictChange = (subdistrictCode: string) => {
    const subdistrict = subdistricts.find(s => s.code === subdistrictCode);
    setFormData(prev => ({ ...prev, subdistrict: subdistrict?.name || '' }));
  };

  const handleFileChange = (type: 'ktp' | 'photo' | 'vehicle', file: File | null) => {
    if (type === 'ktp') setKtpFile(file);
    if (type === 'photo') setPhotoFile(file);
    if (type === 'vehicle') setVehicleFile(file);
  };

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (currentStep === 1) {
      if (!formData.name || formData.name.length < 3) {
        newErrors.name = 'Nama minimal 3 karakter';
      }
      if (!formData.phone || formData.phone.length < 10) {
        newErrors.phone = 'Nomor HP minimal 10 digit';
      }
      if (!formData.ktpNumber || formData.ktpNumber.length !== 16) {
        newErrors.ktpNumber = 'Nomor KTP harus 16 digit';
      }
    }
    
    if (currentStep === 2) {
      if (!formData.province) newErrors.province = 'Pilih provinsi';
      if (!formData.city) newErrors.city = 'Pilih kota/kabupaten';
      if (!formData.district) newErrors.district = 'Pilih kecamatan';
      if (!formData.subdistrict) newErrors.subdistrict = 'Pilih kelurahan';
      if (!formData.address || formData.address.length < 10) {
        newErrors.address = 'Alamat minimal 10 karakter';
      }
    }
    
    if (currentStep === 3) {
      if (!ktpFile) newErrors.ktp = 'Upload foto KTP wajib';
      if (!photoFile) newErrors.photo = 'Upload foto diri wajib';
      if (!vehicleFile) newErrors.vehicle = 'Upload foto kendaraan wajib';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    
    setLoading(true);
    try {
      // Upload files to storage
      const uploadFile = async (file: File, folder: string): Promise<string> => {
        const fileName = `${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from('courier-documents')
          .upload(`${folder}/${fileName}`, file);
        
        if (error) throw error;
        
        const { data: urlData } = supabase.storage
          .from('courier-documents')
          .getPublicUrl(data.path);
        
        return urlData.publicUrl;
      };

      const [ktpUrl, photoUrl, vehicleUrl] = await Promise.all([
        uploadFile(ktpFile!, 'ktp'),
        uploadFile(photoFile!, 'photo'),
        uploadFile(vehicleFile!, 'vehicle'),
      ]);

      // Insert courier data
      const { error } = await supabase.from('couriers').insert({
        user_id: user?.id || null,
        name: formData.name,
        phone: formData.phone,
        email: formData.email || user?.email || null,
        ktp_number: formData.ktpNumber,
        vehicle_type: formData.vehicleType,
        vehicle_plate: formData.vehiclePlate || null,
        province: formData.province,
        city: formData.city,
        district: formData.district,
        subdistrict: formData.subdistrict,
        address: formData.address,
        ktp_image_url: ktpUrl,
        photo_url: photoUrl,
        vehicle_image_url: vehicleUrl,
        registration_status: 'PENDING',
        status: 'INACTIVE',
      });

      if (error) throw error;

      toast.success('Pendaftaran berhasil! Menunggu verifikasi admin.');
      navigate('/');
    } catch (error) {
      console.error('Error registering courier:', error);
      toast.error('Gagal mendaftar. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (isEnabled === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold mb-2">Pendaftaran Ditutup</h1>
        <p className="text-muted-foreground mb-6">
          Saat ini pendaftaran kurir/ojek desa sedang tidak tersedia.
        </p>
        <Link to="/">
          <Button>Kembali ke Beranda</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)} className="p-2 -ml-2 hover:bg-secondary rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold">Daftar Kurir/Ojek Desa</h1>
            <p className="text-xs text-muted-foreground">Langkah {step} dari 3</p>
          </div>
          <Bike className="h-6 w-6 text-primary" />
        </div>
        
        {/* Progress */}
        <div className="flex gap-2 mt-3">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-secondary'}`}
            />
          ))}
        </div>
      </header>

      <div className="p-4 pb-24 max-w-lg mx-auto">
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Data Pribadi</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Masukkan nama lengkap"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Nomor HP/WhatsApp *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="08xxxxxxxxxx"
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Opsional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ktpNumber">Nomor KTP *</Label>
              <Input
                id="ktpNumber"
                value={formData.ktpNumber || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, ktpNumber: e.target.value.replace(/\D/g, '').slice(0, 16) }))}
                placeholder="16 digit nomor KTP"
                maxLength={16}
              />
              {errors.ktpNumber && <p className="text-xs text-destructive">{errors.ktpNumber}</p>}
            </div>

            <div className="space-y-2">
              <Label>Jenis Kendaraan *</Label>
              <Select
                value={formData.vehicleType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, vehicleType: value as CourierFormData['vehicleType'] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis kendaraan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="motor">Motor</SelectItem>
                  <SelectItem value="mobil">Mobil</SelectItem>
                  <SelectItem value="sepeda">Sepeda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehiclePlate">Nomor Plat Kendaraan</Label>
              <Input
                id="vehiclePlate"
                value={formData.vehiclePlate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, vehiclePlate: e.target.value.toUpperCase() }))}
                placeholder="B 1234 XYZ"
              />
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Alamat Lengkap</h2>
            
            <div className="space-y-2">
              <Label>Provinsi *</Label>
              <Select value={selectedProvinceCode} onValueChange={handleProvinceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih provinsi" />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.province && <p className="text-xs text-destructive">{errors.province}</p>}
            </div>

            <div className="space-y-2">
              <Label>Kota/Kabupaten *</Label>
              <Select value={selectedCityCode} onValueChange={handleCityChange} disabled={!selectedProvinceCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kota/kabupaten" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>

            <div className="space-y-2">
              <Label>Kecamatan *</Label>
              <Select value={selectedDistrictCode} onValueChange={handleDistrictChange} disabled={!selectedCityCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kecamatan" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((d) => (
                    <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.district && <p className="text-xs text-destructive">{errors.district}</p>}
            </div>

            <div className="space-y-2">
              <Label>Kelurahan/Desa *</Label>
              <Select 
                value={subdistricts.find(s => s.name === formData.subdistrict)?.code || ''} 
                onValueChange={handleSubdistrictChange}
                disabled={!selectedDistrictCode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelurahan/desa" />
                </SelectTrigger>
                <SelectContent>
                  {subdistricts.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.subdistrict && <p className="text-xs text-destructive">{errors.subdistrict}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Alamat Detail *</Label>
              <Input
                id="address"
                value={formData.address || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="RT/RW, Nama Jalan, Nomor Rumah"
              />
              {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
            </div>
          </div>
        )}

        {/* Step 3: Documents */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Upload Dokumen</h2>
            
            <FileUpload
              label="Foto KTP *"
              description="Upload foto KTP yang jelas dan terbaca"
              file={ktpFile}
              onChange={(file) => handleFileChange('ktp', file)}
              error={errors.ktp}
            />

            <FileUpload
              label="Foto Diri *"
              description="Foto wajah yang jelas, tanpa kacamata hitam"
              file={photoFile}
              onChange={(file) => handleFileChange('photo', file)}
              error={errors.photo}
            />

            <FileUpload
              label="Foto Kendaraan *"
              description="Foto kendaraan tampak samping dengan plat terlihat"
              file={vehicleFile}
              onChange={(file) => handleFileChange('vehicle', file)}
              error={errors.vehicle}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
        <div className="max-w-lg mx-auto">
          {step < 3 ? (
            <Button onClick={handleNext} className="w-full">
              Lanjutkan
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="w-full" disabled={loading}>
              {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// File Upload Component
function FileUpload({
  label,
  description,
  file,
  onChange,
  error,
}: {
  label: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (selectedFile && selectedFile.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }
    onChange(selectedFile);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div 
        className={`border-2 border-dashed rounded-lg p-4 text-center transition ${
          file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
          id={label}
        />
        <label htmlFor={label} className="cursor-pointer">
          {file ? (
            <div className="flex items-center justify-center gap-2 text-primary">
              <Check className="h-5 w-5" />
              <span className="font-medium">{file.name}</span>
            </div>
          ) : (
            <div>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{description}</p>
              <p className="text-xs text-muted-foreground mt-1">Max 5MB, format JPG/PNG</p>
            </div>
          )}
        </label>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
