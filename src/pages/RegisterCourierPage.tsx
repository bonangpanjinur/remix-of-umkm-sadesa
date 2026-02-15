import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Bike, Upload, Check, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getSettingByKey } from '@/lib/adminApi';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { AddressSelector, AddressData, createEmptyAddressData } from '@/components/AddressSelector';

const courierSchema = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter').max(100),
  phone: z.string().min(10, 'Nomor HP minimal 10 digit').max(15),
  email: z.string().email('Email tidak valid').optional().or(z.literal('')),
  ktpNumber: z.string().length(16, 'Nomor KTP harus 16 digit'),
  vehicleType: z.enum(['motor', 'mobil', 'sepeda']),
  vehiclePlate: z.string().optional(),
  address: z.string().min(10, 'Alamat minimal 10 karakter').max(500),
});

type CourierFormData = z.infer<typeof courierSchema>;

export default function RegisterCourierPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState<Partial<CourierFormData>>({ vehicleType: 'motor' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addressData, setAddressData] = useState<AddressData>(createEmptyAddressData());
  
  // Files
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [vehicleFile, setVehicleFile] = useState<File | null>(null);

  useEffect(() => {
    async function checkEnabled() {
      const setting = await getSettingByKey('registration_courier');
      const enabled = (setting?.value as { enabled?: boolean })?.enabled ?? true;
      setIsEnabled(enabled);
    }
    checkEnabled();
  }, []);

  const handleFileChange = (type: 'ktp' | 'photo' | 'vehicle', file: File | null) => {
    if (type === 'ktp') setKtpFile(file);
    if (type === 'photo') setPhotoFile(file);
    if (type === 'vehicle') setVehicleFile(file);
  };

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (currentStep === 1) {
      if (!formData.name || formData.name.length < 3) newErrors.name = 'Nama minimal 3 karakter';
      if (!formData.phone || formData.phone.length < 10) newErrors.phone = 'Nomor HP minimal 10 digit';
      if (!formData.ktpNumber || formData.ktpNumber.length !== 16) newErrors.ktpNumber = 'Nomor KTP harus 16 digit';
    }
    
    if (currentStep === 2) {
      if (!addressData.province) newErrors.province = 'Pilih provinsi';
      if (!addressData.city) newErrors.city = 'Pilih kota/kabupaten';
      if (!addressData.district) newErrors.district = 'Pilih kecamatan';
      if (!addressData.village) newErrors.village = 'Pilih kelurahan';
      if (!addressData.detail || addressData.detail.length < 10) newErrors.address = 'Alamat minimal 10 karakter';
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
    if (validateStep(step)) setStep(prev => prev + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    
    setLoading(true);
    try {
      const uploadFile = async (file: File, folder: string): Promise<string> => {
        const fileName = `${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage.from('courier-documents').upload(`${folder}/${fileName}`, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('courier-documents').getPublicUrl(data.path);
        return urlData.publicUrl;
      };

      const [ktpUrl, photoUrl, vehicleUrl] = await Promise.all([
        uploadFile(ktpFile!, 'ktp'),
        uploadFile(photoFile!, 'photo'),
        uploadFile(vehicleFile!, 'vehicle'),
      ]);

      if (!user) {
        toast.error('Anda harus login untuk mendaftar');
        navigate('/auth');
        return;
      }

      const { error } = await supabase.from('couriers').insert({
        user_id: user.id,
        name: formData.name,
        phone: formData.phone,
        email: formData.email || user.email || null,
        ktp_number: formData.ktpNumber,
        vehicle_type: formData.vehicleType,
        vehicle_plate: formData.vehiclePlate || null,
        province: addressData.provinceName,
        city: addressData.cityName,
        district: addressData.districtName,
        subdistrict: addressData.villageName,
        address: addressData.detail,
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
        <p className="text-muted-foreground mb-6">Saat ini pendaftaran kurir/ojek desa sedang tidak tersedia.</p>
        <Link to="/"><Button>Kembali ke Beranda</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
        <div className="flex gap-2 mt-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-secondary'}`} />
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
              <Input id="name" value={formData.name || ''} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Masukkan nama lengkap" />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Nomor HP/WhatsApp *</Label>
              <Input id="phone" type="tel" value={formData.phone || ''} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Opsional)</Label>
              <Input id="email" type="email" value={formData.email || ''} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} placeholder="email@example.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ktpNumber">Nomor KTP *</Label>
              <Input id="ktpNumber" value={formData.ktpNumber || ''} onChange={(e) => setFormData(prev => ({ ...prev, ktpNumber: e.target.value.replace(/\D/g, '').slice(0, 16) }))} placeholder="16 digit nomor KTP" maxLength={16} />
              {errors.ktpNumber && <p className="text-xs text-destructive">{errors.ktpNumber}</p>}
            </div>

            <div className="space-y-2">
              <Label>Jenis Kendaraan *</Label>
              <Select value={formData.vehicleType} onValueChange={(value) => setFormData(prev => ({ ...prev, vehicleType: value as CourierFormData['vehicleType'] }))}>
                <SelectTrigger><SelectValue placeholder="Pilih jenis kendaraan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="motor">Motor</SelectItem>
                  <SelectItem value="mobil">Mobil</SelectItem>
                  <SelectItem value="sepeda">Sepeda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehiclePlate">Nomor Plat Kendaraan</Label>
              <Input id="vehiclePlate" value={formData.vehiclePlate || ''} onChange={(e) => setFormData(prev => ({ ...prev, vehiclePlate: e.target.value.toUpperCase() }))} placeholder="B 1234 XYZ" />
            </div>
          </div>
        )}

        {/* Step 2: Address - now uses AddressSelector */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Alamat Lengkap</h2>
            <AddressSelector
              value={addressData}
              onChange={setAddressData}
              showDetailInput={true}
            />
            {(errors.province || errors.city || errors.district || errors.village) && (
              <p className="text-xs text-destructive">Semua field alamat wajib dipilih</p>
            )}
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>
        )}

        {/* Step 3: Documents */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Upload Dokumen</h2>
            
            <FileUpload label="Foto KTP *" description="Upload foto KTP yang jelas dan terbaca" file={ktpFile} onChange={(file) => handleFileChange('ktp', file)} error={errors.ktp} />
            <FileUpload label="Foto Diri *" description="Foto wajah yang jelas, tanpa kacamata hitam" file={photoFile} onChange={(file) => handleFileChange('photo', file)} error={errors.photo} />
            <FileUpload label="Foto Kendaraan *" description="Foto kendaraan tampak samping dengan plat terlihat" file={vehicleFile} onChange={(file) => handleFileChange('vehicle', file)} error={errors.vehicle} />
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>Kembali</Button>
          )}
          {step < 3 ? (
            <Button className="flex-1" onClick={handleNext}>Lanjut</Button>
          ) : (
            <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />Mendaftar...</>
              ) : (
                <><Check className="h-4 w-4 mr-2" />Daftar Sekarang</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// File Upload Component
function FileUpload({ label, description, file, onChange, error }: {
  label: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
        {file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm truncate max-w-[200px]">{file.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Hapus</Button>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Tap untuk upload</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
          </label>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
