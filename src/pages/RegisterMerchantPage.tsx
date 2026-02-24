import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Store, Phone, MapPin, ArrowLeft, CheckCircle, Clock, 
  Tag, FileText, Building, Shield, AlertCircle, Check, Mail, Loader2, ShieldCheck, RefreshCw, Save, Trash2
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
import { AddressDropdowns } from '../components/admin/AddressDropdowns';
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

const DRAFT_KEY = 'merchant_registration_draft';

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

interface DraftData {
  referralCode: string;
  name: string;
  businessCategory: string;
  businessDescription: string;
  phone: string;
  openTime: string;
  closeTime: string;
  addressDetail: string;
  selectedProvince: string;
  selectedCity: string;
  selectedDistrict: string;
  selectedSubdistrict: string;
  merchantLocation: { lat: number; lng: number } | null;
  halalStatus: string;
  halalCertUrl?: string;
  ktpUrl?: string;
}

export default function RegisterMerchantPage() {
  const navigate = useNavigate();
  const { user, refetchRoles } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const draftRestoredRef = useRef(false);
  const saveDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [addressData, setAddressData] = useState({
    provinceCode: '',
    provinceName: '',
    regencyCode: '',
    regencyName: '',
    districtCode: '',
    districtName: '',
    villageCode: '',
    villageName: '',
  });
  
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

  const { register, handleSubmit, setValue, watch, getValues, trigger, formState: { errors } } = useForm<MerchantFormData>({
    resolver: zodResolver(merchantSchema),
  });

  // === DRAFT: Save ===
  const saveDraft = useCallback(() => {
    const values = getValues();
    const draft: DraftData = {
      referralCode,
      name: values.name || '',
      businessCategory: values.businessCategory || '',
      businessDescription: values.businessDescription || '',
      phone: values.phone || '',
      openTime: values.openTime || '',
      closeTime: values.closeTime || '',
      addressDetail: values.addressDetail || '',
      selectedProvince: addressData.provinceCode,
      selectedCity: addressData.regencyCode,
      selectedDistrict: addressData.districtCode,
      selectedSubdistrict: addressData.villageCode,
      merchantLocation,
      halalStatus,
      halalCertUrl,
      ktpUrl,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setHasDraft(true);
    } catch {}
  }, [getValues, referralCode, addressData, merchantLocation, halalStatus, halalCertUrl, ktpUrl]);

  // Debounced auto-save
  const scheduleSaveDraft = useCallback(() => {
    if (saveDraftTimerRef.current) clearTimeout(saveDraftTimerRef.current);
    saveDraftTimerRef.current = setTimeout(() => saveDraft(), 500);
  }, [saveDraft]);

  // Watch all form fields for auto-save
  const watchedFields = watch();
  useEffect(() => {
    if (draftRestoredRef.current) {
      scheduleSaveDraft();
    }
  }, [watchedFields, referralCode, addressData, merchantLocation, halalStatus, halalCertUrl, ktpUrl, scheduleSaveDraft]);

  // === DRAFT: Restore on mount ===
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        draftRestoredRef.current = true;
        return;
      }
      const draft: DraftData = JSON.parse(raw);
      setHasDraft(true);

      // Restore simple fields
      if (draft.name) setValue('name', draft.name);
      if (draft.businessCategory) setValue('businessCategory', draft.businessCategory);
      if (draft.businessDescription) setValue('businessDescription', draft.businessDescription);
      if (draft.phone) setValue('phone', draft.phone);
      if (draft.openTime) setValue('openTime', draft.openTime);
      if (draft.closeTime) setValue('closeTime', draft.closeTime);
      if (draft.addressDetail) setValue('addressDetail', draft.addressDetail);
      if (draft.referralCode) setReferralCode(draft.referralCode);
      if (draft.merchantLocation) setMerchantLocation(draft.merchantLocation);
      if (draft.halalStatus) setHalalStatus(draft.halalStatus as any);
      if (draft.halalCertUrl) setHalalCertUrl(draft.halalCertUrl);
      if (draft.ktpUrl) setKtpUrl(draft.ktpUrl);

      // Restore address chain
      setAddressData({
        provinceCode: draft.selectedProvince || '',
        provinceName: '', // Will be updated by dropdown component
        regencyCode: draft.selectedCity || '',
        regencyName: '',
        districtCode: draft.selectedDistrict || '',
        districtName: '',
        villageCode: draft.selectedSubdistrict || '',
        villageName: '',
      });
      if (draft.selectedProvince) setValue('province', draft.selectedProvince);
      if (draft.selectedCity) setValue('city', draft.selectedCity);
      if (draft.selectedDistrict) setValue('district', draft.selectedDistrict);
      if (draft.selectedSubdistrict) setValue('subdistrict', draft.selectedSubdistrict);

      toast.info('Draft formulir dipulihkan');
    } catch {
      console.warn('Failed to restore draft');
    }
    draftRestoredRef.current = true;
  }, [setValue]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
    toast.success('Draft dihapus');
  };

  // Check if selected subdistrict matches any village in our DB
  useEffect(() => {
    const checkVillageMatch = async () => {
      if (addressData.villageCode && addressData.villageName) {
        setVillageLoading(true);
        try {
          const { data, error } = await supabase
            .from('villages')
            .select('*')
            .eq('subdistrict', addressData.villageName)
            .eq('is_active', true)
            .maybeSingle();
          
          if (data) {
            setMatchedVillage(data as unknown as Village);
          } else {
            setMatchedVillage(null);
          }
        } catch (error) {
          console.error('Error checking village match:', error);
        } finally {
          setVillageLoading(false);
        }
      } else {
        setMatchedVillage(null);
      }
    };
    checkVillageMatch();
  }, [addressData.villageCode, addressData.villageName]);

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
      const provinceName = addressData.provinceName;
      const cityName = addressData.regencyName;
      const districtName = addressData.districtName;
      const subdistrictName = addressData.villageName;

      if (!user) {
        toast.error('Anda harus login untuk mendaftar');
        navigate('/auth');
        return;
      }

      // Auto-approve merchants on registration (direct ACC without admin approval)
      const isAutoApproveEnabled = true;
      const registrationStatus = 'APPROVED';
      const merchantStatus = 'ACTIVE';

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
        registration_status: registrationStatus,
        status: merchantStatus,
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

      // Role assignment is handled by database trigger (on_merchant_approval)
      // when registration_status is set to 'APPROVED'.
      // We just need to refetch roles to update the UI.
      if (user) {
        // Small delay to ensure trigger has finished
        setTimeout(async () => {
          await refetchRoles();
        }, 1000);
      }

      // Clear draft on success
      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
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
            Akun merchant Anda telah disetujui! Anda sekarang dapat mengakses dashboard dan mulai mengelola produk serta pesanan.
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
        {/* Draft banner */}
        {hasDraft && (
          <div className="bg-accent/50 border border-accent rounded-xl p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Save className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Draft tersimpan otomatis</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearDraft} className="text-xs h-7 gap-1">
              <Trash2 className="w-3 h-3" />
              Hapus Draft
            </Button>
          </div>
        )}

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
              <Label>Kategori Usaha</Label>
              <Select onValueChange={(val) => setValue('businessCategory', val)} value={watch('businessCategory') || undefined}>
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
                <Select onValueChange={(val) => setValue('openTime', val)} value={watch('openTime') || undefined}>
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
                <Select onValueChange={(val) => setValue('closeTime', val)} value={watch('closeTime') || undefined}>
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
              <AddressDropdowns
                provinceCode={addressData.provinceCode}
                provinceName={addressData.provinceName}
                regencyCode={addressData.regencyCode}
                regencyName={addressData.regencyName}
                districtCode={addressData.districtCode}
                districtName={addressData.districtName}
                villageCode={addressData.villageCode}
                villageName={addressData.villageName}
                onChange={(data) => {
                  setAddressData(data);
                  setValue('province', data.provinceCode);
                  setValue('city', data.regencyCode);
                  setValue('district', data.districtCode);
                  setValue('subdistrict', data.villageCode);
                  
                  // Trigger validation for these fields
                  trigger(['province', 'city', 'district', 'subdistrict']);
                }}
              />
              <div className="grid grid-cols-2 gap-4">
                {errors.province && <p className="text-xs text-destructive">{errors.province.message}</p>}
                {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
                {errors.district && <p className="text-xs text-destructive">{errors.district.message}</p>}
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
                Selamat! Akun merchant Anda telah disetujui dan siap digunakan.
              </p>
              <div className="bg-muted p-3 rounded-lg text-xs text-left space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-primary" />
                  <span className="font-semibold">Apa selanjutnya?</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Akses langsung ke Dashboard Merchant</li>
                  <li>Mulai tambahkan produk Anda</li>
                  <li>Terima pesanan dari pembeli</li>
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
