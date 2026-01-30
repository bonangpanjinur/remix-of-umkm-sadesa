import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, User, Phone, Mail, ArrowLeft, CheckCircle, Building, MapPinned, FileText } from 'lucide-react';
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

const villageSchema = z.object({
  name: z.string().min(3, 'Nama desa minimal 3 karakter').max(100),
  province: z.string().min(1, 'Pilih provinsi'),
  regency: z.string().min(1, 'Pilih kabupaten/kota'),
  district: z.string().min(1, 'Pilih kecamatan'),
  subdistrict: z.string().min(1, 'Pilih kelurahan/desa'),
  description: z.string().min(20, 'Deskripsi minimal 20 karakter').max(500),
  contactName: z.string().min(3, 'Nama kontak minimal 3 karakter').max(100),
  contactPhone: z.string().min(10, 'Nomor telepon minimal 10 digit').max(15),
  contactEmail: z.string().email('Email tidak valid'),
});

type VillageFormData = z.infer<typeof villageSchema>;

export default function RegisterVillagePage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [provincesList, setProvincesList] = useState<Region[]>([]);
  const [regenciesList, setRegenciesList] = useState<Region[]>([]);
  const [districtsList, setDistrictsList] = useState<Region[]>([]);
  const [subdistrictsList, setSubdistrictsList] = useState<Region[]>([]);

  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedRegency, setSelectedRegency] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<VillageFormData>({
    resolver: zodResolver(villageSchema),
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
    const loadRegencies = async () => {
      if (selectedProvince) {
        try {
          const data = await fetchRegencies(selectedProvince);
          setRegenciesList(data);
          setSelectedRegency('');
          setSelectedDistrict('');
          setDistrictsList([]);
          setSubdistrictsList([]);
          setValue('regency', '');
          setValue('district', '');
          setValue('subdistrict', '');
        } catch (error) {
          console.error('Error loading regencies:', error);
        }
      }
    };
    loadRegencies();
  }, [selectedProvince, setValue]);

  useEffect(() => {
    const loadDistricts = async () => {
      if (selectedRegency) {
        try {
          const data = await fetchDistricts(selectedRegency);
          setDistrictsList(data);
          setSelectedDistrict('');
          setSubdistrictsList([]);
          setValue('district', '');
          setValue('subdistrict', '');
        } catch (error) {
          console.error('Error loading districts:', error);
        }
      }
    };
    loadDistricts();
  }, [selectedRegency, setValue]);

  useEffect(() => {
    const loadSubdistricts = async () => {
      if (selectedDistrict) {
        try {
          const data = await fetchVillages(selectedDistrict);
          setSubdistrictsList(data);
          setValue('subdistrict', '');
        } catch (error) {
          console.error('Error loading subdistricts:', error);
        }
      }
    };
    loadSubdistricts();
  }, [selectedDistrict, setValue]);

  const onSubmit = async (data: VillageFormData) => {
    setIsSubmitting(true);
    try {
      const provinceName = provincesList.find(p => p.code === data.province)?.name || '';
      const regencyName = regenciesList.find(r => r.code === data.regency)?.name || '';
      const districtName = districtsList.find(d => d.code === data.district)?.name || '';
      const subdistrictName = subdistrictsList.find(s => s.code === data.subdistrict)?.name || '';

      const { error } = await supabase.from('villages').insert({
        name: data.name.trim(),
        province: provinceName,
        regency: regencyName,
        district: districtName,
        subdistrict: subdistrictName,
        description: data.description.trim(),
        contact_name: data.contactName.trim(),
        contact_phone: data.contactPhone.trim(),
        contact_email: data.contactEmail.trim().toLowerCase(),
        registration_status: 'PENDING',
        is_active: false,
      });

      if (error) throw error;
      setIsSuccess(true);
      toast.success('Pendaftaran desa berhasil dikirim!');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Gagal mendaftar desa');
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
            Data desa wisata Anda telah kami terima dan sedang dalam proses verifikasi. 
            Kami akan menghubungi Anda melalui email atau nomor WhatsApp yang terdaftar.
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
      <PageHeader title="Daftar Desa Wisata" showBack onBack={() => navigate(-1)} />
      
      <main className="p-4 max-w-lg mx-auto">
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-foreground leading-tight">Daftarkan Desa</h1>
              <p className="text-xs text-muted-foreground">Lengkapi data desa wisata Anda</p>
            </div>
          </div>

          <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 mb-8">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Proses Verifikasi</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pendaftaran akan diverifikasi oleh Admin dalam 1-3 hari kerja. Pastikan data yang diisi valid.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Village Info Section */}
            <div className="space-y-5">
              <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Informasi Desa
              </h2>
              <div>
                <Label htmlFor="name" className="text-xs">Nama Desa Wisata *</Label>
                <Input id="name" placeholder="Contoh: Desa Wisata Sukamaju" {...register('name')} className="mt-1.5" />
                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="description" className="text-xs">Deskripsi Desa *</Label>
                <Textarea id="description" placeholder="Ceritakan tentang potensi wisata, budaya, dan keunikan desa Anda..." {...register('description')} className="mt-1.5 min-h-[100px]" />
                {errors.description && <p className="text-destructive text-xs mt-1">{errors.description.message}</p>}
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
                  <Select onValueChange={(v) => { setSelectedRegency(v); setValue('regency', v); }} disabled={!selectedProvince}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder={selectedProvince ? "Pilih kabupaten/kota" : "Pilih provinsi dulu"} /></SelectTrigger>
                    <SelectContent>{regenciesList.map((r) => <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.regency && <p className="text-destructive text-xs mt-1">{errors.regency.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Kecamatan *</Label>
                    <Select onValueChange={(v) => { setSelectedDistrict(v); setValue('district', v); }} disabled={!selectedRegency}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pilih kecamatan" /></SelectTrigger>
                      <SelectContent>{districtsList.map((d) => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.district && <p className="text-destructive text-xs mt-1">{errors.district.message}</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Kelurahan/Desa *</Label>
                    <Select onValueChange={(v) => setValue('subdistrict', v)} disabled={!selectedDistrict}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pilih kelurahan" /></SelectTrigger>
                      <SelectContent>{subdistrictsList.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.subdistrict && <p className="text-destructive text-xs mt-1">{errors.subdistrict.message}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Info Section */}
            <div className="space-y-5 pt-4 border-t border-border">
              <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Kontak Penanggung Jawab
              </h2>
              <div>
                <Label htmlFor="contactName" className="text-xs">Nama Lengkap *</Label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="contactName" placeholder="Nama penanggung jawab" {...register('contactName')} className="pl-10" />
                </div>
                {errors.contactName && <p className="text-destructive text-xs mt-1">{errors.contactName.message}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactPhone" className="text-xs">Nomor WhatsApp *</Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="contactPhone" placeholder="08xxxxxxxxxx" {...register('contactPhone')} className="pl-10" />
                  </div>
                  {errors.contactPhone && <p className="text-destructive text-xs mt-1">{errors.contactPhone.message}</p>}
                </div>
                <div>
                  <Label htmlFor="contactEmail" className="text-xs">Email *</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="contactEmail" type="email" placeholder="email@contoh.com" {...register('contactEmail')} className="pl-10" />
                  </div>
                  {errors.contactEmail && <p className="text-destructive text-xs mt-1">{errors.contactEmail.message}</p>}
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full rounded-xl py-6 mt-4" disabled={isSubmitting}>
              {isSubmitting ? <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /><span>Mengirim...</span></div> : 'Kirim Pendaftaran'}
            </Button>
          </form>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
