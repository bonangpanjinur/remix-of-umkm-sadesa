import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Store, Phone, MapPin, ArrowLeft, CheckCircle, Clock, CreditCard, 
  Tag, FileText, MapPinned, Building, Shield, AlertCircle, Check
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  provinces, getCitiesByProvince, getDistrictsByCity, getSubdistrictsByDistrict,
  type City, type District, type Subdistrict
} from '@/data/indonesiaRegions';
import type { Village } from '@/types';

const merchantSchema = z.object({
  // Referral code (required)
  referralCode: z.string().min(3, 'Kode referral wajib diisi').max(50),
  
  // Business info
  name: z.string().min(3, 'Nama usaha minimal 3 karakter').max(100),
  businessCategory: z.string().min(1, 'Pilih kategori usaha'),
  businessDescription: z.string().max(500).optional(),
  
  // Address
  province: z.string().min(1, 'Pilih provinsi'),
  city: z.string().min(1, 'Pilih kabupaten/kota'),
  district: z.string().min(1, 'Pilih kecamatan'),
  subdistrict: z.string().min(1, 'Pilih kelurahan/desa'),
  addressDetail: z.string().min(10, 'Alamat detail minimal 10 karakter').max(200),
  
  // Contact
  phone: z.string().min(10, 'Nomor telepon minimal 10 digit').max(15),
  
  // Operating hours
  openTime: z.string().min(1, 'Pilih jam buka'),
  closeTime: z.string().min(1, 'Pilih jam tutup'),
  
  // Price classification
  classificationPrice: z.string().min(1, 'Pilih klasifikasi harga'),
});

type MerchantFormData = z.infer<typeof merchantSchema>;

const timeOptions = [
  '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00', '23:00', '00:00'
];

const priceClassifications = [
  { value: 'MURAH', label: 'Murah (< Rp 25.000)', icon: '💰' },
  { value: 'SEDANG', label: 'Sedang (Rp 25.000 - Rp 75.000)', icon: '💵' },
  { value: 'MAHAL', label: 'Premium (> Rp 75.000)', icon: '💎' },
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
  const [currentStep, setCurrentStep] = useState(1);
  
  // Address cascading
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedSubdistrict, setSelectedSubdistrict] = useState('');
  
  const [cities, setCities] = useState<City[]>([]);
  const [districtsList, setDistrictsList] = useState<District[]>([]);
  const [subdistrictsList, setSubdistrictsList] = useState<Subdistrict[]>([]);
  
  // Matched village
  const [matchedVillage, setMatchedVillage] = useState<Village | null>(null);
  const [villageLoading, setVillageLoading] = useState(false);
  
  // Referral validation
  const [referralInfo, setReferralInfo] = useState<ReferralInfo>({
    isValid: false,
    tradeGroup: '',
    description: '',
    isLoading: false,
  });
  const [referralCode, setReferralCode] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors }, trigger } = useForm<MerchantFormData>({
    resolver: zodResolver(merchantSchema),
  });

  // Watch for address changes
  useEffect(() => {
    if (selectedProvince) {
      setCities(getCitiesByProvince(selectedProvince));
      setSelectedCity('');
      setSelectedDistrict('');
      setSelectedSubdistrict('');
      setValue('city', '');
      setValue('district', '');
      setValue('subdistrict', '');
    }
  }, [selectedProvince, setValue]);

  useEffect(() => {
    if (selectedCity) {
      setDistrictsList(getDistrictsByCity(selectedCity));
      setSelectedDistrict('');
      setSelectedSubdistrict('');
      setValue('district', '');
      setValue('subdistrict', '');
    }
  }, [selectedCity, setValue]);

  useEffect(() => {
    if (selectedDistrict) {
      setSubdistrictsList(getSubdistrictsByDistrict(selectedDistrict));
      setSelectedSubdistrict('');
      setValue('subdistrict', '');
    }
  }, [selectedDistrict, setValue]);

  // Check for matching village when subdistrict changes
  useEffect(() => {
    async function checkVillageMatch() {
      if (!selectedSubdistrict) {
        setMatchedVillage(null);
        return;
      }

      setVillageLoading(true);
      try {
        const subdistrictName = subdistrictsList.find(s => s.id === selectedSubdistrict)?.name || '';
        
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

  // Validate referral code
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

      // Check max usage
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

  // Debounced referral validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (referralCode) {
        validateReferralCode(referralCode);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [referralCode]);

  const onSubmit = async (data: MerchantFormData) => {
    if (!referralInfo.isValid) {
      toast.error('Kode referral tidak valid');
      return;
    }

    setIsSubmitting(true);
    try {
      const provinceName = provinces.find(p => p.id === data.province)?.name || '';
      const cityName = cities.find(c => c.id === data.city)?.name || '';
      const districtName = districtsList.find(d => d.id === data.district)?.name || '';
      const subdistrictName = subdistrictsList.find(s => s.id === data.subdistrict)?.name || '';

      const { error } = await supabase.from('merchants').insert({
        name: data.name.trim(),
        village_id: matchedVillage?.id || null,
        address: data.addressDetail.trim(),
        province: provinceName,
        city: cityName,
        district: districtName,
        subdistrict: subdistrictName,
        phone: data.phone.trim(),
        open_time: data.openTime,
        close_time: data.closeTime,
        classification_price: data.classificationPrice,
        business_category: data.businessCategory,
        business_description: data.businessDescription?.trim() || null,
        verifikator_code: data.referralCode.toUpperCase(),
        trade_group: referralInfo.tradeGroup,
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

  const nextStep = async () => {
    let fieldsToValidate: (keyof MerchantFormData)[] = [];
    
    if (currentStep === 1) {
      fieldsToValidate = ['referralCode'];
      if (!referralInfo.isValid) {
        toast.error('Masukkan kode referral yang valid');
        return;
      }
    } else if (currentStep === 2) {
      fieldsToValidate = ['name', 'businessCategory'];
    } else if (currentStep === 3) {
      fieldsToValidate = ['province', 'city', 'district', 'subdistrict', 'addressDetail', 'phone'];
    }
    
    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  if (isSuccess) {
    return (
      <div className="mobile-shell bg-background flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center max-w-sm"
          >
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              Pendaftaran Terkirim!
            </h1>
            <p className="text-muted-foreground text-sm mb-4">
              Pendaftaran usaha Anda sedang dalam proses verifikasi.
            </p>
            {referralInfo.tradeGroup && (
              <div className="bg-primary/10 rounded-xl p-4 mb-6">
                <p className="text-xs text-muted-foreground mb-1">Kelompok Dagang:</p>
                <p className="font-semibold text-foreground">{referralInfo.tradeGroup}</p>
              </div>
            )}
            <Button onClick={() => navigate('/')} className="w-full">
              Kembali ke Beranda
            </Button>
          </motion.div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-5 py-4">
          {/* Back button */}
          <button 
            onClick={() => currentStep > 1 ? prevStep() : navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground text-sm mb-4 hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" />
            {currentStep > 1 ? 'Langkah Sebelumnya' : 'Kembali'}
          </button>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                <Store className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Daftarkan Usaha</h1>
                <p className="text-xs text-muted-foreground">
                  Langkah {currentStep} dari 4
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div 
                  key={step}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    step <= currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </motion.div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Step 1: Referral Code */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-accent-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Kode Referral Verifikator</p>
                      <p className="text-xs text-muted-foreground">
                        Untuk mendaftar, Anda membutuhkan kode referral dari Verifikator. 
                        Kode ini menentukan kelompok dagang Anda.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="referralCode" className="text-sm font-medium">Kode Referral *</Label>
                  <div className="relative mt-2">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="referralCode"
                      placeholder="Masukkan kode referral"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className="pl-10 pr-10 uppercase"
                    />
                    {referralInfo.isLoading ? (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                      </div>
                    ) : referralInfo.isValid ? (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                    ) : referralCode.length >= 3 ? (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                    ) : null}
                  </div>
                  {errors.referralCode && (
                    <p className="text-destructive text-xs mt-1">{errors.referralCode.message}</p>
                  )}
                </div>

                {/* Referral info card */}
                {referralInfo.isValid && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/10 border border-primary/20 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-foreground">Kode Valid!</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Kelompok Dagang:</p>
                      <p className="text-sm font-semibold text-foreground">{referralInfo.tradeGroup}</p>
                      {referralInfo.description && (
                        <p className="text-xs text-muted-foreground mt-2">{referralInfo.description}</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {!referralInfo.isValid && referralCode.length >= 3 && !referralInfo.isLoading && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <p className="text-sm text-destructive">
                        {referralInfo.description || 'Kode referral tidak ditemukan atau sudah tidak aktif'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-muted/50 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground">
                    <strong>Belum punya kode?</strong> Hubungi admin atau verifikator di desa wisata terdekat untuk mendapatkan kode referral.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 2: Business Info */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <Store className="h-4 w-4 text-primary" />
                  Informasi Usaha
                </h2>

                <div>
                  <Label htmlFor="name" className="text-xs">Nama Usaha/Toko *</Label>
                  <Input
                    id="name"
                    placeholder="Contoh: Warung Bu Siti"
                    {...register('name')}
                    className="mt-1.5"
                  />
                  {errors.name && (
                    <p className="text-destructive text-xs mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs">Kategori Usaha *</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {businessCategories.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setValue('businessCategory', cat.value)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          watch('businessCategory') === cat.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-sm font-medium">{cat.label}</span>
                        {watch('businessCategory') === cat.value && (
                          <Check className="h-4 w-4 text-primary ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                  {errors.businessCategory && (
                    <p className="text-destructive text-xs mt-1">{errors.businessCategory.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="businessDescription" className="text-xs">Deskripsi Usaha (opsional)</Label>
                  <Textarea
                    id="businessDescription"
                    placeholder="Ceritakan tentang produk atau layanan yang Anda tawarkan..."
                    {...register('businessDescription')}
                    className="mt-1.5 min-h-[80px]"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 3: Address & Contact */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-primary" />
                  Alamat Lengkap
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Provinsi *</Label>
                    <Select 
                      onValueChange={(value) => {
                        setSelectedProvince(value);
                        setValue('province', value);
                      }}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Pilih provinsi" />
                      </SelectTrigger>
                      <SelectContent>
                        {provinces.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.province && (
                      <p className="text-destructive text-xs mt-1">{errors.province.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <Label className="text-xs">Kabupaten/Kota *</Label>
                    <Select 
                      onValueChange={(value) => {
                        setSelectedCity(value);
                        setValue('city', value);
                      }}
                      disabled={!selectedProvince}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder={selectedProvince ? "Pilih kabupaten/kota" : "Pilih provinsi dulu"} />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.city && (
                      <p className="text-destructive text-xs mt-1">{errors.city.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Kecamatan *</Label>
                    <Select 
                      onValueChange={(value) => {
                        setSelectedDistrict(value);
                        setValue('district', value);
                      }}
                      disabled={!selectedCity}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Pilih kecamatan" />
                      </SelectTrigger>
                      <SelectContent>
                        {districtsList.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.district && (
                      <p className="text-destructive text-xs mt-1">{errors.district.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Kelurahan/Desa *</Label>
                    <Select 
                      onValueChange={(value) => {
                        setSelectedSubdistrict(value);
                        setValue('subdistrict', value);
                      }}
                      disabled={!selectedDistrict}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Pilih kelurahan" />
                      </SelectTrigger>
                      <SelectContent>
                        {subdistrictsList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.subdistrict && (
                      <p className="text-destructive text-xs mt-1">{errors.subdistrict.message}</p>
                    )}
                  </div>
                </div>

                {/* Village match indicator */}
                {selectedSubdistrict && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl p-4 ${
                      villageLoading ? 'bg-muted' :
                      matchedVillage ? 'bg-primary/10 border border-primary/20' : 'bg-accent/10 border border-accent/20'
                    }`}
                  >
                    {villageLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                        <span className="text-sm text-muted-foreground">Mencari desa wisata...</span>
                      </div>
                    ) : matchedVillage ? (
                      <div className="flex items-start gap-3">
                        <Building className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Desa Wisata Terdeteksi:</p>
                          <p className="text-sm font-semibold text-foreground">{matchedVillage.name}</p>
                          <p className="text-xs text-muted-foreground">{matchedVillage.district}, {matchedVillage.regency}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-accent-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Belum Ada Desa Wisata</p>
                          <p className="text-xs text-muted-foreground">
                            Lokasi Anda belum terdaftar sebagai desa wisata. 
                            Anda tetap bisa mendaftar dan akan dihubungkan dengan desa wisata terdekat setelah verifikasi.
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                <div>
                  <Label htmlFor="addressDetail" className="text-xs">Alamat Detail *</Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="addressDetail"
                      placeholder="Jalan, nomor, RT/RW, patokan..."
                      {...register('addressDetail')}
                      className="pl-10 min-h-[70px]"
                    />
                  </div>
                  {errors.addressDetail && (
                    <p className="text-destructive text-xs mt-1">{errors.addressDetail.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone" className="text-xs">Nomor Telepon/WhatsApp *</Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      placeholder="08xxxxxxxxxx"
                      {...register('phone')}
                      className="pl-10"
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 4: Operating Hours & Price */}
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Jam Operasional
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Jam Buka *</Label>
                    <Select onValueChange={(value) => setValue('openTime', value)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Pilih jam" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.openTime && (
                      <p className="text-destructive text-xs mt-1">{errors.openTime.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Jam Tutup *</Label>
                    <Select onValueChange={(value) => setValue('closeTime', value)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Pilih jam" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.closeTime && (
                      <p className="text-destructive text-xs mt-1">{errors.closeTime.message}</p>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <h2 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Klasifikasi Harga
                  </h2>

                  <div className="space-y-2">
                    {priceClassifications.map((classification) => (
                      <button
                        key={classification.value}
                        type="button"
                        onClick={() => setValue('classificationPrice', classification.value)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          watch('classificationPrice') === classification.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <span className="text-xl">{classification.icon}</span>
                        <span className="text-sm font-medium">{classification.label}</span>
                        {watch('classificationPrice') === classification.value && (
                          <Check className="h-4 w-4 text-primary ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                  {errors.classificationPrice && (
                    <p className="text-destructive text-xs mt-1">{errors.classificationPrice.message}</p>
                  )}
                </div>

                {/* Summary Card */}
                <div className="bg-muted/50 rounded-xl p-4 mt-4">
                  <p className="text-sm font-medium text-foreground mb-3">Ringkasan Pendaftaran</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kelompok Dagang:</span>
                      <span className="font-medium">{referralInfo.tradeGroup}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Desa Wisata:</span>
                      <span className="font-medium">{matchedVillage?.name || 'Belum ada'}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-4">
              {currentStep > 1 && (
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={prevStep}
                  className="flex-1"
                >
                  Sebelumnya
                </Button>
              )}
              
              {currentStep < 4 ? (
                <Button 
                  type="button"
                  onClick={nextStep}
                  className="flex-1"
                  disabled={currentStep === 1 && !referralInfo.isValid}
                >
                  Lanjutkan
                </Button>
              ) : (
                <Button 
                  type="submit"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
                      Mengirim...
                    </>
                  ) : (
                    'Kirim Pendaftaran'
                  )}
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Dengan mendaftar, Anda menyetujui syarat dan ketentuan yang berlaku
            </p>
          </form>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
