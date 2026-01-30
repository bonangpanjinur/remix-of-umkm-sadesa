import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Store, Phone, MapPin, ArrowLeft, CheckCircle, Clock, CreditCard, 
  Tag, FileText, MapPinned, Building, Shield, AlertCircle, Check
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  fetchProvinces, fetchRegencies, fetchDistricts, fetchVillages,
  type Region
} from '@/lib/addressApi';
import type { Village } from '@/types';

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
  classificationPrice: z.string().min(1, 'Pilih klasifikasi harga'),
});

type MerchantFormData = z.infer<typeof merchantSchema>;

const timeOptions = [
  '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00', '23:00', '00:00'
];

const priceClassifications = [
  { value: 'UNDER_5K', label: 'Sangat Murah (< Rp 5.000)', icon: '💰' },
  { value: 'FROM_5K_TO_10K', label: 'Murah (Rp 5.000 - Rp 10.000)', icon: '💵' },
  { value: 'FROM_10K_TO_20K', label: 'Sedang (Rp 10.000 - Rp 20.000)', icon: '💳' },
  { value: 'ABOVE_20K', label: 'Premium (> Rp 20.000)', icon: '💎' },
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
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
          .eq('is_active', true)
          .eq('registration_status', 'APPROVED')
          .or(`district.ilike.%${subdistrictName}%,subdistrict.ilike.%${subdistrictName}%`)
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

      const { error } = await supabase.from('merchants').insert({
        name: data.name.trim(),
        village_id: matchedVillage?.id || null,
        address: data.addressDetail.trim(),
        province: provinceName,
        city: cityName,
        district: districtName,
        subdistrict: subdistrictName,
        phone: data.phone.trim(),
        classification_price: data.classificationPrice,
        business_category: data.businessCategory,
        business_description: data.businessDescription?.trim() || null,
        verifikator_code: referralCode ? referralCode.toUpperCase() : null,
        trade_group: referralInfo.tradeGroup || null,
        registration_status: 'PENDING',
        status: 'PENDING',
        order_mode: 'ADMIN_ASSISTED',
        is_open: false,
      });

      if (error) throw error;
      setIsSuccess(true);
      toast.success('Pendaftaran pedagang berhasil dikirim!');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Gagal mendaftar pedagang');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card p-8 rounded-3xl shadow-sm border border-border max-w-md w-full"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Pendaftaran Berhasil!</h1>
          <p className="text-muted-foreground mb-8">
            Data usaha Anda telah kami terima dan sedang dalam proses verifikasi. 
            Kami akan menghubungi Anda melalui nomor WhatsApp yang terdaftar.
          </p>
          <Button onClick={() => navigate('/')} className="w-full rounded-xl py-6">
            Kembali ke Beranda
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Daftar Merchant" showBack onBack={() => navigate(-1)} />
      
      <main className="p-4 max-w-lg mx-auto">
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-foreground leading-tight">Daftarkan Usaha</h1>
              <p className="text-xs text-muted-foreground">Lengkapi data usaha Anda</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Referral Section */}
            <div className="space-y-4">
              <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Punya Kode Referral?</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Masukkan kode dari Verifikator untuk prioritas verifikasi.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="referralCode" className="text-xs">Kode Referral (opsional)</Label>
                <div className="relative mt-1.5">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="referralCode"
                    placeholder="CONTOH: DESAMART01"
                    className={`pl-10 uppercase font-bold tracking-wider ${referralInfo.isValid ? 'border-primary bg-primary/5' : ''}`}
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  />
                  {referralInfo.isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                  {referralInfo.isValid && !referralInfo.isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </div>
                {referralInfo.isValid && (
                  <div className="mt-3 p-3 bg-primary/10 rounded-xl border border-primary/20">
                    <p className="text-xs font-bold text-primary">✓ Kode Valid: {referralInfo.tradeGroup}</p>
                    <p className="text-[10px] text-primary/80 mt-0.5">{referralInfo.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Business Info Section */}
            <div className="space-y-5 pt-4 border-t border-border">
              <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Informasi Usaha
              </h2>
              <div>
                <Label htmlFor="name" className="text-xs">Nama Usaha *</Label>
                <Input id="name" placeholder="Contoh: Warung Nasi Ibu Siti" {...register('name')} className="mt-1.5" />
                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label className="text-xs">Kategori Usaha *</Label>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {businessCategories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setValue('businessCategory', cat.value)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${watch('businessCategory') === cat.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="text-sm font-medium">{cat.label}</span>
                      {watch('businessCategory') === cat.value && <Check className="h-4 w-4 text-primary ml-auto" />}
                    </button>
                  ))}
                </div>
                {errors.businessCategory && <p className="text-destructive text-xs mt-1">{errors.businessCategory.message}</p>}
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-5 pt-4 border-t border-border">
              <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-primary" />
                Alamat Lengkap
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label className="text-xs">Provinsi *</Label>
                  <Select onValueChange={(v) => { setSelectedProvince(v); setValue('province', v); }}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pilih provinsi" /></SelectTrigger>
                    <SelectContent>{provincesList.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.province && <p className="text-destructive text-xs mt-1">{errors.province.message}</p>}
                </div>
                <div>
                  <Label className="text-xs">Kabupaten/Kota *</Label>
                  <Select onValueChange={(v) => { setSelectedCity(v); setValue('city', v); }} disabled={!selectedProvince}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder={selectedProvince ? "Pilih kabupaten/kota" : "Pilih provinsi dulu"} /></SelectTrigger>
                    <SelectContent>{cities.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.city && <p className="text-destructive text-xs mt-1">{errors.city.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Kecamatan *</Label>
                    <Select onValueChange={(v) => { setSelectedDistrict(v); setValue('district', v); }} disabled={!selectedCity}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pilih kecamatan" /></SelectTrigger>
                      <SelectContent>{districtsList.map((d) => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.district && <p className="text-destructive text-xs mt-1">{errors.district.message}</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Kelurahan/Desa *</Label>
                    <Select onValueChange={(v) => { setSelectedSubdistrict(v); setValue('subdistrict', v); }} disabled={!selectedDistrict}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pilih kelurahan" /></SelectTrigger>
                      <SelectContent>{subdistrictsList.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.subdistrict && <p className="text-destructive text-xs mt-1">{errors.subdistrict.message}</p>}
                  </div>
                </div>
              </div>
              {selectedSubdistrict && (
                <div className={`rounded-xl p-4 ${villageLoading ? 'bg-muted' : matchedVillage ? 'bg-primary/10 border border-primary/20' : 'bg-accent/10 border border-accent/20'}`}>
                  {villageLoading ? <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" /><span className="text-sm text-muted-foreground">Mencari desa wisata...</span></div> : matchedVillage ? <div className="flex items-start gap-3"><Building className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" /><div><p className="text-xs text-muted-foreground mb-1">Desa Wisata Terdeteksi:</p><p className="text-sm font-semibold text-foreground">{matchedVillage.name}</p><p className="text-xs text-muted-foreground">{matchedVillage.district}, {matchedVillage.regency}</p></div></div> : <div className="flex items-start gap-3"><AlertCircle className="h-5 w-5 text-accent-foreground flex-shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-foreground">Belum Ada Desa Wisata</p><p className="text-xs text-muted-foreground">Lokasi Anda belum terdaftar sebagai desa wisata resmi.</p></div></div>}
                </div>
              )}
              <div>
                <Label htmlFor="addressDetail" className="text-xs">Alamat Detail *</Label>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea id="addressDetail" placeholder="Jalan, nomor, RT/RW, patokan..." {...register('addressDetail')} className="pl-10 min-h-[70px]" />
                </div>
                {errors.addressDetail && <p className="text-destructive text-xs mt-1">{errors.addressDetail.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs">Nomor WhatsApp *</Label>
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="phone" placeholder="08xxxxxxxxxx" {...register('phone')} className="pl-10" />
                </div>
                {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>}
              </div>
            </div>

            {/* Operating Hours & Price Section */}
            <div className="space-y-5 pt-4 border-t border-border">
              <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Operasional & Harga
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Jam Buka *</Label>
                  <Select onValueChange={(v) => setValue('openTime', v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Buka" /></SelectTrigger>
                    <SelectContent>{timeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Jam Tutup *</Label>
                  <Select onValueChange={(v) => setValue('closeTime', v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Tutup" /></SelectTrigger>
                    <SelectContent>{timeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Klasifikasi Harga *</Label>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {priceClassifications.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setValue('classificationPrice', item.value)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${watch('classificationPrice') === item.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span className="text-sm font-medium">{item.label}</span>
                      {watch('classificationPrice') === item.value && <Check className="h-4 w-4 text-primary ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full rounded-xl py-6 mt-4" disabled={isSubmitting}>
              {isSubmitting ? <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /><span>Memproses...</span></div> : 'Daftar Sekarang'}
            </Button>
          </form>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
