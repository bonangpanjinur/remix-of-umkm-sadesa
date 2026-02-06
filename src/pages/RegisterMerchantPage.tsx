import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Store, Phone, MapPin, ArrowLeft, CheckCircle, Clock, 
  Tag, FileText, Building, Shield, AlertCircle, Check, Mail
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
  
  const [matchedVillage, setMatchedVillage] = useState<Village | null>(null);
  const [villageLoading, setVillageLoading] = useState(false);
  const [merchantLocation, setMerchantLocation] = useState<{ lat: number; lng: number } | null>(null);
  
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
      try {
        const data = await fetchProvinces();
        setProvincesList(data);
      } catch (error) {
        console.error('Error loading provinces:', error);
      }
    };
    loadProvinces();
  }, []);

  useEffect(() => {
    const loadCities = async () => {
      if (selectedProvince) {
        try {
          const data = await fetchRegencies(selectedProvince);
          setCities(data);
          setSelectedCity('');
          setSelectedDistrict('');
          setSelectedSubdistrict('');
          setValue('city', '');
          setValue('district', '');
          setValue('subdistrict', '');
        } catch (error) {
          console.error('Error loading cities:', error);
        }
      }
    };
    loadCities();
  }, [selectedProvince, setValue]);

  useEffect(() => {
    const loadDistricts = async () => {
      if (selectedCity) {
        try {
          const data = await fetchDistricts(selectedCity);
          setDistrictsList(data);
          setSelectedDistrict('');
          setSelectedSubdistrict('');
          setValue('district', '');
          setValue('subdistrict', '');
        } catch (error) {
          console.error('Error loading districts:', error);
        }
      }
    };
    loadDistricts();
  }, [selectedCity, setValue]);

  useEffect(() => {
    const loadSubdistricts = async () => {
      if (selectedDistrict) {
        try {
          const data = await fetchVillages(selectedDistrict);
          setSubdistrictsList(data);
          setSelectedSubdistrict('');
          setValue('subdistrict', '');
        } catch (error) {
          console.error('Error loading subdistricts:', error);
        }
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
        user_id: user.id,
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
        location_lat: merchantLocation?.lat || null,
        location_lng: merchantLocation?.lng || null,
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
      <div className="mobile-shell bg-background flex flex-col min-h-screen">
        <PageHeader title="Pendaftaran Berhasil" showBack={false} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="h-10 w-10 text-success" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Pendaftaran Terkirim!</h2>
          <p className="text-muted-foreground mb-8">
            Terima kasih telah mendaftar. Tim kami akan melakukan verifikasi data usaha Anda dalam 1-2 hari kerja. Kami akan menghubungi Anda melalui nomor telepon yang terdaftar.
          </p>
          <Button onClick={() => navigate('/')} className="w-full">
            Kembali ke Beranda
          </Button>
        </div>

        <AlertDialog open={showEmailModal} onOpenChange={setShowEmailModal}>
          <AlertDialogContent className="w-[90%] rounded-2xl">
            <AlertDialogHeader>
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <AlertDialogTitle className="text-center">Verifikasi Email Anda</AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                Pendaftaran berhasil! Mohon segera cek email Anda untuk memverifikasi pendaftaran merchant. Pastikan juga untuk memeriksa folder spam jika email tidak ditemukan di kotak masuk.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowEmailModal(false)} className="w-full rounded-xl">
                Saya Mengerti
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <PageHeader title="Daftar Jadi Pedagang" onBack={() => navigate('/register')} />
      
      <div className="flex-1 overflow-y-auto pb-24">
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-6 space-y-6">
          {/* Referral Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Tag className="h-5 w-5" />
              <h3 className="font-bold">Kode Referral</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referralCode">Kode Verifikator (Opsional)</Label>
              <div className="relative">
                <Input
                  id="referralCode"
                  placeholder="Masukkan kode jika ada"
                  className={`uppercase pr-10 ${referralInfo.isValid ? 'border-success focus-visible:ring-success' : ''}`}
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {referralInfo.isLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : referralInfo.isValid ? (
                    <Check className="h-5 w-5 text-success" />
                  ) : null}
                </div>
              </div>
              {referralInfo.isValid && (
                <p className="text-xs text-success flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Kode valid: {referralInfo.tradeGroup}
                </p>
              )}
              {referralCode && !referralInfo.isValid && !referralInfo.isLoading && referralCode.length >= 3 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {referralInfo.description || 'Kode tidak ditemukan atau tidak aktif'}
                </p>
              )}
            </div>
          </section>

          {/* Business Info */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Store className="h-5 w-5" />
              <h3 className="font-bold">Informasi Usaha</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Usaha/Toko</Label>
                <Input id="name" placeholder="Contoh: Warung Makan Berkah" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Kategori Usaha</Label>
                <Select onValueChange={(v) => setValue('businessCategory', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          {cat.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.businessCategory && <p className="text-xs text-destructive">{errors.businessCategory.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessDescription">Deskripsi Singkat (Opsional)</Label>
                <Textarea 
                  id="businessDescription" 
                  placeholder="Ceritakan sedikit tentang produk atau jasa Anda"
                  className="resize-none"
                  rows={3}
                  {...register('businessDescription')}
                />
              </div>
            </div>
          </section>

          {/* Operational Info */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Clock className="h-5 w-5" />
              <h3 className="font-bold">Jam Operasional</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jam Buka</Label>
                <Select onValueChange={(v) => setValue('openTime', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Buka" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.openTime && <p className="text-xs text-destructive">{errors.openTime.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Jam Tutup</Label>
                <Select onValueChange={(v) => setValue('closeTime', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutup" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.closeTime && <p className="text-xs text-destructive">{errors.closeTime.message}</p>}
              </div>
            </div>
          </section>

          {/* Contact & Address */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="h-5 w-5" />
              <h3 className="font-bold">Kontak & Alamat</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Nomor WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="phone" placeholder="08xxxxxxxxxx" className="pl-10" {...register('phone')} />
                </div>
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Provinsi</Label>
                <Select onValueChange={(v) => {
                  setSelectedProvince(v);
                  setValue('province', v);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih provinsi" />
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
                  disabled={!selectedProvince} 
                  onValueChange={(v) => {
                    setSelectedCity(v);
                    setValue('city', v);
                  }}
                  value={selectedCity || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kabupaten/kota" />
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
                  disabled={!selectedCity} 
                  onValueChange={(v) => {
                    setSelectedDistrict(v);
                    setValue('district', v);
                  }}
                  value={selectedDistrict || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kecamatan" />
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
                  disabled={!selectedDistrict} 
                  onValueChange={(v) => {
                    setSelectedSubdistrict(v);
                    setValue('subdistrict', v);
                  }}
                  value={selectedSubdistrict || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kelurahan/desa" />
                  </SelectTrigger>
                  <SelectContent>
                    {subdistrictsList.map((s) => (
                      <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subdistrict && <p className="text-xs text-destructive">{errors.subdistrict.message}</p>}
              </div>

              {villageLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                  Mengecek ketersediaan desa wisata...
                </div>
              ) : matchedVillage ? (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3">
                  <Building className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-primary">Terdeteksi di {matchedVillage.name}</p>
                    <p className="text-xs text-muted-foreground">Usaha Anda akan otomatis terhubung dengan Desa Wisata ini.</p>
                  </div>
                </div>
              ) : selectedSubdistrict ? (
                <div className="p-3 bg-secondary/50 border border-border rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Desa Wisata Belum Terdaftar</p>
                    <p className="text-xs text-muted-foreground">Anda tetap bisa mendaftar, namun belum terhubung ke desa wisata tertentu.</p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="addressDetail">Alamat Detail</Label>
                <Textarea 
                  id="addressDetail" 
                  placeholder="Nama jalan, nomor rumah, patokan, dll"
                  className="resize-none"
                  rows={2}
                  {...register('addressDetail')}
                />
                {errors.addressDetail && <p className="text-xs text-destructive">{errors.addressDetail.message}</p>}
              </div>
              
              {/* Location Picker */}
              <MerchantLocationPicker
                value={merchantLocation}
                onChange={setMerchantLocation}
              />
            </div>
          </section>

          {/* Terms & Submit */}
          <div className="pt-4 space-y-4">
            <div className="p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex gap-3">
                <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dengan mendaftar, Anda menyetujui <span className="text-primary font-medium">Syarat & Ketentuan</span> serta <span className="text-primary font-medium">Kebijakan Privasi</span> DesaMart. Data Anda akan diverifikasi untuk keamanan bersama.
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                  Memproses...
                </>
              ) : (
                'Daftar Sekarang'
              )}
            </Button>
          </div>
        </form>
      </div>
      
      <BottomNav />
    </div>
  );
}
