import { useState } from 'react';
import {
  Megaphone, Plus, TrendingUp, Eye, MousePointerClick, Clock, CheckCircle2,
  XCircle, AlertTriangle, Upload, Star, Search, LayoutDashboard, Image,
  Package, Info, ChevronRight, Zap, RefreshCw, ExternalLink
} from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { format, differenceInDays, isPast, isFuture } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface AdPackage {
  id: string;
  name: string;
  placement_type: string;
  description: string | null;
  price_per_day: number;
  max_days: number;
  is_active: boolean;
}

interface MerchantAd {
  id: string;
  package_id: string | null;
  placement_type: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  duration_days: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  payment_amount: number;
  payment_proof_url: string | null;
  rejection_reason: string | null;
  view_count: number;
  click_count: number;
  created_at: string;
  package?: { name: string; placement_type: string };
}

const PLACEMENT_LABELS: Record<string, { label: string; icon: React.ReactNode; desc: string; color: string }> = {
  search_top: {
    label: 'Teratas Pencarian',
    icon: <Search className="h-4 w-4" />,
    desc: 'Muncul di baris pertama hasil pencarian pembeli',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  category_top: {
    label: 'Teratas Kategori',
    icon: <Star className="h-4 w-4" />,
    desc: 'Muncul paling atas di halaman kategori produk',
    color: 'text-purple-600 bg-purple-50 border-purple-200',
  },
  home_banner: {
    label: 'Banner Homepage',
    icon: <Image className="h-4 w-4" />,
    desc: 'Banner besar di halaman utama — jangkauan terluas',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
  product_recommend: {
    label: 'Rekomendasi Produk',
    icon: <Zap className="h-4 w-4" />,
    desc: 'Tampil di seksi "Produk Pilihan" di berbagai halaman',
    color: 'text-green-600 bg-green-50 border-green-200',
  },
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending: { label: 'Menunggu Verifikasi', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  active: { label: 'Aktif', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  expired: { label: 'Berakhir', variant: 'outline', icon: <XCircle className="h-3 w-3" /> },
  rejected: { label: 'Ditolak', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

const DEFAULT_PACKAGES: AdPackage[] = [
  { id: 'default-1', name: 'Spotlight Pencarian', placement_type: 'search_top', description: 'Produk Anda muncul di atas hasil pencarian', price_per_day: 15000, max_days: 30, is_active: true },
  { id: 'default-2', name: 'Teratas Kategori', placement_type: 'category_top', description: 'Muncul paling atas di halaman kategori', price_per_day: 20000, max_days: 30, is_active: true },
  { id: 'default-3', name: 'Banner Homepage', placement_type: 'home_banner', description: 'Banner besar di halaman utama', price_per_day: 50000, max_days: 14, is_active: true },
  { id: 'default-4', name: 'Produk Pilihan', placement_type: 'product_recommend', description: 'Tampil di seksi rekomendasi produk', price_per_day: 10000, max_days: 30, is_active: true },
];

const EMPTY_FORM = {
  package_id: '',
  placement_type: '',
  title: '',
  description: '',
  image_url: '',
  link_url: '',
  duration_days: 7,
  payment_proof_url: '',
};

export default function MerchantIklanPage() {
  const { user } = useAuth();
  const { merchantId, merchantName, loading: guardLoading } = useMerchantGuard();
  const queryClient = useQueryClient();

  const [buyDialog, setBuyDialog] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<AdPackage | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Fetch packages
  const { data: packages = DEFAULT_PACKAGES } = useQuery<AdPackage[]>({
    queryKey: ['ad-packages'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ad_packages')
        .select('*')
        .eq('is_active', true)
        .order('price_per_day');
      return data?.length ? data : DEFAULT_PACKAGES;
    },
    staleTime: 300_000,
  });

  // Fetch merchant's ads
  const { data: ads = [], isLoading: adsLoading, refetch } = useQuery<MerchantAd[]>({
    queryKey: ['merchant-ads', merchantId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('merchant_ads')
        .select('*, package:package_id(name, placement_type)')
        .eq('merchant_id', merchantId!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!merchantId && !guardLoading,
    staleTime: 60_000,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPackage || !merchantId) throw new Error('Data tidak lengkap');
      if (!form.title.trim()) throw new Error('Judul iklan wajib diisi');
      if (form.duration_days < 1 || form.duration_days > selectedPackage.max_days)
        throw new Error(`Durasi harus 1–${selectedPackage.max_days} hari`);
      if (!form.payment_proof_url) throw new Error('Upload bukti pembayaran terlebih dahulu');

      const total = selectedPackage.price_per_day * form.duration_days;

      const { error } = await (supabase as any).from('merchant_ads').insert({
        merchant_id: merchantId,
        package_id: selectedPackage.id.startsWith('default') ? null : selectedPackage.id,
        placement_type: selectedPackage.placement_type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url || null,
        link_url: form.link_url.trim() || null,
        duration_days: form.duration_days,
        status: 'pending',
        payment_amount: total,
        payment_proof_url: form.payment_proof_url,
        view_count: 0,
        click_count: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Iklan berhasil diajukan! Admin akan memverifikasi dalam 1x24 jam.');
      setBuyDialog(false);
      setForm({ ...EMPTY_FORM });
      setSelectedPackage(null);
      queryClient.invalidateQueries({ queryKey: ['merchant-ads', merchantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadFile = async (
    file: File,
    bucket: string,
    field: 'payment_proof_url' | 'image_url',
    setLoading: (b: boolean) => void
  ) => {
    setLoading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${merchantId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      setForm(prev => ({ ...prev, [field]: urlData.publicUrl }));
      toast.success('File berhasil diupload');
    } catch {
      toast.error('Gagal upload file');
    } finally {
      setLoading(false);
    }
  };

  const openBuyDialog = (pkg: AdPackage) => {
    setSelectedPackage(pkg);
    setForm({ ...EMPTY_FORM, placement_type: pkg.placement_type, duration_days: 7 });
    setBuyDialog(true);
  };

  const activeAds = ads.filter(a => a.status === 'active');
  const pendingAds = ads.filter(a => a.status === 'pending');
  const totalSpend = ads.filter(a => a.status !== 'rejected').reduce((s, a) => s + a.payment_amount, 0);
  const totalViews = ads.reduce((s, a) => s + (a.view_count || 0), 0);
  const totalClicks = ads.reduce((s, a) => s + (a.click_count || 0), 0);

  const total = selectedPackage ? selectedPackage.price_per_day * form.duration_days : 0;

  if (guardLoading) {
    return (
      <MerchantLayout title="Iklan Berbayar" subtitle="Promosikan produk Anda">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Iklan Berbayar" subtitle="Tampil di posisi teratas — lebih banyak pembeli, lebih banyak penjualan">
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Iklan Aktif</span>
              </div>
              <p className="text-2xl font-bold">{activeAds.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
              <p className="text-2xl font-bold">{pendingAds.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total Dilihat</span>
              </div>
              <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Total Iklan</span>
              </div>
              <p className="text-xl font-bold">{formatPrice(totalSpend)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="beli">
          <TabsList className="w-full">
            <TabsTrigger value="beli" className="flex-1">
              <Plus className="h-4 w-4 mr-1.5" />Beli Iklan
            </TabsTrigger>
            <TabsTrigger value="aktif" className="flex-1">
              <Megaphone className="h-4 w-4 mr-1.5" />Iklan Saya
              {(activeAds.length + pendingAds.length) > 0 && (
                <Badge className="ml-1.5 text-xs py-0">{activeAds.length + pendingAds.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="riwayat" className="flex-1">
              <Clock className="h-4 w-4 mr-1.5" />Riwayat
            </TabsTrigger>
          </TabsList>

          {/* BELI IKLAN */}
          <TabsContent value="beli" className="space-y-4 mt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Iklan Anda akan aktif setelah admin memverifikasi pembayaran (maks. 1x24 jam).
                Produk akan tampil di posisi premium sesuai paket yang dipilih.
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-4">
              {packages.filter(p => p.is_active).map(pkg => {
                const placement = PLACEMENT_LABELS[pkg.placement_type];
                return (
                  <Card
                    key={pkg.id}
                    className={`border-2 cursor-pointer hover:shadow-md transition-all ${placement?.color || ''}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${placement?.color || 'bg-muted'}`}>
                            {placement?.icon}
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm">{pkg.name}</h3>
                            <p className="text-xs text-muted-foreground">{placement?.label}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-base">{formatPrice(pkg.price_per_day)}</p>
                          <p className="text-xs text-muted-foreground">/hari</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{placement?.desc || pkg.description}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Maks. {pkg.max_days} hari</p>
                        <Button size="sm" onClick={() => openBuyDialog(pkg)} className="text-xs">
                          Pasang Iklan <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  Cara Kerja Iklan Berbayar
                </h4>
                <ol className="space-y-1.5 text-sm text-muted-foreground">
                  <li>1. Pilih paket iklan sesuai tujuan dan budget Anda</li>
                  <li>2. Isi detail iklan (judul, deskripsi, gambar opsional)</li>
                  <li>3. Lakukan pembayaran dan upload bukti transfer</li>
                  <li>4. Admin verifikasi maksimal 1x24 jam</li>
                  <li>5. Iklan aktif otomatis — produk Anda tampil di posisi premium</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IKLAN AKTIF & PENDING */}
          <TabsContent value="aktif" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />Refresh
              </Button>
            </div>
            {adsLoading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : [...activeAds, ...pendingAds].length === 0 ? (
              <div className="text-center py-16">
                <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-muted-foreground">Belum ada iklan aktif atau pending</p>
                <p className="text-sm text-muted-foreground mt-1">Beli paket iklan untuk mulai berpromosi</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...activeAds, ...pendingAds].map(ad => {
                  const placement = PLACEMENT_LABELS[ad.placement_type];
                  const status = STATUS_CONFIG[ad.status];
                  const ctr = ad.view_count > 0 ? ((ad.click_count / ad.view_count) * 100).toFixed(1) : '0.0';
                  const daysLeft = ad.end_date ? differenceInDays(new Date(ad.end_date), new Date()) : null;
                  return (
                    <Card key={ad.id} className={ad.status === 'active' ? 'border-green-200 dark:border-green-800' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={status.variant} className="text-xs flex items-center gap-1">
                                {status.icon}{status.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{placement?.label}</span>
                            </div>
                            <h4 className="font-semibold text-sm">{ad.title}</h4>
                            {ad.description && <p className="text-xs text-muted-foreground mt-0.5">{ad.description}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">{formatPrice(ad.payment_amount)}</p>
                            <p className="text-xs text-muted-foreground">{ad.duration_days} hari</p>
                          </div>
                        </div>
                        {ad.status === 'active' && (
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="bg-muted/50 rounded-lg p-2 text-center">
                              <p className="text-xs text-muted-foreground">Dilihat</p>
                              <p className="font-bold text-sm">{(ad.view_count || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-2 text-center">
                              <p className="text-xs text-muted-foreground">Klik</p>
                              <p className="font-bold text-sm">{(ad.click_count || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-2 text-center">
                              <p className="text-xs text-muted-foreground">CTR</p>
                              <p className="font-bold text-sm">{ctr}%</p>
                            </div>
                          </div>
                        )}
                        {ad.status === 'active' && ad.end_date && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Berakhir {format(new Date(ad.end_date), 'dd MMM yyyy', { locale: idLocale })}</span>
                              <span className={daysLeft !== null && daysLeft <= 3 ? 'text-red-500 font-medium' : ''}>
                                {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} hari lagi` : 'Hari ini berakhir') : ''}
                              </span>
                            </div>
                            <Progress value={Math.max(0, Math.min(100, ((ad.duration_days - (daysLeft || 0)) / ad.duration_days) * 100))} className="h-1.5" />
                          </div>
                        )}
                        {ad.status === 'pending' && (
                          <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Menunggu verifikasi admin — biasanya selesai dalam 1x24 jam
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* RIWAYAT */}
          <TabsContent value="riwayat" className="space-y-3 mt-4">
            {ads.filter(a => a.status === 'expired' || a.status === 'rejected').length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Belum ada riwayat iklan</p>
              </div>
            ) : (
              ads.filter(a => a.status === 'expired' || a.status === 'rejected').map(ad => {
                const placement = PLACEMENT_LABELS[ad.placement_type];
                const status = STATUS_CONFIG[ad.status];
                const ctr = ad.view_count > 0 ? ((ad.click_count / ad.view_count) * 100).toFixed(1) : '0.0';
                return (
                  <Card key={ad.id} className="opacity-80">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={status.variant} className="text-xs flex items-center gap-1">
                              {status.icon}{status.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{placement?.label}</span>
                          </div>
                          <h4 className="font-semibold text-sm">{ad.title}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(ad.created_at), 'dd MMM yyyy', { locale: idLocale })} •
                            {ad.duration_days} hari • {formatPrice(ad.payment_amount)}
                          </p>
                          {ad.status === 'rejected' && ad.rejection_reason && (
                            <p className="text-xs text-red-500 mt-1">Alasan: {ad.rejection_reason}</p>
                          )}
                          {ad.status === 'expired' && (
                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                              <span><Eye className="h-3 w-3 inline mr-0.5" />{ad.view_count || 0}</span>
                              <span><MousePointerClick className="h-3 w-3 inline mr-0.5" />{ad.click_count || 0}</span>
                              <span>CTR: {ctr}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        {/* BUY DIALOG */}
        <Dialog open={buyDialog} onOpenChange={setBuyDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                Pasang Iklan — {selectedPackage?.name}
              </DialogTitle>
            </DialogHeader>

            {selectedPackage && (
              <div className="space-y-4">
                <div className={`p-3 rounded-lg border text-sm ${PLACEMENT_LABELS[selectedPackage.placement_type]?.color || 'bg-muted'}`}>
                  <div className="flex items-center gap-2 font-medium mb-1">
                    {PLACEMENT_LABELS[selectedPackage.placement_type]?.icon}
                    {PLACEMENT_LABELS[selectedPackage.placement_type]?.label}
                  </div>
                  <p className="text-xs opacity-80">{PLACEMENT_LABELS[selectedPackage.placement_type]?.desc}</p>
                  <p className="text-xs font-medium mt-1">{formatPrice(selectedPackage.price_per_day)}/hari • Maks. {selectedPackage.max_days} hari</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Judul Iklan <span className="text-destructive">*</span></Label>
                    <Input
                      className="mt-1"
                      value={form.title}
                      onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Cth: Nasi Goreng Spesial Bu Sari — Promo 50%!"
                      maxLength={80}
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">{form.title.length}/80 karakter</p>
                  </div>

                  <div>
                    <Label>Deskripsi Iklan</Label>
                    <Textarea
                      className="mt-1"
                      value={form.description}
                      onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Deskripsi singkat produk/promosi..."
                      rows={3}
                      maxLength={200}
                    />
                  </div>

                  <div>
                    <Label>Gambar Iklan (opsional)</Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        value={form.image_url}
                        onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))}
                        placeholder="URL gambar atau upload..."
                        className="flex-1"
                      />
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) uploadFile(f, 'merchant-ads', 'image_url', setUploadingBanner);
                          }}
                        />
                        <Button type="button" variant="outline" size="icon" disabled={uploadingBanner} asChild>
                          <span>
                            {uploadingBanner ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          </span>
                        </Button>
                      </label>
                    </div>
                    {form.image_url && (
                      <img src={form.image_url} alt="Preview" className="mt-2 h-24 w-full object-cover rounded-lg" />
                    )}
                  </div>

                  <div>
                    <Label>URL Tujuan (opsional)</Label>
                    <Input
                      className="mt-1"
                      value={form.link_url}
                      onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))}
                      placeholder="https://... (link produk/toko)"
                    />
                  </div>

                  <div>
                    <Label>Durasi Iklan <span className="text-destructive">*</span></Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        min={1}
                        max={selectedPackage.max_days}
                        value={form.duration_days}
                        onChange={e => setForm(p => ({ ...p, duration_days: parseInt(e.target.value) || 1 }))}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">hari (maks. {selectedPackage.max_days})</span>
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{formatPrice(selectedPackage.price_per_day)} × {form.duration_days} hari</span>
                    <span className="font-bold">{formatPrice(total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Transfer ke rekening admin, lalu upload bukti di bawah</p>
                </div>

                {/* Payment Proof */}
                <div>
                  <Label>Bukti Pembayaran <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Transfer sejumlah <strong>{formatPrice(total)}</strong> ke rekening admin, lalu upload foto bukti transfer
                  </p>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) uploadFile(f, 'payment-proofs', 'payment_proof_url', setUploadingProof);
                      }}
                    />
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${form.payment_proof_url ? 'border-green-400 bg-green-50 dark:bg-green-950/30' : 'border-border hover:border-primary'}`}>
                      {uploadingProof ? (
                        <div className="flex items-center justify-center gap-2 text-sm">
                          <RefreshCw className="h-4 w-4 animate-spin" />Mengupload...
                        </div>
                      ) : form.payment_proof_url ? (
                        <div className="flex items-center justify-center gap-2 text-green-600 text-sm">
                          <CheckCircle2 className="h-4 w-4" />Bukti berhasil diupload
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          <Upload className="h-6 w-6 mx-auto mb-1" />
                          Klik untuk upload bukti transfer
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setBuyDialog(false)}>Batal</Button>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? 'Mengajukan...' : 'Ajukan Iklan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MerchantLayout>
  );
}
