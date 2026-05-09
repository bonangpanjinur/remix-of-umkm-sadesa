import { useState } from 'react';
import {
  Megaphone, CheckCircle2, XCircle, Clock, Eye, MousePointerClick,
  TrendingUp, DollarSign, Plus, Edit2, Trash2, Save, RefreshCw,
  AlertTriangle, Package, BarChart3, Search, Filter, Info
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface AdPackage {
  id: string;
  name: string;
  placement_type: string;
  description: string | null;
  price_per_day: number;
  max_days: number;
  is_active: boolean;
  created_at: string;
}

interface MerchantAd {
  id: string;
  merchant_id: string;
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
  merchant?: { name: string; phone: string | null };
}

const PLACEMENT_OPTIONS = [
  { value: 'search_top', label: 'Teratas Pencarian' },
  { value: 'category_top', label: 'Teratas Kategori' },
  { value: 'home_banner', label: 'Banner Homepage' },
  { value: 'product_recommend', label: 'Rekomendasi Produk' },
];

const PLACEMENT_LABELS: Record<string, string> = {
  search_top: 'Teratas Pencarian',
  category_top: 'Teratas Kategori',
  home_banner: 'Banner Homepage',
  product_recommend: 'Rekomendasi Produk',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  active: { label: 'Aktif', variant: 'default' },
  expired: { label: 'Berakhir', variant: 'outline' },
  rejected: { label: 'Ditolak', variant: 'destructive' },
};

const DEFAULT_PKG: Partial<AdPackage> = {
  name: '', placement_type: 'search_top', description: '', price_per_day: 15000, max_days: 30, is_active: true,
};

const DEFAULT_PACKAGES_SEED: Omit<AdPackage, 'id' | 'created_at'>[] = [
  { name: 'Spotlight Pencarian', placement_type: 'search_top', description: 'Produk Anda muncul di atas hasil pencarian', price_per_day: 15000, max_days: 30, is_active: true },
  { name: 'Teratas Kategori', placement_type: 'category_top', description: 'Muncul paling atas di halaman kategori', price_per_day: 20000, max_days: 30, is_active: true },
  { name: 'Banner Homepage', placement_type: 'home_banner', description: 'Banner besar di halaman utama — jangkauan terluas', price_per_day: 50000, max_days: 14, is_active: true },
  { name: 'Produk Pilihan', placement_type: 'product_recommend', description: 'Tampil di seksi rekomendasi produk', price_per_day: 10000, max_days: 30, is_active: true },
];

export default function AdminIklanPage() {
  const queryClient = useQueryClient();
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<MerchantAd | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pkgDialog, setPkgDialog] = useState(false);
  const [editingPkg, setEditingPkg] = useState<AdPackage | null>(null);
  const [pkgForm, setPkgForm] = useState<Partial<AdPackage>>({ ...DEFAULT_PKG });
  const [filterStatus, setFilterStatus] = useState('all');
  const [proofDialog, setProofDialog] = useState<string | null>(null);

  // Fetch packages
  const { data: packages = [], refetch: refetchPkgs } = useQuery<AdPackage[]>({
    queryKey: ['admin-ad-packages'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('ad_packages').select('*').order('price_per_day');
      return data || [];
    },
    staleTime: 60_000,
  });

  // Fetch all ads
  const { data: ads = [], isLoading: adsLoading, refetch: refetchAds } = useQuery<MerchantAd[]>({
    queryKey: ['admin-merchant-ads', filterStatus],
    queryFn: async () => {
      let q = (supabase as any)
        .from('merchant_ads')
        .select('*, merchant:merchant_id(name, phone)')
        .order('created_at', { ascending: false });
      if (filterStatus !== 'all') q = q.eq('status', filterStatus);
      const { data } = await q;
      return data || [];
    },
    staleTime: 30_000,
  });

  // Stats
  const pendingAds = ads.filter(a => a.status === 'pending');
  const activeAds = ads.filter(a => a.status === 'active');
  const totalRevenue = ads.filter(a => a.status !== 'rejected').reduce((s, a) => s + a.payment_amount, 0);
  const totalViews = ads.reduce((s, a) => s + (a.view_count || 0), 0);
  const totalClicks = ads.reduce((s, a) => s + (a.click_count || 0), 0);

  // Approve ad
  const approveMutation = useMutation({
    mutationFn: async (ad: MerchantAd) => {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + ad.duration_days);
      const { error } = await (supabase as any).from('merchant_ads').update({
        status: 'active',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      }).eq('id', ad.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Iklan disetujui dan diaktifkan');
      queryClient.invalidateQueries({ queryKey: ['admin-merchant-ads'] });
    },
    onError: () => toast.error('Gagal menyetujui iklan'),
  });

  // Reject ad
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await (supabase as any).from('merchant_ads').update({
        status: 'rejected',
        rejection_reason: reason,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Iklan ditolak');
      setRejectDialog(false);
      setRejectReason('');
      setRejectTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-merchant-ads'] });
    },
    onError: () => toast.error('Gagal menolak iklan'),
  });

  // Expire ad
  const expireMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('merchant_ads').update({ status: 'expired' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Iklan dinonaktifkan');
      queryClient.invalidateQueries({ queryKey: ['admin-merchant-ads'] });
    },
    onError: () => toast.error('Gagal menonaktifkan iklan'),
  });

  // Save package
  const savePkgMutation = useMutation({
    mutationFn: async () => {
      if (!pkgForm.name?.trim()) throw new Error('Nama paket wajib diisi');
      if (!pkgForm.price_per_day || pkgForm.price_per_day <= 0) throw new Error('Harga harus > 0');
      if (editingPkg) {
        const { error } = await (supabase as any).from('ad_packages').update({
          name: pkgForm.name, placement_type: pkgForm.placement_type,
          description: pkgForm.description, price_per_day: pkgForm.price_per_day,
          max_days: pkgForm.max_days, is_active: pkgForm.is_active,
        }).eq('id', editingPkg.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('ad_packages').insert({
          name: pkgForm.name, placement_type: pkgForm.placement_type,
          description: pkgForm.description, price_per_day: pkgForm.price_per_day,
          max_days: pkgForm.max_days, is_active: pkgForm.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingPkg ? 'Paket diperbarui' : 'Paket berhasil ditambahkan');
      setPkgDialog(false);
      setEditingPkg(null);
      setPkgForm({ ...DEFAULT_PKG });
      refetchPkgs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePkgMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('ad_packages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Paket dihapus');
      refetchPkgs();
    },
    onError: () => toast.error('Gagal menghapus paket'),
  });

  const seedPackages = async () => {
    try {
      const { error } = await (supabase as any).from('ad_packages').insert(DEFAULT_PACKAGES_SEED);
      if (error) throw error;
      toast.success('Paket default berhasil ditambahkan');
      refetchPkgs();
    } catch {
      toast.error('Gagal menambahkan paket default');
    }
  };

  const openEditPkg = (pkg: AdPackage) => {
    setEditingPkg(pkg);
    setPkgForm({ ...pkg });
    setPkgDialog(true);
  };

  const openAddPkg = () => {
    setEditingPkg(null);
    setPkgForm({ ...DEFAULT_PKG });
    setPkgDialog(true);
  };

  const openReject = (ad: MerchantAd) => {
    setRejectTarget(ad);
    setRejectReason('');
    setRejectDialog(true);
  };

  return (
    <AdminLayout title="Manajemen Iklan Berbayar" subtitle="Kelola sponsored listing & pendapatan iklan">
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Total Pendapatan</span>
              </div>
              <p className="text-xl font-bold">{formatPrice(totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card className={pendingAds.length > 0 ? 'border-orange-400' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Pending Approval</span>
              </div>
              <p className="text-2xl font-bold">{pendingAds.length}</p>
              {pendingAds.length > 0 && <Badge variant="destructive" className="text-xs mt-1">Perlu tindakan</Badge>}
            </CardContent>
          </Card>
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
                <Eye className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total Impresi</span>
              </div>
              <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <MousePointerClick className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Total Klik</span>
              </div>
              <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">CTR: {totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : 0}%</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1">
              <Clock className="h-4 w-4 mr-1.5" />
              Pending Approval
              {pendingAds.length > 0 && <Badge variant="destructive" className="ml-1.5 text-xs py-0">{pendingAds.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="semua" className="flex-1">
              <Megaphone className="h-4 w-4 mr-1.5" />Semua Iklan
            </TabsTrigger>
            <TabsTrigger value="paket" className="flex-1">
              <Package className="h-4 w-4 mr-1.5" />Paket Harga
            </TabsTrigger>
            <TabsTrigger value="performa" className="flex-1">
              <BarChart3 className="h-4 w-4 mr-1.5" />Performa
            </TabsTrigger>
          </TabsList>

          {/* PENDING APPROVAL */}
          <TabsContent value="pending" className="space-y-4 mt-4">
            {pendingAds.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                <p className="text-muted-foreground">Tidak ada iklan yang menunggu persetujuan</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingAds.map(ad => (
                  <Card key={ad.id} className="border-orange-200 dark:border-orange-800">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {PLACEMENT_LABELS[ad.placement_type] || ad.placement_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(ad.created_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                            </span>
                          </div>
                          <h4 className="font-semibold">{ad.title}</h4>
                          {ad.description && <p className="text-sm text-muted-foreground mt-0.5">{ad.description}</p>}
                          <div className="flex items-center gap-3 mt-2 text-sm">
                            <span className="text-muted-foreground">
                              Merchant: <strong>{ad.merchant?.name || ad.merchant_id.slice(-8)}</strong>
                            </span>
                            <span className="text-muted-foreground">Durasi: <strong>{ad.duration_days} hari</strong></span>
                            <span className="font-bold text-primary">{formatPrice(ad.payment_amount)}</span>
                          </div>
                        </div>
                        {ad.image_url && (
                          <img src={ad.image_url} alt="Ad" className="h-20 w-32 object-cover rounded-lg shrink-0" />
                        )}
                      </div>

                      {/* Payment proof */}
                      {ad.payment_proof_url && (
                        <div className="mb-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProofDialog(ad.payment_proof_url)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Lihat Bukti Pembayaran
                          </Button>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => approveMutation.mutate(ad)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Setujui & Aktifkan
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => openReject(ad)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Tolak
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SEMUA IKLAN */}
          <TabsContent value="semua" className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="expired">Berakhir</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => refetchAds()} disabled={adsLoading}>
                <RefreshCw className={`h-4 w-4 ${adsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {adsLoading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : ads.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Belum ada iklan</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Judul Iklan</TableHead>
                      <TableHead>Penempatan</TableHead>
                      <TableHead>Durasi</TableHead>
                      <TableHead>Bayar</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Performa</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ads.map(ad => {
                      const status = STATUS_CONFIG[ad.status];
                      const ctr = ad.view_count > 0 ? ((ad.click_count / ad.view_count) * 100).toFixed(1) : '0.0';
                      const daysLeft = ad.end_date ? differenceInDays(new Date(ad.end_date), new Date()) : null;
                      return (
                        <TableRow key={ad.id}>
                          <TableCell className="text-sm font-medium">{ad.merchant?.name || '-'}</TableCell>
                          <TableCell className="max-w-[180px]">
                            <p className="text-sm font-medium truncate">{ad.title}</p>
                            {ad.description && <p className="text-xs text-muted-foreground truncate">{ad.description}</p>}
                          </TableCell>
                          <TableCell className="text-sm">{PLACEMENT_LABELS[ad.placement_type] || ad.placement_type}</TableCell>
                          <TableCell className="text-sm">
                            {ad.duration_days}h
                            {ad.status === 'active' && daysLeft !== null && (
                              <p className={`text-xs ${daysLeft <= 2 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                {daysLeft > 0 ? `${daysLeft}h lagi` : 'Berakhir hari ini'}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{formatPrice(ad.payment_amount)}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div>{(ad.view_count || 0).toLocaleString()} impresi</div>
                            <div>{(ad.click_count || 0)} klik • {ctr}% CTR</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(ad.created_at), 'dd/MM/yy', { locale: idLocale })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {ad.payment_proof_url && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setProofDialog(ad.payment_proof_url)}>
                                  <Eye className="h-3 w-3" />
                                </Button>
                              )}
                              {ad.status === 'pending' && (
                                <>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => approveMutation.mutate(ad)}>
                                    <CheckCircle2 className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => openReject(ad)}>
                                    <XCircle className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              {ad.status === 'active' && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-500" onClick={() => expireMutation.mutate(ad.id)}>
                                  <XCircle className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* PAKET HARGA */}
          <TabsContent value="paket" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Paket Iklan Berbayar</h3>
                <p className="text-sm text-muted-foreground">Atur harga dan jenis penempatan iklan</p>
              </div>
              <div className="flex gap-2">
                {packages.length === 0 && (
                  <Button variant="outline" onClick={seedPackages}>
                    <Package className="h-4 w-4 mr-2" />
                    Buat Paket Default
                  </Button>
                )}
                <Button onClick={openAddPkg}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Paket
                </Button>
              </div>
            </div>

            {packages.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Belum ada paket iklan. Klik <strong>"Buat Paket Default"</strong> untuk membuat 4 paket standar sekaligus,
                  atau klik <strong>"Tambah Paket"</strong> untuk buat manual.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {packages.map(pkg => (
                  <Card key={pkg.id} className={!pkg.is_active ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{pkg.name}</h4>
                          <p className="text-xs text-muted-foreground">{PLACEMENT_LABELS[pkg.placement_type] || pkg.placement_type}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={pkg.is_active ? 'default' : 'secondary'} className="text-xs">
                            {pkg.is_active ? 'Aktif' : 'Non-aktif'}
                          </Badge>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPkg(pkg)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deletePkgMutation.mutate(pkg.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {pkg.description && <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>}
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-primary">{formatPrice(pkg.price_per_day)}<span className="text-xs font-normal text-muted-foreground">/hari</span></span>
                        <span className="text-muted-foreground">Maks. {pkg.max_days} hari</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* PERFORMA */}
          <TabsContent value="performa" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pendapatan per Penempatan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {PLACEMENT_OPTIONS.map(p => {
                    const placementAds = ads.filter(a => a.placement_type === p.value && a.status !== 'rejected');
                    const rev = placementAds.reduce((s, a) => s + a.payment_amount, 0);
                    return (
                      <div key={p.value} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{p.label}</span>
                        <span className="font-bold">{formatPrice(rev)}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Statistik Keseluruhan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: 'Total Iklan Masuk', value: ads.length },
                    { label: 'Disetujui', value: ads.filter(a => a.status !== 'pending').length },
                    { label: 'Ditolak', value: ads.filter(a => a.status === 'rejected').length },
                    { label: 'Sedang Aktif', value: activeAds.length },
                    { label: 'Total Impresi', value: totalViews.toLocaleString() },
                    { label: 'Total Klik', value: totalClicks.toLocaleString() },
                    { label: 'Rata-rata CTR', value: `${totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : 0}%` },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-bold">{item.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top Merchant Pengiklan</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const merchantMap: Record<string, { name: string; total: number; count: number }> = {};
                    for (const ad of ads.filter(a => a.status !== 'rejected')) {
                      const key = ad.merchant_id;
                      if (!merchantMap[key]) merchantMap[key] = { name: ad.merchant?.name || '-', total: 0, count: 0 };
                      merchantMap[key].total += ad.payment_amount;
                      merchantMap[key].count++;
                    }
                    const sorted = Object.values(merchantMap).sort((a, b) => b.total - a.total).slice(0, 5);
                    return sorted.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada data</p>
                    ) : (
                      <div className="space-y-2">
                        {sorted.map((m, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <div>
                              <p className="font-medium text-xs">{m.name}</p>
                              <p className="text-xs text-muted-foreground">{m.count} iklan</p>
                            </div>
                            <span className="font-bold text-xs">{formatPrice(m.total)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Reject Dialog */}
        <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                Tolak Iklan
              </DialogTitle>
            </DialogHeader>
            {rejectTarget && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium">{rejectTarget.title}</p>
                  <p className="text-muted-foreground">{rejectTarget.merchant?.name} • {formatPrice(rejectTarget.payment_amount)}</p>
                </div>
                <div>
                  <Label>Alasan Penolakan <span className="text-destructive">*</span></Label>
                  <Textarea
                    className="mt-1"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Berikan alasan penolakan yang jelas..."
                    rows={4}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialog(false)}>Batal</Button>
              <Button
                variant="destructive"
                onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Menolak...' : 'Tolak Iklan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Package Dialog */}
        <Dialog open={pkgDialog} onOpenChange={setPkgDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPkg ? 'Edit Paket' : 'Tambah Paket Iklan'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nama Paket</Label>
                <Input className="mt-1" value={pkgForm.name || ''} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label>Jenis Penempatan</Label>
                <Select value={pkgForm.placement_type || 'search_top'} onValueChange={v => setPkgForm(p => ({ ...p, placement_type: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACEMENT_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Deskripsi</Label>
                <Textarea className="mt-1" value={pkgForm.description || ''} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Harga per Hari (Rp)</Label>
                  <Input className="mt-1" type="number" value={pkgForm.price_per_day || 0} onChange={e => setPkgForm(p => ({ ...p, price_per_day: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Maks. Hari</Label>
                  <Input className="mt-1" type="number" value={pkgForm.max_days || 30} onChange={e => setPkgForm(p => ({ ...p, max_days: parseInt(e.target.value) || 30 }))} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Aktif</Label>
                <Switch checked={!!pkgForm.is_active} onCheckedChange={v => setPkgForm(p => ({ ...p, is_active: v }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPkgDialog(false)}>Batal</Button>
              <Button onClick={() => savePkgMutation.mutate()} disabled={savePkgMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {savePkgMutation.isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Proof Image Dialog */}
        <Dialog open={!!proofDialog} onOpenChange={() => setProofDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Bukti Pembayaran</DialogTitle>
            </DialogHeader>
            {proofDialog && (
              <img src={proofDialog} alt="Bukti Pembayaran" className="w-full rounded-lg" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
