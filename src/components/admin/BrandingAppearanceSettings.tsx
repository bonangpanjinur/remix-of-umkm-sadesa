import { useState, useEffect } from 'react';
import { Save, Loader2, Image as ImageIcon, Palette, Globe, Type, Upload, CheckCircle2, Info, RefreshCw, Search, Plus, Edit2, Trash2, Eye, EyeOff, Share2, Layout, GripVertical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useWhitelabel } from '@/hooks/useWhitelabel';

interface PWASettings {
  appName: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  enableOffline: boolean;
  enableNotifications: boolean;
  enableInstallPrompt: boolean;
  installPromptDelay: number;
  showInstallBanner: boolean;
  icons: {
    src: string;
    sizes: string;
    type: string;
  }[];
}

interface SEOSetting {
  id: string;
  page_path: string;
  title: string | null;
  description: string | null;
  keywords: string | null;
  og_image: string | null;
  og_title: string | null;
  og_description: string | null;
  canonical_url: string | null;
  robots: string;
}

interface HomepageSection {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

interface HomepageLayoutSettings {
  sections: HomepageSection[];
  visible_categories: string[];
}

const DEFAULT_PWA_SETTINGS: PWASettings = {
  appName: 'DesaMart - Marketplace UMKM & Desa Wisata',
  shortName: 'DesaMart',
  description: 'Jelajahi produk UMKM asli desa dan destinasi wisata desa di Indonesia',
  themeColor: '#10b981',
  backgroundColor: '#ffffff',
  enableOffline: true,
  enableNotifications: true,
  enableInstallPrompt: true,
  installPromptDelay: 30,
  showInstallBanner: true,
  icons: [
    { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
  ],
};

const COMMON_PAGES = [
  { path: '/', label: 'Beranda' },
  { path: '/products', label: 'Produk' },
  { path: '/tourism', label: 'Wisata' },
  { path: '/explore', label: 'Explore' },
  { path: '/shops', label: 'Toko' },
  { path: '/search', label: 'Pencarian' },
  { path: '/auth', label: 'Login' },
];

const DEFAULT_HOMEPAGE_SECTIONS: HomepageSection[] = [
  { id: 'hero', name: 'Hero Banner', enabled: true, order: 0 },
  { id: 'categories', name: 'Kategori', enabled: true, order: 1 },
  { id: 'popular_tourism', name: 'Wisata Populer', enabled: true, order: 2 },
  { id: 'promo', name: 'Promo Spesial', enabled: true, order: 3 },
  { id: 'recommendations', name: 'Rekomendasi Pilihan', enabled: true, order: 4 },
  { id: 'villages', name: 'Jelajahi Desa', enabled: true, order: 5 },
];

// Categories are now loaded dynamically from the database

interface BrandingAppearanceSettingsProps {
  isSaving?: string | null;
  onSave?: (key: string, values: any) => Promise<void>;
}

export function BrandingAppearanceSettings({ isSaving: externalIsSaving, onSave }: BrandingAppearanceSettingsProps) {
  const { refetch: refetchWhitelabel } = useWhitelabel();
  
  // Whitelabel State
  const [siteName, setSiteName] = useState('DesaMart');
  const [siteTagline, setSiteTagline] = useState('EKOSISTEM UMKM');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  
  // PWA State
  const [pwaSettings, setPwaSettings] = useState<PWASettings>(DEFAULT_PWA_SETTINGS);
  const [uploading, setUploading] = useState<string | null>(null);
  
  // SEO State
  const [seoSettings, setSeoSettings] = useState<SEOSetting[]>([]);
  const [seoDialogOpen, setSeoDialogOpen] = useState(false);
  const [editingSeo, setEditingSeo] = useState<SEOSetting | null>(null);
  const [seoSearchTerm, setSeoSearchTerm] = useState('');
  const [seoFormData, setSeoFormData] = useState({
    page_path: '',
    title: '',
    description: '',
    keywords: '',
    og_image: '',
    og_title: '',
    og_description: '',
    canonical_url: '',
    robots: 'index, follow',
  });

  // Homepage Layout State
  const [homepageSections, setHomepageSections] = useState<HomepageSection[]>(DEFAULT_HOMEPAGE_SECTIONS);
  const [visibleCategories, setVisibleCategories] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<{id: string; name: string}[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Loading & Saving State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchAllSettings();
  }, []);

  const fetchAllSettings = async () => {
    setLoading(true);
    try {
      // Fetch Whitelabel
      const { data: whitelabelData } = await supabase
        .from('app_settings')
        .select('*')
        .eq('category', 'whitelabel');

      if (whitelabelData) {
        whitelabelData.forEach((item) => {
          if (item.key === 'site_name') setSiteName(String(item.value) || 'DesaMart');
          if (item.key === 'site_tagline') setSiteTagline(String(item.value) || 'EKOSISTEM UMKM');
          if (item.key === 'logo_url') setLogoUrl(item.value ? String(item.value) : null);
          if (item.key === 'favicon_url') setFaviconUrl(item.value ? String(item.value) : null);
        });
      }

      // Fetch PWA
      const { data: pwaData } = await supabase
        .from('app_settings')
        .select('*')
        .eq('category', 'pwa')
        .eq('key', 'pwa_config')
        .maybeSingle();

      if (pwaData && pwaData.value) {
        setPwaSettings({ ...DEFAULT_PWA_SETTINGS, ...(pwaData.value as any) });
      }

      // Fetch SEO
      const { data: seoData } = await supabase
        .from('seo_settings')
        .select('*')
        .order('page_path');
      setSeoSettings(seoData || []);

      // Fetch Homepage Layout and Dynamic Categories in parallel
      const [layoutRes, categoriesRes] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key', 'homepage_layout').maybeSingle(),
        supabase.from('categories').select('id, name, slug').eq('is_active', true).order('sort_order'),
      ]);

      const cats = (categoriesRes.data || []).map(c => ({ id: c.slug, name: c.name }));
      setAllCategories(cats);

      if (layoutRes.data?.value) {
        const settings = layoutRes.data.value as unknown as HomepageLayoutSettings;
        if (settings.sections) setHomepageSections(settings.sections.sort((a, b) => a.order - b.order));
        if (settings.visible_categories) {
          setVisibleCategories(settings.visible_categories);
        } else {
          setVisibleCategories(cats.map(c => c.id));
        }
      } else {
        setVisibleCategories(cats.map(c => c.id));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Gagal memuat beberapa pengaturan');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWhitelabel = async () => {
    setSaving('whitelabel');
    try {
      const saveSetting = async (key: string, value: string | null) => {
        const { data: existing } = await supabase
          .from('app_settings')
          .select('id')
          .eq('key', key)
          .eq('category', 'whitelabel')
          .maybeSingle();

        if (existing) {
          await supabase
            .from('app_settings')
            .update({ value: value as any, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('app_settings')
            .insert({
              key,
              value: value as any,
              category: 'whitelabel',
              description: `Whitelabel setting: ${key}`,
            });
        }
      };

      await Promise.all([
        saveSetting('site_name', siteName),
        saveSetting('site_tagline', siteTagline),
        saveSetting('logo_url', logoUrl),
        saveSetting('favicon_url', faviconUrl),
      ]);

      await refetchWhitelabel();
      toast.success('Pengaturan Whitelabel berhasil disimpan');
    } catch (error) {
      console.error('Error saving whitelabel:', error);
      toast.error('Gagal menyimpan pengaturan Whitelabel');
    } finally {
      setSaving(null);
    }
  };

  const handleSavePWA = async () => {
    setSaving('pwa');
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'pwa_config',
          category: 'pwa',
          value: pwaSettings as any,
          description: 'Progressive Web App configuration',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
      toast.success('Pengaturan PWA berhasil disimpan');
    } catch (error) {
      console.error('Error saving PWA:', error);
      toast.error('Gagal menyimpan pengaturan PWA');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveSeo = async () => {
    if (!seoFormData.page_path) {
      toast.error('Path halaman wajib diisi');
      return;
    }

    setSaving('seo');
    try {
      const seoData = {
        page_path: seoFormData.page_path,
        title: seoFormData.title || null,
        description: seoFormData.description || null,
        keywords: seoFormData.keywords || null,
        og_image: seoFormData.og_image || null,
        og_title: seoFormData.og_title || null,
        og_description: seoFormData.og_description || null,
        canonical_url: seoFormData.canonical_url || null,
        robots: seoFormData.robots,
      };

      if (editingSeo) {
        const { error } = await supabase
          .from('seo_settings')
          .update(seoData)
          .eq('id', editingSeo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('seo_settings')
          .insert(seoData);
        if (error) throw error;
      }

      await fetchAllSettings();
      setSeoDialogOpen(false);
      setEditingSeo(null);
      toast.success('Pengaturan SEO berhasil disimpan');
    } catch (error) {
      console.error('Error saving SEO:', error);
      toast.error('Gagal menyimpan pengaturan SEO');
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteSeo = async (id: string) => {
    if (!confirm('Yakin ingin menghapus pengaturan SEO ini?')) return;
    
    try {
      const { error } = await supabase.from('seo_settings').delete().eq('id', id);
      if (error) throw error;
      toast.success('Pengaturan SEO dihapus');
      fetchAllSettings();
    } catch (error) {
      toast.error('Gagal menghapus pengaturan SEO');
    }
  };

  const handleSaveHomepageLayout = async () => {
    setSaving('layout');
    try {
      const layoutSettings: HomepageLayoutSettings = {
        sections: homepageSections,
        visible_categories: visibleCategories,
      };

      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'homepage_layout',
          category: 'layout',
          value: layoutSettings as any,
          description: 'Homepage layout and sections configuration',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
      toast.success('Layout beranda berhasil disimpan');
    } catch (error) {
      console.error('Error saving layout:', error);
      toast.error('Gagal menyimpan layout beranda');
    } finally {
      setSaving(null);
    }
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    const updated = [...homepageSections];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    
    // Update order property
    const final = updated.map((s, i) => ({ ...s, order: i }));
    setHomepageSections(final);
  };

  const toggleSection = (id: string) => {
    setHomepageSections(prev => prev.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const toggleCategory = (id: string) => {
    setVisibleCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const filteredSeo = seoSettings.filter(s => 
    s.page_path.toLowerCase().includes(seoSearchTerm.toLowerCase()) ||
    s.title?.toLowerCase().includes(seoSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="whitelabel">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="whitelabel">Branding</TabsTrigger>
          <TabsTrigger value="pwa">PWA</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>

        <TabsContent value="whitelabel">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Branding & Whitelabel
              </CardTitle>
              <CardDescription>Sesuaikan identitas situs Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Situs</Label>
                  <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input value={siteTagline} onChange={(e) => setSiteTagline(e.target.value)} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <div className="flex gap-2">
                    <Input value={logoUrl || ''} onChange={(e) => setLogoUrl(e.target.value)} />
                    <ImageUpload bucket="merchant-images" path={`branding/logo-${Date.now()}`} value={logoUrl} onChange={(url) => setLogoUrl(url || '')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Favicon URL</Label>
                  <div className="flex gap-2">
                    <Input value={faviconUrl || ''} onChange={(e) => setFaviconUrl(e.target.value)} />
                    <ImageUpload bucket="merchant-images" path={`branding/favicon-${Date.now()}`} value={faviconUrl} onChange={(url) => setFaviconUrl(url || '')} />
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveWhitelabel} disabled={saving === 'whitelabel'} className="w-full">
                {saving === 'whitelabel' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Simpan Branding
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pwa">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Progressive Web App (PWA)
              </CardTitle>
              <CardDescription>Konfigurasi aplikasi agar dapat diinstal di HP/Desktop</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Aplikasi</Label>
                  <Input value={pwaSettings.appName} onChange={(e) => setPwaSettings({...pwaSettings, appName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Nama Pendek</Label>
                  <Input value={pwaSettings.shortName} onChange={(e) => setPwaSettings({...pwaSettings, shortName: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Deskripsi PWA</Label>
                <Textarea value={pwaSettings.description} onChange={(e) => setPwaSettings({...pwaSettings, description: e.target.value})} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Warna Tema (Hex)</Label>
                  <Input type="color" className="h-10" value={pwaSettings.themeColor} onChange={(e) => setPwaSettings({...pwaSettings, themeColor: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Warna Background (Hex)</Label>
                  <Input type="color" className="h-10" value={pwaSettings.backgroundColor} onChange={(e) => setPwaSettings({...pwaSettings, backgroundColor: e.target.value})} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Offline Mode</Label>
                    <p className="text-xs text-muted-foreground">Aktifkan akses saat tanpa internet</p>
                  </div>
                  <Switch checked={pwaSettings.enableOffline} onCheckedChange={(val) => setPwaSettings({...pwaSettings, enableOffline: val})} />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Install Prompt</Label>
                    <p className="text-xs text-muted-foreground">Tampilkan ajakan instal aplikasi</p>
                  </div>
                  <Switch checked={pwaSettings.enableInstallPrompt} onCheckedChange={(val) => setPwaSettings({...pwaSettings, enableInstallPrompt: val})} />
                </div>
              </div>
              <Button onClick={handleSavePWA} disabled={saving === 'pwa'} className="w-full">
                {saving === 'pwa' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Simpan Konfigurasi PWA
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  SEO & Meta Tags
                </CardTitle>
                <CardDescription>Optimalkan visibilitas di mesin pencari</CardDescription>
              </div>
              <Button onClick={() => { setEditingSeo(null); setSeoFormData({ page_path: '', title: '', description: '', keywords: '', og_image: '', og_title: '', og_description: '', canonical_url: '', robots: 'index, follow' }); setSeoDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Tambah SEO
              </Button>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari path atau judul..." className="pl-9" value={seoSearchTerm} onChange={(e) => setSeoSearchTerm(e.target.value)} />
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-medium">Path</th>
                      <th className="text-left p-3 font-medium">Judul Halaman</th>
                      <th className="text-right p-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredSeo.length > 0 ? filteredSeo.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                        <td className="p-3 font-mono text-xs">{item.page_path}</td>
                        <td className="p-3 truncate max-w-[200px]">{item.title || '-'}</td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingSeo(item); setSeoFormData({ ...item, title: item.title || '', description: item.description || '', keywords: item.keywords || '', og_image: item.og_image || '', og_title: item.og_title || '', og_description: item.og_description || '', canonical_url: item.canonical_url || '' }); setSeoDialogOpen(true); }}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteSeo(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Tidak ada pengaturan SEO ditemukan</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layout">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Layout Beranda
              </CardTitle>
              <CardDescription>Atur urutan dan visibilitas bagian di halaman depan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Urutan Bagian</Label>
                <div className="space-y-2">
                  {homepageSections.map((section, index) => (
                    <div 
                      key={section.id}
                      draggable
                      onDragStart={() => setDraggedIndex(index)}
                      onDragOver={(e) => { e.preventDefault(); if (draggedIndex !== null && draggedIndex !== index) moveSection(draggedIndex, index); setDraggedIndex(index); }}
                      onDragEnd={() => setDraggedIndex(null)}
                      className={`flex items-center justify-between p-3 border rounded-lg bg-card cursor-move ${draggedIndex === index ? 'opacity-50 border-primary' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{section.name}</span>
                      </div>
                      <Switch checked={section.enabled} onCheckedChange={() => toggleSection(section.id)} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Kategori yang Ditampilkan</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {allCategories.map(cat => (
                    <div key={cat.id} className="flex items-center space-x-2 p-2 border rounded-md">
                      <Checkbox id={cat.id} checked={visibleCategories.includes(cat.id)} onCheckedChange={() => toggleCategory(cat.id)} />
                      <Label htmlFor={cat.id} className="text-sm cursor-pointer">{cat.name}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleSaveHomepageLayout} disabled={saving === 'layout'} className="w-full">
                {saving === 'layout' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Simpan Layout
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={seoDialogOpen} onOpenChange={setSeoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSeo ? 'Edit SEO Settings' : 'Tambah SEO Settings'}</DialogTitle>
            <DialogDescription>Masukkan meta tags untuk path halaman spesifik</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Path Halaman</Label>
              <div className="col-span-3 space-y-1">
                <Input placeholder="/produk/nama-produk" value={seoFormData.page_path} onChange={(e) => setSeoFormData({...seoFormData, page_path: e.target.value})} />
                <p className="text-[10px] text-muted-foreground">Gunakan / untuk beranda</p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Judul (Title)</Label>
              <Input className="col-span-3" value={seoFormData.title} onChange={(e) => setSeoFormData({...seoFormData, title: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Deskripsi</Label>
              <Textarea className="col-span-3" value={seoFormData.description} onChange={(e) => setSeoFormData({...seoFormData, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Keywords</Label>
              <Input className="col-span-3" placeholder="umkm, desa wisata, produk lokal" value={seoFormData.keywords} onChange={(e) => setSeoFormData({...seoFormData, keywords: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Robots</Label>
              <Select value={seoFormData.robots} onValueChange={(val) => setSeoFormData({...seoFormData, robots: val})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="index, follow">Index, Follow (Default)</SelectItem>
                  <SelectItem value="noindex, nofollow">No Index, No Follow</SelectItem>
                  <SelectItem value="index, nofollow">Index, No Follow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-4 mt-2">
              <h4 className="text-sm font-semibold mb-4 flex items-center gap-2"><Share2 className="h-4 w-4" /> Social Media (Open Graph)</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">OG Image URL</Label>
                  <div className="col-span-3 flex gap-2">
                    <Input value={seoFormData.og_image} onChange={(e) => setSeoFormData({...seoFormData, og_image: e.target.value})} />
                    <ImageUpload bucket="merchant-images" path={`branding/og-${Date.now()}`} value={seoFormData.og_image} onChange={(url) => setSeoFormData({...seoFormData, og_image: url || ''})} />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">OG Title</Label>
                  <Input className="col-span-3" placeholder="Biarkan kosong untuk pakai judul utama" value={seoFormData.og_title} onChange={(e) => setSeoFormData({...seoFormData, og_title: e.target.value})} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setSeoDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSaveSeo} disabled={saving === 'seo'}>
              {saving === 'seo' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Simpan SEO
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
