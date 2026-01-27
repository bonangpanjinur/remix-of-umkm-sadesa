import { useState, useEffect } from 'react';
import { Save, Store, Clock, MapPin, Phone, FileText, Loader2 } from 'lucide-react';
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
  { value: '$', label: 'Murah ($)' },
  { value: '$$', label: 'Sedang ($$)' },
  { value: '$$$', label: 'Mahal ($$$)' },
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
  });
  const [imageUrl, setImageUrl] = useState<string | null>(null);

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
          });
          setImageUrl(data.image_url);
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
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">No. Telepon</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_category">Kategori Bisnis</Label>
                <Select 
                  value={formData.business_category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, business_category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_description">Deskripsi Toko</Label>
              <Textarea
                id="business_description"
                name="business_description"
                value={formData.business_description}
                onChange={handleChange}
                rows={3}
                placeholder="Ceritakan tentang toko Anda..."
              />
            </div>
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
              <Textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                placeholder="Jalan, RT/RW, Desa..."
              />
            </div>
          </CardContent>
        </Card>

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
                <Input
                  id="open_time"
                  name="open_time"
                  type="time"
                  value={formData.open_time}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="close_time">Jam Tutup</Label>
                <Input
                  id="close_time"
                  name="close_time"
                  type="time"
                  value={formData.close_time}
                  onChange={handleChange}
                />
              </div>
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
                <SelectTrigger>
                  <SelectValue placeholder="Pilih klasifikasi" />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_CLASSIFICATIONS.map((cls) => (
                    <SelectItem key={cls.value} value={cls.value}>
                      {cls.label}
                    </SelectItem>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN_ASSISTED">
                    <div>
                      <p className="font-medium">Dibantu Admin</p>
                      <p className="text-xs text-muted-foreground">Pesanan diproses melalui admin pusat</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="SELF_MANAGED">
                    <div>
                      <p className="font-medium">Kelola Sendiri</p>
                      <p className="text-xs text-muted-foreground">Pesanan langsung masuk ke dashboard Anda</p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Simpan Pengaturan
            </>
          )}
        </Button>
      </form>
    </MerchantLayout>
  );
}