import { useState } from 'react';
import { MapPin, Camera, Globe, Phone, Mail, Instagram, Facebook, QrCode, Download, Plus, X } from 'lucide-react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface VillageProfile {
  id: string;
  name: string;
  description: string | null;
  district: string | null;
  regency: string | null;
  province: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  image_url: string | null;
  gallery_urls: string[];
  social_media: Record<string, string>;
  website: string | null;
  location_lat: number | null;
  location_lng: number | null;
  qr_code_url: string | null;
}

export default function DesaProfilPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [form, setForm] = useState<Partial<VillageProfile>>({});
  const [initDone, setInitDone] = useState(false);

  const { data: village, isLoading } = useQuery<VillageProfile | null>({
    queryKey: ['desa-profil', user?.id],
    queryFn: async () => {
      const { data: uv } = await supabase
        .from('user_villages')
        .select('village_id')
        .eq('user_id', user!.id)
        .maybeSingle();
      const vid = uv?.village_id;
      if (!vid) return null;

      const { data } = await supabase
        .from('villages')
        .select('*')
        .eq('id', vid)
        .maybeSingle();
      return data as unknown as VillageProfile | null;
    },
    enabled: !!user,
    onSuccess: (data) => {
      if (data && !initDone) {
        setForm({
          name: data.name || '',
          description: data.description || '',
          district: data.district || '',
          regency: data.regency || '',
          province: data.province || '',
          contact_name: data.contact_name || '',
          contact_phone: data.contact_phone || '',
          contact_email: data.contact_email || '',
          website: data.website || '',
          image_url: data.image_url || null,
          gallery_urls: data.gallery_urls || [],
          social_media: data.social_media || {},
          location_lat: data.location_lat || null,
          location_lng: data.location_lng || null,
        });
        setInitDone(true);
      }
    },
  } as any);

  const updateField = (key: keyof VillageProfile, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateSocial = (platform: string, value: string) => {
    setForm(prev => ({ ...prev, social_media: { ...(prev.social_media || {}), [platform]: value } }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !village) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Maks 5MB'); return; }
    setUploadingImg(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `villages/${village.id}/cover-${Date.now()}.${ext}`;
      await supabase.storage.from('merchant-gallery').upload(path, file, { upsert: true });
      const { data: urlData } = supabase.storage.from('merchant-gallery').getPublicUrl(path);
      updateField('image_url', urlData?.publicUrl || path);
      toast.success('Foto utama diperbarui');
    } catch { toast.error('Gagal upload foto'); }
    finally { setUploadingImg(false); }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !village) return;
    const current = form.gallery_urls || [];
    if (current.length + files.length > 8) { toast.error('Maks 8 foto galeri'); return; }
    setUploadingGallery(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) continue;
        const ext = file.name.split('.').pop();
        const path = `villages/${village.id}/gallery-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        await supabase.storage.from('merchant-gallery').upload(path, file);
        const { data: urlData } = supabase.storage.from('merchant-gallery').getPublicUrl(path);
        uploaded.push(urlData?.publicUrl || path);
      }
      updateField('gallery_urls', [...current, ...uploaded]);
      toast.success(`${uploaded.length} foto galeri ditambahkan`);
    } catch { toast.error('Gagal upload galeri'); }
    finally { setUploadingGallery(false); }
  };

  const removeGalleryPhoto = (idx: number) => {
    const arr = [...(form.gallery_urls || [])];
    arr.splice(idx, 1);
    updateField('gallery_urls', arr);
  };

  const handleGenerateQR = async () => {
    if (!village) return;
    const url = `${window.location.origin}/desa/${village.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
    updateField('qr_code_url', qrUrl);
    toast.success('QR Code desa berhasil dibuat');
  };

  const handleSave = async () => {
    if (!village) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('villages').update({
        name: form.name,
        description: form.description,
        district: form.district,
        regency: form.regency,
        province: form.province,
        contact_name: form.contact_name,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
        website: form.website,
        image_url: form.image_url,
        gallery_urls: form.gallery_urls,
        social_media: form.social_media,
        location_lat: form.location_lat,
        location_lng: form.location_lng,
        qr_code_url: form.qr_code_url,
      }).eq('id', village.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['desa-profil'] });
      toast.success('Profil desa berhasil disimpan!');
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DesaLayout title="Profil Desa" subtitle="Edit informasi publik desa">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </DesaLayout>
    );
  }

  return (
    <DesaLayout title="Profil Desa" subtitle="Kelola informasi publik yang tampil di halaman desa">
      <div className="space-y-6 max-w-3xl">
        {/* Foto Utama */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-5 w-5" /> Foto Utama Desa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.image_url && (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border">
                <img src={form.image_url} alt="Cover desa" className="w-full h-full object-cover" />
                <button
                  onClick={() => updateField('image_url', null)}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <Button variant="outline" size="sm" asChild disabled={uploadingImg}>
                <span>
                  <Camera className="h-4 w-4 mr-2" />
                  {uploadingImg ? 'Mengupload...' : 'Upload Foto Cover'}
                </span>
              </Button>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </CardContent>
        </Card>

        {/* Informasi Dasar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Dasar</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Nama Desa *</Label>
              <Input value={form.name || ''} onChange={e => updateField('name', e.target.value)} placeholder="Nama desa" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Deskripsi / Tagline Desa</Label>
              <Textarea value={form.description || ''} onChange={e => updateField('description', e.target.value)} placeholder="Ceritakan keunikan desa Anda..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Kecamatan</Label>
              <Input value={form.district || ''} onChange={e => updateField('district', e.target.value)} placeholder="Kecamatan" />
            </div>
            <div className="space-y-2">
              <Label>Kabupaten/Kota</Label>
              <Input value={form.regency || ''} onChange={e => updateField('regency', e.target.value)} placeholder="Kabupaten/Kota" />
            </div>
            <div className="space-y-2">
              <Label>Provinsi</Label>
              <Input value={form.province || ''} onChange={e => updateField('province', e.target.value)} placeholder="Provinsi" />
            </div>
          </CardContent>
        </Card>

        {/* Kontak */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-5 w-5" /> Kontak & Website
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nama Narahubung</Label>
              <Input value={form.contact_name || ''} onChange={e => updateField('contact_name', e.target.value)} placeholder="Nama penanggung jawab" />
            </div>
            <div className="space-y-2">
              <Label>No. HP / WhatsApp</Label>
              <Input value={form.contact_phone || ''} onChange={e => updateField('contact_phone', e.target.value)} placeholder="08xxxxxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.contact_email || ''} onChange={e => updateField('contact_email', e.target.value)} placeholder="desa@email.com" type="email" />
            </div>
            <div className="space-y-2">
              <Label>Website Desa</Label>
              <Input value={form.website || ''} onChange={e => updateField('website', e.target.value)} placeholder="https://desa..." />
            </div>
          </CardContent>
        </Card>

        {/* Media Sosial */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-5 w-5" /> Media Sosial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'instagram', label: 'Instagram', placeholder: '@desa_anda' },
              { key: 'facebook', label: 'Facebook', placeholder: 'Nama halaman Facebook' },
              { key: 'youtube', label: 'YouTube', placeholder: 'Channel YouTube' },
              { key: 'tiktok', label: 'TikTok', placeholder: '@desa_anda' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="flex items-center gap-3">
                <Label className="w-24 flex-shrink-0">{label}</Label>
                <Input
                  value={(form.social_media || {})[key] || ''}
                  onChange={e => updateSocial(key, e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Galeri */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-5 w-5" /> Galeri Foto Desa
              <span className="text-xs text-muted-foreground font-normal ml-auto">{(form.gallery_urls || []).length}/8 foto</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {(form.gallery_urls || []).map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border group">
                  <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeGalleryPhoto(i)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {(form.gallery_urls || []).length < 8 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                  {uploadingGallery ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                  ) : (
                    <>
                      <Plus className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Tambah</span>
                    </>
                  )}
                  <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} className="hidden" />
                </label>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Koordinat */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-5 w-5" /> Koordinat Desa
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Latitude</Label>
              <Input
                type="number"
                step="0.000001"
                value={form.location_lat || ''}
                onChange={e => updateField('location_lat', parseFloat(e.target.value) || null)}
                placeholder="-7.123456"
              />
            </div>
            <div className="space-y-2">
              <Label>Longitude</Label>
              <Input
                type="number"
                step="0.000001"
                value={form.location_lng || ''}
                onChange={e => updateField('location_lng', parseFloat(e.target.value) || null)}
                placeholder="110.123456"
              />
            </div>
          </CardContent>
        </Card>

        {/* QR Code */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-5 w-5" /> QR Code Promosi Offline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.qr_code_url ? (
              <div className="flex items-center gap-4">
                <img src={form.qr_code_url} alt="QR Code Desa" className="w-32 h-32 rounded-lg border" />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">QR Code mengarah ke halaman publik desa Anda</p>
                  <Button variant="outline" size="sm" asChild>
                    <a href={form.qr_code_url} download="qr-desa.png" target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4 mr-2" /> Download QR Code
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={handleGenerateQR}>
                <QrCode className="h-4 w-4 mr-2" /> Generate QR Code Desa
              </Button>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
          {saving ? 'Menyimpan...' : 'Simpan Profil Desa'}
        </Button>
      </div>
    </DesaLayout>
  );
}
