import { useState, useEffect } from 'react';
import { Save, Store, Clock, MapPin, Phone, FileText, Loader2, CreditCard, QrCode, Bell, Shield, CheckCircle2, Upload, Link as LinkIcon } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MerchantData {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  business_category: string | null;
  business_description: string | null;
  open_time: string | null;
  close_time: string | null;
  is_open: boolean;
  image_url: string | null;
  order_mode: string;
  classification_price: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  qris_image_url: string | null;
  payment_cod_enabled: boolean | null;
  payment_transfer_enabled: boolean | null;
  notification_sound_enabled: boolean | null;
  halal_status: string | null;
  halal_certificate_url: string | null;
  ktp_url: string | null;
  verifikator_code: string | null;
  slug: string | null;
}

const BUSINESS_CATEGORIES = [
  { value: 'kuliner', label: 'Kuliner' },
  { value: 'fashion', label: 'Fashion & Pakaian' },
  { value: 'kriya', label: 'Kriya & Kerajinan' },
  { value: 'pertanian', label: 'Pertanian & Perkebunan' },
  { value: 'jasa', label: 'Jasa' },
  { value: 'lainnya', label: 'Lainnya' },
];

const PRICE_CLASSIFICATIONS = [
  { value: 'UNDER_5K', label: 'Sangat Murah (< Rp 5.000)' },
  { value: 'FROM_5K_TO_10K', label: 'Murah (Rp 5.000 - Rp 10.000)' },
  { value: 'FROM_10K_TO_20K', label: 'Sedang (Rp 10.000 - Rp 20.000)' },
  { value: 'ABOVE_20K', label: 'Premium (> Rp 20.000)' },
];

export default function MerchantSettingsPage() {
  const { user } = useAuth();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    business_category: '',
    business_description: '',
    open_time: '08:00',
    close_time: '17:00',
    classification_price: '',
    order_mode: 'ADMIN_ASSISTED',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: '',
    payment_cod_enabled: true,
    payment_transfer_enabled: true,
    notification_sound_enabled: true,
    verifikator_code: '',
    slug: '',
  });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [qrisImageUrl, setQrisImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchMerchant = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('merchants')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setMerchant(data);
          setFormData({
            name: data.name || '',
            phone: data.phone || '',
            address: data.address || '',
            business_category: data.business_category || '',
            business_description: data.business_description || '',
            open_time: data.open_time || '08:00',
            close_time: data.close_time || '17:00',
            classification_price: data.classification_price || '',
            order_mode: data.order_mode || 'ADMIN_ASSISTED',
            bank_name: data.bank_name || '',
            bank_account_number: data.bank_account_number || '',
            bank_account_name: data.bank_account_name || '',
            payment_cod_enabled: data.payment_cod_enabled ?? true,
            payment_transfer_enabled: data.payment_transfer_enabled ?? true,
            notification_sound_enabled: data.notification_sound_enabled ?? true,
            verifikator_code: data.verifikator_code || '',
            slug: data.slug || '',
          });
          setImageUrl(data.image_url);
          setQrisImageUrl(data.qris_image_url);
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Gagal memuat data toko');
      } finally {
        setLoading(false);
      }
    };

    fetchMerchant();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('merchants')
        .update({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          business_category: formData.business_category,
          business_description: formData.business_description,
          open_time: formData.open_time,
          close_time: formData.close_time,
          classification_price: formData.classification_price,
          order_mode: formData.order_mode,
          image_url: imageUrl,
          bank_name: formData.bank_name || null,
          bank_account_number: formData.bank_account_number || null,
          bank_account_name: formData.bank_account_name || null,
          qris_image_url: qrisImageUrl,
          payment_cod_enabled: formData.payment_cod_enabled,
          payment_transfer_enabled: formData.payment_transfer_enabled,
          notification_sound_enabled: formData.notification_sound_enabled,
          verifikator_code: formData.verifikator_code || null,
          slug: formData.slug || null,
        })
        .eq('id', merchant.id);

      if (error) throw error;
      
      toast.success('Pengaturan toko berhasil disimpan');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MerchantLayout title="Pengaturan Toko" subtitle="Kelola informasi toko Anda">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  if (!merchant) {
    return (
      <MerchantLayout title="Pengaturan Toko" subtitle="Kelola informasi toko Anda">
        <div className="text-center py-20">
          <p className="text-muted-foreground">Toko tidak ditemukan</p>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Pengaturan Toko" subtitle="Kelola informasi toko Anda">
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Store Image */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-5 w-5" />
              Foto Toko
            </CardTitle>
            <CardDescription>Foto utama yang ditampilkan di halaman toko</CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              bucket="merchant-images"
              path={merchant.id}
            />
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informasi Dasar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Toko</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">No. Telepon</Label>
                <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_category">Kategori Bisnis</Label>
                <Select 
                  value={formData.business_category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, business_category: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {BUSINESS_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_description">Deskripsi Toko</Label>
              <Textarea id="business_description" name="business_description" value={formData.business_description} onChange={handleChange} rows={3} placeholder="Ceritakan tentang toko Anda..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="verifikator_code">Kode Verifikator</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="verifikator_code"
                  name="verifikator_code"
                  value={formData.verifikator_code}
                  onChange={handleChange}
                  className="pl-9 uppercase"
                  placeholder="Kode Verifikator"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Kode verifikator yang terhubung dengan akun Anda.</p>
            </div>
          </CardContent>
        </Card>

        {/* Custom Store Link */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Link Toko
            </CardTitle>
            <CardDescription>URL unik untuk membagikan toko Anda</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug Toko</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">{window.location.origin}/s/</span>
                <Input
                  id="slug"
                  name="slug"
                  value={formData.slug}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    setFormData(prev => ({ ...prev, slug: val }));
                  }}
                  placeholder="nama-toko"
                  className="font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Hanya huruf kecil, angka, dan strip (-). Contoh: kedai-maju</p>
            </div>
            {formData.slug && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-xs text-primary font-medium">Link toko Anda:</p>
                <p className="text-sm font-mono text-foreground mt-1">{window.location.origin}/s/{formData.slug}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Lokasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="address">Alamat Lengkap</Label>
              <Textarea id="address" name="address" value={formData.address} onChange={handleChange} rows={2} placeholder="Jalan, RT/RW, Desa..." />
            </div>
          </CardContent>
        </Card>

        {/* Halal Certification */}
        {formData.business_category === 'kuliner' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sertifikasi Halal
              </CardTitle>
              <CardDescription>Status kehalalan usaha kuliner Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium">Status Saat Ini:</div>
                <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                  merchant.halal_status === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                  merchant.halal_status === 'PENDING_VERIFICATION' ? 'bg-yellow-100 text-yellow-700' :
                  merchant.halal_status === 'REQUESTED' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {merchant.halal_status === 'VERIFIED' ? 'TERVERIFIKASI' :
                   merchant.halal_status === 'PENDING_VERIFICATION' ? 'MENUNGGU VERIFIKASI' :
                   merchant.halal_status === 'REQUESTED' ? 'PENGAJUAN BARU' :
                   'BELUM ADA'}
                </div>
              </div>

              {merchant.halal_certificate_url && (
                <div className="space-y-2">
                  <Label>Sertifikat Halal</Label>
                  <div className="relative aspect-video rounded-lg overflow-hidden border">
                    <img src={merchant.halal_certificate_url} alt="Sertifikat Halal" className="object-cover w-full h-full" />
                  </div>
                </div>
              )}

              {merchant.halal_status === 'NONE' && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-primary">Tingkatkan Kepercayaan Pelanggan!</p>
                    <p className="text-muted-foreground">Ajukan sertifikasi halal gratis melalui admin atau unggah sertifikat jika sudah punya.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Operating Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Jam Operasional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="open_time">Jam Buka</Label>
                <Input id="open_time" name="open_time" type="time" value={formData.open_time} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="close_time">Jam Tutup</Label>
                <Input id="close_time" name="close_time" type="time" value={formData.close_time} onChange={handleChange} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pengaturan Pembayaran
            </CardTitle>
            <CardDescription>Kelola rekening bank dan QRIS untuk menerima pembayaran</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">COD (Bayar di Tempat)</p>
                  <p className="text-xs text-muted-foreground">Terima pembayaran tunai saat pengiriman</p>
                </div>
                <Switch
                  checked={formData.payment_cod_enabled}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, payment_cod_enabled: v }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Transfer Bank & QRIS</p>
                  <p className="text-xs text-muted-foreground">Terima pembayaran via transfer dan QRIS</p>
                </div>
                <Switch
                  checked={formData.payment_transfer_enabled}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, payment_transfer_enabled: v }))}
                />
              </div>
            </div>

            {/* Bank Account Info */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Rekening Bank
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Bank</Label>
                  <Input 
                    name="bank_name" 
                    value={formData.bank_name} 
                    onChange={handleChange}
                    placeholder="Contoh: BRI, BCA, Mandiri" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nomor Rekening</Label>
                  <Input 
                    name="bank_account_number" 
                    value={formData.bank_account_number} 
                    onChange={handleChange}
                    placeholder="Nomor rekening" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Atas Nama</Label>
                <Input 
                  name="bank_account_name" 
                  value={formData.bank_account_name} 
                  onChange={handleChange}
                  placeholder="Nama pemilik rekening" 
                />
              </div>
              {!formData.bank_name && !formData.bank_account_number && (
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  💡 Jika tidak diisi, akan menggunakan rekening admin sebagai default
                </p>
              )}
            </div>

            {/* QRIS */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                QRIS
              </h4>
              <ImageUpload
                value={qrisImageUrl}
                onChange={setQrisImageUrl}
                bucket="merchant-images"
                path={`qris/${merchant.id}`}
                placeholder="Upload gambar QRIS"
              />
              {!qrisImageUrl && (
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  💡 Jika tidak diisi, akan menggunakan QRIS admin sebagai default
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifikasi
            </CardTitle>
            <CardDescription>Atur suara notifikasi pesanan masuk</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Suara Notifikasi Pesanan Baru</p>
                <p className="text-xs text-muted-foreground">Bunyikan suara saat pesanan baru masuk</p>
              </div>
              <Switch
                checked={formData.notification_sound_enabled}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, notification_sound_enabled: v }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Order */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pengaturan Harga & Pesanan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Klasifikasi Harga</Label>
              <Select 
                value={formData.classification_price} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, classification_price: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Pilih klasifikasi" /></SelectTrigger>
                <SelectContent>
                  {PRICE_CLASSIFICATIONS.map((cls) => (
                    <SelectItem key={cls.value} value={cls.value}>{cls.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mode Pesanan</Label>
              <Select 
                value={formData.order_mode} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, order_mode: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN_ASSISTED">Dibantu Admin</SelectItem>
                  <SelectItem value="SELF_MANAGED">Kelola Sendiri</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
          ) : (
            <><Save className="h-4 w-4 mr-2" />Simpan Pengaturan</>
          )}
        </Button>
      </form>
    </MerchantLayout>
  );
}
