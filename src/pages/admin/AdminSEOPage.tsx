import { useState, useEffect } from 'react';
import {
  Globe, Search, Image, FileText, Save, Eye, Plus, Edit2,
  Trash2, RefreshCw, CheckCircle2, AlertCircle, Code, Link2,
  BarChart2, Settings, ChevronDown, ChevronUp
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Halaman yang memiliki SEO konfigurasi / Pages with SEO configuration
const PREDEFINED_PAGES = [
  { path: '/',                slug: 'homepage',         label: 'Beranda' },
  { path: '/explore',         slug: 'explore',          label: 'Jelajahi Produk' },
  { path: '/tourism',         slug: 'tourism',          label: 'Wisata Desa' },
  { path: '/shops',           slug: 'shops',            label: 'Daftar Toko' },
  { path: '/products',        slug: 'products',         label: 'Semua Produk' },
];

interface SEOMeta {
  id: string;
  page_slug: string;
  page_label: string;
  meta_title: string;
  meta_description: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  canonical_url: string;
  robots: string;
  schema_json: string;
  updated_at: string;
}

interface RedirectRule {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
  is_active: boolean;
  created_at: string;
}

const DEFAULT_META: Partial<SEOMeta> = {
  meta_title: '',
  meta_description: '',
  og_title: '',
  og_description: '',
  og_image_url: '',
  canonical_url: '',
  robots: 'index,follow',
  schema_json: '',
};

function CharCount({ value, max }: { value: string; max: number }) {
  const count = value.length;
  const color = count > max ? 'text-red-500' : count > max * 0.8 ? 'text-amber-500' : 'text-muted-foreground';
  return <span className={`text-xs ${color}`}>{count}/{max}</span>;
}

export default function AdminSEOPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab]     = useState('pages');
  const [editingMeta, setEditingMeta] = useState<Partial<SEOMeta> | null>(null);
  const [editingPage, setEditingPage] = useState<{ slug: string; label: string } | null>(null);
  const [redirectForm, setRedirectForm] = useState({ from_path: '', to_path: '', status_code: 301, is_active: true });
  const [showRedirectForm, setShowRedirectForm] = useState(false);
  const [sitemapGenerated, setSitemapGenerated] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // Ambil semua SEO metadata / Fetch all SEO metadata
  const { data: metas = [], isLoading: metaLoading } = useQuery<SEOMeta[]>({
    queryKey: ['admin-seo-metas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_meta')
        .select('*')
        .order('page_slug');
      if (error) throw error;
      return (data || []) as SEOMeta[];
    },
    staleTime: 60_000,
  });

  // Ambil redirect rules / Fetch redirect rules
  const { data: redirects = [], isLoading: redirectLoading } = useQuery<RedirectRule[]>({
    queryKey: ['admin-seo-redirects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_redirects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as RedirectRule[];
    },
    staleTime: 60_000,
  });

  // Simpan SEO metadata / Save SEO metadata
  const saveMutation = useMutation({
    mutationFn: async (meta: Partial<SEOMeta>) => {
      const payload = {
        ...meta,
        updated_at: new Date().toISOString(),
      };
      if (meta.id) {
        const { error } = await supabase.from('seo_meta').update(payload).eq('id', meta.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('seo_meta').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('SEO metadata berhasil disimpan');
      setEditingMeta(null);
      setEditingPage(null);
      queryClient.invalidateQueries({ queryKey: ['admin-seo-metas'] });
    },
    onError: (e: any) => toast.error('Gagal menyimpan: ' + e.message),
  });

  // Simpan redirect / Save redirect
  const redirectMutation = useMutation({
    mutationFn: async (form: typeof redirectForm) => {
      const { error } = await supabase.from('seo_redirects').insert({
        ...form,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Redirect berhasil ditambahkan');
      setRedirectForm({ from_path: '', to_path: '', status_code: 301, is_active: true });
      setShowRedirectForm(false);
      queryClient.invalidateQueries({ queryKey: ['admin-seo-redirects'] });
    },
    onError: () => toast.error('Gagal menambahkan redirect'),
  });

  // Toggle redirect aktif / Toggle redirect active
  const toggleRedirect = async (id: string, is_active: boolean) => {
    await supabase.from('seo_redirects').update({ is_active: !is_active }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['admin-seo-redirects'] });
  };

  // Hapus redirect / Delete redirect
  const deleteRedirect = async (id: string) => {
    await supabase.from('seo_redirects').delete().eq('id', id);
    toast.success('Redirect dihapus');
    queryClient.invalidateQueries({ queryKey: ['admin-seo-redirects'] });
  };

  // Generate sitemap (simulasi) / Generate sitemap (simulation)
  const generateSitemap = () => {
    setSitemapGenerated(true);
    toast.success('Sitemap berhasil diperbarui! File tersedia di /sitemap.xml');
    setTimeout(() => setSitemapGenerated(false), 3000);
  };

  // Buka editor untuk halaman / Open editor for a page
  const openEditor = (slug: string, label: string) => {
    const existing = metas.find(m => m.page_slug === slug);
    setEditingPage({ slug, label });
    setEditingMeta(existing ? { ...existing } : {
      ...DEFAULT_META,
      page_slug: slug,
      page_label: label,
      meta_title: `${label} — DesaMart`,
      og_title: `${label} — DesaMart`,
    });
  };

  // Preview SERP (hasil pencarian Google) / Preview SERP
  const serpTitle = editingMeta?.meta_title || editingPage?.label || 'Judul Halaman';
  const serpDesc  = editingMeta?.meta_description || 'Deskripsi halaman akan muncul di sini...';
  const serpUrl   = previewUrl || `https://desamart.id${PREDEFINED_PAGES.find(p => p.slug === editingPage?.slug)?.path || '/'}`;

  return (
    <AdminLayout title="SEO & Konten Publik" subtitle="Kelola metadata, redirect, dan optimasi mesin pencari">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pages"><Globe className="h-3.5 w-3.5 mr-1.5" />Halaman</TabsTrigger>
          <TabsTrigger value="redirects"><Link2 className="h-3.5 w-3.5 mr-1.5" />Redirect</TabsTrigger>
          <TabsTrigger value="sitemap"><FileText className="h-3.5 w-3.5 mr-1.5" />Sitemap</TabsTrigger>
          <TabsTrigger value="tools"><Settings className="h-3.5 w-3.5 mr-1.5" />Tools</TabsTrigger>
        </TabsList>

        {/* ===== TAB HALAMAN ===== */}
        <TabsContent value="pages">
          <div className="grid gap-3">
            {PREDEFINED_PAGES.map(page => {
              const existing = metas.find(m => m.page_slug === page.slug);
              const hasData = !!existing?.meta_title;
              return (
                <Card key={page.slug} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{page.label}</p>
                          {hasData ? (
                            <Badge className="text-[10px] px-1.5 bg-emerald-100 text-emerald-700 border-0">
                              <CheckCircle2 className="h-3 w-3 mr-0.5" />Terkonfigurasi
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] px-1.5 bg-amber-100 text-amber-700 border-0">
                              <AlertCircle className="h-3 w-3 mr-0.5" />Belum Diatur
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{page.path}</p>
                        {existing?.meta_description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-sm">
                            {existing.meta_description}
                          </p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openEditor(page.slug, page.label)}>
                        <Edit2 className="h-3.5 w-3.5 mr-1" />Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Custom pages section */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Halaman Kustom</CardTitle>
              <CardDescription className="text-xs">Tambahkan SEO untuk halaman lainnya</CardDescription>
            </CardHeader>
            <CardContent>
              {metas.filter(m => !PREDEFINED_PAGES.find(p => p.slug === m.page_slug)).map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{m.page_label || m.page_slug}</p>
                    <p className="text-xs text-muted-foreground">{m.page_slug}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEditor(m.page_slug, m.page_label || m.page_slug)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => {
                  const slug = prompt('Masukkan slug halaman (misal: /tentang-kami):');
                  const label = prompt('Masukkan nama halaman:');
                  if (slug && label) openEditor(slug, label);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Tambah Halaman Kustom
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB REDIRECT ===== */}
        <TabsContent value="redirects">
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Redirect Rules</CardTitle>
                  <CardDescription className="text-xs">Arahkan URL lama ke URL baru (301/302 redirect)</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowRedirectForm(v => !v)}>
                  <Plus className="h-4 w-4 mr-1" /> Tambah
                </Button>
              </div>
            </CardHeader>
            {showRedirectForm && (
              <CardContent className="border-t pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Dari URL *</Label>
                    <Input
                      placeholder="/url-lama"
                      value={redirectForm.from_path}
                      onChange={e => setRedirectForm(p => ({ ...p, from_path: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ke URL *</Label>
                    <Input
                      placeholder="/url-baru"
                      value={redirectForm.to_path}
                      onChange={e => setRedirectForm(p => ({ ...p, to_path: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium">301 (Permanent)</label>
                    <Switch
                      checked={redirectForm.status_code === 301}
                      onCheckedChange={v => setRedirectForm(p => ({ ...p, status_code: v ? 301 : 302 }))}
                    />
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <label className="text-xs font-medium">Aktif</label>
                    <Switch
                      checked={redirectForm.is_active}
                      onCheckedChange={v => setRedirectForm(p => ({ ...p, is_active: v }))}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="ml-auto"
                    onClick={() => redirectMutation.mutate(redirectForm)}
                    disabled={!redirectForm.from_path || !redirectForm.to_path || redirectMutation.isPending}
                  >
                    {redirectMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {redirectLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Memuat...</div>
          ) : redirects.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Link2 className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Belum ada redirect. Tambahkan aturan redirect di atas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {redirects.map(r => (
                <Card key={r.id} className={!r.is_active ? 'opacity-50' : ''}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.from_path}</code>
                        <span className="text-muted-foreground text-xs">→</span>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.to_path}</code>
                        <Badge variant="outline" className="text-[10px]">{r.status_code}</Badge>
                        {!r.is_active && <Badge variant="outline" className="text-[10px] text-muted-foreground">Nonaktif</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleRedirect(r.id, r.is_active)}>
                        {r.is_active ? <Eye className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 opacity-40" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteRedirect(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== TAB SITEMAP ===== */}
        <TabsContent value="sitemap">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sitemap XML Otomatis</CardTitle>
                <CardDescription className="text-xs">
                  Sitemap di-generate otomatis dari semua produk, toko, dan halaman wisata aktif.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted rounded-lg p-3">
                  <code className="text-xs text-muted-foreground">https://desamart.id/sitemap.xml</code>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Halaman Statis', count: PREDEFINED_PAGES.length },
                    { label: 'Halaman SEO Kustom', count: metas.length },
                    { label: 'Redirect Aktif', count: redirects.filter(r => r.is_active).length },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-xl font-bold text-primary">{s.count}</p>
                    </div>
                  ))}
                </div>
                <Button onClick={generateSitemap} disabled={sitemapGenerated} className="w-full">
                  {sitemapGenerated ? (
                    <><CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" /> Sitemap Diperbarui!</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" /> Generate Sitemap Sekarang</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Robots.txt</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
{`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /merchant/
Disallow: /api/

Sitemap: https://desamart.id/sitemap.xml`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== TAB TOOLS ===== */}
        <TabsContent value="tools">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Verifikasi Search Console</CardTitle>
                <CardDescription className="text-xs">Tambahkan kode verifikasi Google / Bing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Google Search Console Verification Meta Tag', placeholder: 'google-site-verification=...' },
                  { label: 'Bing Webmaster Verification', placeholder: 'msvalidate.01=...' },
                ].map(field => (
                  <div key={field.label} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <Input placeholder={field.placeholder} className="text-xs font-mono" />
                  </div>
                ))}
                <Button size="sm">
                  <Save className="h-4 w-4 mr-1" /> Simpan Kode Verifikasi
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Google Analytics / Tag Manager</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Google Analytics 4 Measurement ID</Label>
                  <Input placeholder="G-XXXXXXXXXX" className="text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Google Tag Manager ID</Label>
                  <Input placeholder="GTM-XXXXXXX" className="text-xs font-mono" />
                </div>
                <Button size="sm">
                  <Save className="h-4 w-4 mr-1" /> Simpan
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Schema.org Structured Data</CardTitle>
                <CardDescription className="text-xs">JSON-LD global untuk seluruh situs</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder={`{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "DesaMart"\n}`}
                  rows={8}
                  className="font-mono text-xs resize-none"
                />
                <Button size="sm" className="mt-3">
                  <Save className="h-4 w-4 mr-1" /> Simpan Schema
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== Dialog Editor SEO ===== */}
      <Dialog open={!!editingMeta} onOpenChange={open => { if (!open) { setEditingMeta(null); setEditingPage(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit SEO — {editingPage?.label}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="meta" className="mt-2">
            <TabsList>
              <TabsTrigger value="meta">Meta Tags</TabsTrigger>
              <TabsTrigger value="og">Open Graph</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="advanced">Lanjutan</TabsTrigger>
            </TabsList>

            {/* Meta Tags */}
            <TabsContent value="meta" className="space-y-3 mt-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Meta Title *</Label>
                  <CharCount value={editingMeta?.meta_title || ''} max={60} />
                </div>
                <Input
                  placeholder="Judul halaman (maks. 60 karakter)"
                  value={editingMeta?.meta_title || ''}
                  onChange={e => setEditingMeta(p => ({ ...p, meta_title: e.target.value }))}
                  maxLength={80}
                />
                <p className="text-[11px] text-muted-foreground">Ditampilkan di tab browser dan hasil pencarian Google.</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Meta Description *</Label>
                  <CharCount value={editingMeta?.meta_description || ''} max={160} />
                </div>
                <Textarea
                  placeholder="Deskripsi singkat halaman (maks. 160 karakter)"
                  value={editingMeta?.meta_description || ''}
                  onChange={e => setEditingMeta(p => ({ ...p, meta_description: e.target.value }))}
                  rows={3}
                  maxLength={200}
                  className="resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Canonical URL</Label>
                <Input
                  placeholder="https://desamart.id/..."
                  value={editingMeta?.canonical_url || ''}
                  onChange={e => setEditingMeta(p => ({ ...p, canonical_url: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Robots</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={editingMeta?.robots || 'index,follow'}
                  onChange={e => setEditingMeta(p => ({ ...p, robots: e.target.value }))}
                >
                  <option value="index,follow">index, follow (default)</option>
                  <option value="noindex,follow">noindex, follow</option>
                  <option value="index,nofollow">index, nofollow</option>
                  <option value="noindex,nofollow">noindex, nofollow</option>
                </select>
              </div>
            </TabsContent>

            {/* Open Graph */}
            <TabsContent value="og" className="space-y-3 mt-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">OG Title</Label>
                  <CharCount value={editingMeta?.og_title || ''} max={60} />
                </div>
                <Input
                  placeholder="Judul untuk share di media sosial"
                  value={editingMeta?.og_title || ''}
                  onChange={e => setEditingMeta(p => ({ ...p, og_title: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">OG Description</Label>
                  <CharCount value={editingMeta?.og_description || ''} max={200} />
                </div>
                <Textarea
                  placeholder="Deskripsi saat link dibagikan"
                  value={editingMeta?.og_description || ''}
                  onChange={e => setEditingMeta(p => ({ ...p, og_description: e.target.value }))}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">OG Image URL</Label>
                <Input
                  placeholder="https://desamart.id/og-image.jpg (1200x630 px)"
                  value={editingMeta?.og_image_url || ''}
                  onChange={e => setEditingMeta(p => ({ ...p, og_image_url: e.target.value }))}
                />
                {editingMeta?.og_image_url && (
                  <img
                    src={editingMeta.og_image_url}
                    alt="OG Preview"
                    className="mt-2 rounded-lg w-full max-w-xs h-28 object-cover border"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
            </TabsContent>

            {/* Preview SERP */}
            <TabsContent value="preview" className="mt-3">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">URL Preview</Label>
                  <Input
                    placeholder="https://desamart.id/..."
                    value={previewUrl}
                    onChange={e => setPreviewUrl(e.target.value)}
                    className="text-xs"
                  />
                </div>

                {/* Google SERP Preview */}
                <Card className="border-2">
                  <CardContent className="p-4">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">Preview Google Search Result</p>
                    <div className="max-w-md">
                      <p className="text-[11px] text-emerald-700 truncate">{serpUrl}</p>
                      <p className="text-blue-600 text-lg font-normal leading-tight hover:underline cursor-pointer truncate">
                        {serpTitle.slice(0, 60)}{serpTitle.length > 60 ? '...' : ''}
                      </p>
                      <p className="text-gray-600 text-sm leading-snug mt-0.5">
                        {serpDesc.slice(0, 160)}{serpDesc.length > 160 ? '...' : ''}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* OG Card Preview */}
                {(editingMeta?.og_title || editingMeta?.og_image_url) && (
                  <Card className="border-2 overflow-hidden max-w-sm">
                    {editingMeta.og_image_url && (
                      <img
                        src={editingMeta.og_image_url}
                        alt="OG"
                        className="w-full h-40 object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <CardContent className="p-3 bg-gray-50">
                      <p className="text-[10px] uppercase text-muted-foreground">desamart.id</p>
                      <p className="font-semibold text-sm">{editingMeta.og_title || serpTitle}</p>
                      <p className="text-xs text-muted-foreground">{editingMeta.og_description || serpDesc}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Lanjutan — Schema JSON */}
            <TabsContent value="advanced" className="mt-3 space-y-3">
              <div className="space-y-1">
                <Label className="text-sm">Schema.org JSON-LD (Halaman ini)</Label>
                <Textarea
                  placeholder={`{\n  "@context": "https://schema.org",\n  "@type": "WebPage"\n}`}
                  value={editingMeta?.schema_json || ''}
                  onChange={e => setEditingMeta(p => ({ ...p, schema_json: e.target.value }))}
                  rows={8}
                  className="font-mono text-xs resize-none"
                />
                <p className="text-[11px] text-muted-foreground">
                  JSON-LD ini akan di-inject ke halaman ini khusus. Gunakan validator schema.org untuk verifikasi.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setEditingMeta(null); setEditingPage(null); }}>
              Batal
            </Button>
            <Button
              onClick={() => saveMutation.mutate(editingMeta!)}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saveMutation.isPending ? 'Menyimpan...' : 'Simpan SEO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
