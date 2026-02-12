import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Store, Phone, MapPin, ArrowLeft, CheckCircle, Clock, 
  Tag, FileText, Building, Shield, AlertCircle, Check, Mail, Loader2, ShieldCheck
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { BottomNav } from '../components/layout/BottomNav';
import { Button } from '../components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';
import { 
  fetchProvinces, fetchRegencies, fetchDistricts, fetchVillages,
  type Region
} from '../lib/addressApi';
import type { Village } from '../types';
import { MerchantLocationPicker } from '../components/merchant/MerchantLocationPicker';
import { HalalRegistrationInfo } from '../components/merchant/HalalRegistrationInfo';

const merchantSchema = z.object({
  referralCode: z.string().max(50).optional(),
  name: z.string().min(3, 'Nama usaha minimal 3 karakter').max(100),
  businessCategory: z.string().min(1, 'Pilih kategori usaha'),
  businessDescription: z.string().max(500).optional(),
  province: z.string().min(1, 'Pilih provinsi'),
  city: z.string().min(1, 'Pilih kabupaten/kota'),
  district: z.string().min(1, 'Pilih kecamatan'),
  subdistrict: z.string().min(1, 'Pilih kelurahan/desa'),
  addressDetail: z.string().min(10, 'Alamat detail minimal 10 karakter').max(200),
  phone: z.string().min(10, 'Nomor telepon minimal 10 digit').max(15),
  openTime: z.string().min(1, 'Pilih jam buka'),
  closeTime: z.string().min(1, 'Pilih jam tutup'),
});

type MerchantFormData = z.infer<typeof merchantSchema>;

const timeOptions = [
  '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00', '23:00', '00:00'
];

const businessCategories = [
  { value: 'kuliner', label: 'Kuliner & Makanan', icon: '🍜' },
  { value: 'fashion', label: 'Fashion & Pakaian', icon: '👕' },
  { value: 'kriya', label: 'Kerajinan Tangan', icon: '🎨' },
];

interface ReferralInfo {
  isValid: boolean;
  tradeGroup: string;
  description: string;
  isLoading: boolean;
}

export default function RegisterMerchantPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedSubdistrict, setSelectedSubdistrict] = useState('');
  
  const [provincesList, setProvincesList] = useState<Region[]>([]);
  const [cities, setCities] = useState<Region[]>([]);
  const [districtsList, setDistrictsList] = useState<Region[]>([]);
  const [subdistrictsList, setSubdistrictsList] = useState<Region[]>([]);
  
  // Loading states for address dropdowns
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSubdistricts, setLoadingSubdistricts] = useState(false);
  
  const [matchedVillage, setMatchedVillage] = useState<Village | null>(null);
  const [villageLoading, setVillageLoading] = useState(false);
  const [merchantLocation, setMerchantLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const [halalStatus, setHalalStatus] = useState<'NONE' | 'PENDING_VERIFICATION' | 'REQUESTED'>('NONE');
  const [halalCertUrl, setHalalCertUrl] = useState<string | undefined>(undefined);
  const [ktpUrl, setKtpUrl] = useState<string | undefined>(undefined);
  
  const [referralInfo, setReferralInfo] = useState<ReferralInfo>({
    isValid: false,
    tradeGroup: '',
    description: '',
    isLoading: false,
  });
  const [referralCode, setReferralCode] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<MerchantFormData>({
    resolver: zodResolver(merchantSchema),
  });

  useEffect(() => {
    const loadProvinces = async () => {
      setLoadingProvinces(true);
      try {
        const data = await fetchProvinces();
        setProvincesList(data);
      } catch (error) {
        console.error('Error loading provinces:', error);
        toast.error('Gagal memuat data provinsi');
      } finally {
        setLoadingProvinces(false);
      }
    };
    loadProvinces();
  }, []);

  useEffect(() => {
    const loadCities = async () => {
      if (selectedProvince) {
        setLoadingCities(true);
        try {
          const data = await fetchRegencies(selectedProvince);
          setCities(data);
          // Reset dependent fields
          setSelectedCity('');
          setSelectedDistrict('');
          setSelectedSubdistrict('');
          setValue('city', '');
          setValue('district', '');
          setValue('subdistrict', '');
        } catch (error) {
          console.error('Error loading cities:', error);
          toast.error('Gagal memuat data kabupaten/kota');
        } finally {
          setLoadingCities(false);
        }
      } else {
        setCities([]);
      }
    };
    loadCities();
  }, [selectedProvince, setValue]);

  useEffect(() => {
    const loadDistricts = async () => {
      if (selectedCity) {
        setLoadingDistricts(true);
        try {
          const data = await fetchDistricts(selectedCity);
          setDistrictsList(data);
          // Reset dependent fields
          setSelectedDistrict('');
          setSelectedSubdistrict('');
          setValue('district', '');
          setValue('subdistrict', '');
        } catch (error) {
          console.error('Error loading districts:', error);
          toast.error('Gagal memuat data kecamatan');
        } finally {
          setLoadingDistricts(false);
        }
      } else {
        setDistrictsList([]);
      }
    };
    loadDistricts();
  }, [selectedCity, setValue]);

  useEffect(() => {
    const loadSubdistricts = async () => {
      if (selectedDistrict) {
        setLoadingSubdistricts(true);
        try {
          const data = await fetchVillages(selectedDistrict);
          setSubdistrictsList(data);
          // Reset dependent fields
          setSelectedSubdistrict('');
          setValue('subdistrict', '');
        } catch (error) {
          console.error('Error loading subdistricts:', error);
          toast.error('Gagal memuat data kelurahan/desa');
        } finally {
          setLoadingSubdistricts(false);
        }
      } else {
        setSubdistrictsList([]);
      }
    };
    loadSubdistricts();
  }, [selectedDistrict, setValue]);

  useEffect(() => {
    async function checkVillageMatch() {
      if (!selectedSubdistrict) {
        setMatchedVillage(null);
        return;
      }

      setVillageLoading(true);
      try {
        const subdistrictName = subdistrictsList.find(s => s.code === selectedSubdistrict)?.name || '';
        
        const { data, error } = await supabase
          .from('villages')
          .select('*')
          .or(`name.ilike.%${subdistrictName}%,district.ilike.%${subdistrictName}%,subdistrict.ilike.%${subdistrictName}%`)
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          setMatchedVillage({
            id: data[0].id,
            name: data[0].name,
            district: data[0].district,
            regency: data[0].regency,
            description: data[0].description || '',
            image: data[0].image_url || '',
            isActive: data[0].is_active,
          });
        } else {
          setMatchedVillage(null);
        }
      } catch (error) {
        console.error('Error checking village match:', error);
        setMatchedVillage(null);
      } finally {
        setVillageLoading(false);
      }
    }
    checkVillageMatch();
  }, [selectedSubdistrict, subdistrictsList]);

  const validateReferralCode = async (code: string) => {
    if (code.length < 3) {
      setReferralInfo({ isValid: false, tradeGroup: '', description: '', isLoading: false });
      return;
    }
    setReferralInfo(prev => ({ ...prev, isLoading: true }));
    try {
      const { data, error } = await supabase
        .from('verifikator_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setReferralInfo({ isValid: false, tradeGroup: '', description: '', isLoading: false });
        return;
      }
      if (data.max_usage && data.usage_count >= data.max_usage) {
        setReferralInfo({ isValid: false, tradeGroup: '', description: 'Kode sudah mencapai batas maksimal penggunaan', isLoading: false });
        return;
      }
      setReferralInfo({
        isValid: true,
        tradeGroup: data.trade_group,
        description: data.description || '',
        isLoading: false,
      });
      setValue('referralCode', code.toUpperCase());
    } catch (error) {
      console.error('Error validating referral:', error);
      setReferralInfo({ isValid: false, tradeGroup: '', description: '', isLoading: false });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (referralCode) validateReferralCode(referralCode);
    }, 500);
    return () => clearTimeout(timer);
  }, [referralCode]);

  const onSubmit = async (data: MerchantFormData) => {
    if (referralCode && referralCode.length > 0 && !referralInfo.isValid) {
      toast.error('Kode referral tidak valid');
      return;
    }

    if (data.businessCategory === 'kuliner' && halalStatus === 'NONE' && !ktpUrl) {
      toast.error('Foto KTP wajib diunggah untuk kategori kuliner yang belum memiliki sertifikat halal');
      return;
    }

    setIsSubmitting(true);
    try {
      const provinceName = provincesList.find(p => p.code === data.province)?.name || '';
      const cityName = cities.find(c => c.code === data.city)?.name || '';
      const districtName = districtsList.find(d => d.code === data.district)?.name || '';
      const subdistrictName = subdistrictsList.find(s => s.code === data.subdistrict)?.name || '';

      if (!user) {
        toast.error('Anda harus login untuk mendaftar');
        navigate('/auth');
        return;
      }

      const { error } = await supabase.from('merchants').insert({
        name: data.name.trim(),
        // user_id is automatically handled by Supabase Trigger (on_merchant_signup)
        village_id: matchedVillage?.id || null,
        address: data.addressDetail.trim(),
        province: provinceName,
        city: cityName,
        district: districtName,
        subdistrict: subdistrictName,
        phone: data.phone.trim(),
        business_category: data.businessCategory,
        business_description: data.businessDescription?.trim() || null,
        verifikator_code: referralCode ? referralCode.toUpperCase() : null,
        trade_group: referralInfo.tradeGroup || null,
        registration_status: 'PENDING',
        status: 'PENDING',
        order_mode: 'ADMIN_ASSISTED',
        is_open: false,
        open_time: data.openTime,
        close_time: data.closeTime,
        registered_at: new Date().toISOString(),
        location_lat: merchantLocation?.lat || null,
        location_lng: merchantLocation?.lng || null,
        halal_status: halalStatus,
        halal_certificate_url: halalCertUrl,
        ktp_url: ktpUrl,
      });

      if (error) throw error;
      setIsSuccess(true);
      setShowEmailModal(true);
      toast.success('Pendaftaran pedagang berhasil dikirim!');
    } catch (error) {
      console.error('Error submitting merchant registration:', error);
      toast.error('Gagal mengirim pendaftaran. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PageHeader title="Pendaftaran Berhasil" showBack={false} />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-6"
          >
            <CheckCircle className="w-10 h-10 text-success" />
          </motion.div>
          <h2 className="text-2xl font-bold mb-2">Pendaftaran Terkirim!</h2>
          <p className="text-muted-foreground mb-8">
            Terima kasih telah mendaftar sebagai mitra merchant. Tim kami akan melakukan verifikasi data Anda dalam 1-3 hari kerja.
          </p>
          <Button onClick={() => navigate('/')} className="w-full max-w-xs">
            Kembali ke Beranda
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Daftar Jadi Merchant" />
      
      <main className="p-4 max-w-2xl mx-auto">
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-primary mb-1">Informasi Pendaftaran</p>
            <p className="text-muted-foreground">Lengkapi data usaha Anda dengan benar untuk mempercepat proses verifikasi oleh tim kami.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Referral Section */}
          <div className="space-y-4 bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Kode Referral (Opsional)</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referralCode">Punya kode dari verifikator?</Label>
              <div className="relative">
                <Input
                  id="referralCode"
                  placeholder="Masukkan kode referral"
                  className="uppercase pr-10"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                />
                {referralInfo.isLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                )}
                {!referralInfo.isLoading && referralInfo.isValid && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-success" />
                )}
              </div>
              {referralInfo.isValid && (
                <div className="bg-success/5 border border-success/20 rounded-lg p-3 flex gap-2 items-start">
                  <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  <div className="text-xs text-success">
                    <p className="font-bold">Kode Valid: {referralInfo.tradeGroup}</p>
                    <p>{referralInfo.description}</p>
                  </div>
                </div>
              )}
              {referralCode && !referralInfo.isValid && !referralInfo.isLoading && (
                <p className="text-xs text-destructive">Kode tidak ditemukan atau sudah tidak aktif</p>
              )}
            </div>
          </div>

          {/* Business Info */}
          <div className="space-y-4 bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Informasi Usaha</h3>
            </div>
            
              <div className="space-y-2">
                <Label htmlFor="name">Nama Usaha</Label>
                <Input id="name" {...register('name')} placeholder="Contoh: Warung Makan Berkah" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="verifikator_code">Kode Verifikator (Opsional)</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="verifikator_code"
                    className="pl-9 uppercase" 
                    placeholder="Masukkan kode verifikator jika ada" 
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Sama dengan Kode Referral di atas.</p>
              </div>

            <div className="space-y-2">
              <Label>Kategori Usaha</Label>
              <Select onValueChange={(val) => setValue('businessCategory', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {businessCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.businessCategory && <p className="text-xs text-destructive">{errors.businessCategory.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessDescription">Deskripsi Usaha (Opsional)</Label>
              <Textarea 
                id="businessDescription" 
                {...register('businessDescription')} 
                placeholder="Ceritakan sedikit tentang usaha Anda..."
                className="resize-none h-24"
              />
              {errors.businessDescription && <p className="text-xs text-destructive">{errors.businessDescription.message}</p>}
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4 bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Kontak & Operasional</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Nomor WhatsApp</Label>
              <Input id="phone" {...register('phone')} placeholder="08xxxxxxxxxx" type="tel" />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jam Buka</Label>
                <Select onValueChange={(val) => setValue('openTime', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Buka" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.openTime && <p className="text-xs text-destructive">{errors.openTime.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Jam Tutup</Label>
                <Select onValueChange={(val) => setValue('closeTime', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutup" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.closeTime && <p className="text-xs text-destructive">{errors.closeTime.message}</p>}
              </div>
            </div>
          </div>

          {/* Location Info */}
          <div className="space-y-4 bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Lokasi Usaha</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Provinsi</Label>
                <Select onValueChange={(val) => {
                  setSelectedProvince(val);
                  setValue('province', val);
                }}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      {loadingProvinces && <Loader2 className="w-3 h-3 animate-spin" />}
                      <SelectValue placeholder="Pilih provinsi" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {provincesList.map((p) => (
                      <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.province && <p className="text-xs text-destructive">{errors.province.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Kabupaten/Kota</Label>
                <Select 
                  disabled={!selectedProvince || loadingCities}
                  onValueChange={(val) => {
                    setSelectedCity(val);
                    setValue('city', val);
                  }}
                  value={selectedCity}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      {loadingCities && <Loader2 className="w-3 h-3 animate-spin" />}
                      <SelectValue placeholder={loadingCities ? "Memuat..." : "Pilih kabupaten/kota"} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Kecamatan</Label>
                <Select 
                  disabled={!selectedCity || loadingDistricts}
                  onValueChange={(val) => {
                    setSelectedDistrict(val);
                    setValue('district', val);
                  }}
                  value={selectedDistrict}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      {loadingDistricts && <Loader2 className="w-3 h-3 animate-spin" />}
                      <SelectValue placeholder={loadingDistricts ? "Memuat..." : "Pilih kecamatan"} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {districtsList.map((d) => (
                      <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.district && <p className="text-xs text-destructive">{errors.district.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Kelurahan/Desa</Label>
                <Select 
                  disabled={!selectedDistrict || loadingSubdistricts}
                  onValueChange={(val) => {
                    setSelectedSubdistrict(val);
                    setValue('subdistrict', val);
                  }}
                  value={selectedSubdistrict}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      {loadingSubdistricts && <Loader2 className="w-3 h-3 animate-spin" />}
                      <SelectValue placeholder={loadingSubdistricts ? "Memuat..." : "Pilih kelurahan/desa"} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {subdistrictsList.map((s) => (
                      <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subdistrict && <p className="text-xs text-destructive">{errors.subdistrict.message}</p>}
              </div>

              {villageLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  Mengecek ketersediaan desa digital...
                </div>
              )}

              {matchedVillage && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-3 items-start">
                  <Building className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-primary">Desa Digital Terdeteksi!</p>
                    <p className="text-muted-foreground">Usaha Anda akan terhubung dengan sistem digital {matchedVillage.name}.</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="addressDetail">Alamat Lengkap</Label>
                <Textarea 
                  id="addressDetail" 
                  {...register('addressDetail')} 
                  placeholder="Nama jalan, nomor rumah, patokan..."
                  className="resize-none h-20"
                />
                {errors.addressDetail && <p className="text-xs text-destructive">{errors.addressDetail.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Titik Lokasi (Opsional)</Label>
                <MerchantLocationPicker 
                  value={merchantLocation}
                  onChange={(location) => setMerchantLocation(location)}
                />
                <p className="text-[10px] text-muted-foreground">Gunakan titik lokasi agar pembeli lebih mudah menemukan usaha Anda.</p>
              </div>
            </div>
          </div>

          {watch('businessCategory') === 'kuliner' && (
            <HalalRegistrationInfo 
              onStatusChange={(status, cert, ktp) => {
                setHalalStatus(status);
                setHalalCertUrl(cert);
                setKtpUrl(ktp);
              }}
            />
          )}

          <div className="pt-4">
            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-bold" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  Memproses...
                </div>
              ) : (
                'Daftar Sekarang'
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground mt-4 px-4">
              Dengan mendaftar, Anda menyetujui Syarat & Ketentuan serta Kebijakan Privasi kami sebagai mitra merchant.
            </p>
          </div>
        </form>
      </main>

      <AlertDialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <AlertDialogContent className="max-w-[90vw] rounded-2xl">
          <AlertDialogHeader>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <AlertDialogTitle className="text-center text-xl">Pendaftaran Berhasil!</AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-3">
              <p>
                Data pendaftaran Anda telah kami terima dan sedang dalam proses verifikasi.
              </p>
              <div className="bg-muted p-3 rounded-lg text-xs text-left space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-primary" />
                  <span className="font-semibold">Apa selanjutnya?</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Verifikasi data (1-3 hari kerja)</li>
                  <li>Pemberitahuan via WhatsApp/Email</li>
                  <li>Akses ke Dashboard Merchant</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => navigate('/')} className="w-full h-11">
              Mengerti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
