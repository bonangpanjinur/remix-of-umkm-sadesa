import { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  Info, 
  CreditCard, 
  Check, 
  X, 
  Eye, 
  ExternalLink, 
  Settings, 
  Save, 
  Edit2 
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';

interface TransactionPackage {
  id: string;
  name: string;
  price_per_transaction: number;
  group_commission_percent: number;
  transaction_quota: number;
  validity_days: number;
  description: string | null;
  is_active: boolean;
}

interface PackageRequest {
  id: string;
  merchant_id: string;
  package_id: string;
  payment_status: string;
  payment_amount: number;
  payment_proof_url: string | null;
  status: string;
  created_at: string;
  admin_notes: string | null;
  merchant: {
    name: string;
  };
  package: {
    name: string;
    transaction_quota: number;
  };
}

interface PaymentSettings {
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  qris_image_url: string;
}

interface QuotaTier {
  id: string;
  min_price: number;
  max_price: number | null;
  credit_cost: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export default function AdminTransactionQuotaPage() {
  const [packages, setPackages] = useState<TransactionPackage[]>([]);
  const [requests, setRequests] = useState<PackageRequest[]>([]);
  const [tiers, setTiers] = useState<QuotaTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<TransactionPackage | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<PackageRequest | null>(null);
  const [editingTier, setEditingTier] = useState<QuotaTier | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [packageFormData, setPackageFormData] = useState({
    name: '',
    price_per_transaction: 50000,
    group_commission_percent: 10,
    transaction_quota: 100,
    validity_days: 30,
    description: '',
    is_active: true,
  });

  const [tierFormData, setTierFormData] = useState({
    min_price: 0,
    max_price: '',
    credit_cost: 1,
    description: ''
  });

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    bank_name: '',
    bank_account_number: '',
    bank_account_name: '',
    qris_image_url: '',
  });

  const [uploading, setUploading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch packages
      const { data: pkgData, error: pkgError } = await supabase
        .from('transaction_packages')
        .select('*')
        .order('transaction_quota', { ascending: true });

      if (pkgError) throw pkgError;
      setPackages((pkgData || []) as TransactionPackage[]);

      // Fetch requests
      const { data: reqData, error: reqError } = await supabase
        .from('merchant_subscriptions')
        .select(`
          *,
          merchant:merchants!merchant_subscriptions_merchant_id_fkey(name),
          package:transaction_packages!merchant_subscriptions_package_id_fkey(name, transaction_quota)
        `)
        .order('created_at', { ascending: false });

      if (reqError) throw reqError;
      
      setRequests((reqData || []) as any[]);

      // Fetch tiers
      const { data: tierData, error: tierError } = await supabase
        .from('quota_tiers')
        .select('*')
        .order('sort_order', { ascending: true });

      if (tierError) throw tierError;
      setTiers(tierData || []);

      // Fetch payment settings from main admin settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'admin_payment_info')
        .maybeSingle();
      
      if (settingsData) {
        setPaymentSettings(settingsData.value as unknown as PaymentSettings);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Package handlers
  const handlePackageSubmit = async () => {
    try {
      if (editingPackage) {
        const { error } = await supabase
          .from('transaction_packages')
          .update(packageFormData)
          .eq('id', editingPackage.id);

        if (error) throw error;
        toast.success('Paket berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('transaction_packages')
          .insert({
            ...packageFormData,
            classification_price: 'CUSTOM',
          } as any);

        if (error) throw error;
        toast.success('Paket berhasil ditambahkan');
      }

      setDialogOpen(false);
      resetPackageForm();
      fetchData();
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error('Gagal menyimpan paket');
    }
  };

  const handlePackageDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus paket ini?')) return;

    try {
      const { error } = await supabase
        .from('transaction_packages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Paket berhasil dihapus');
      fetchData();
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error('Gagal menghapus paket. Mungkin masih digunakan oleh merchant.');
    }
  };

  // Tier handlers
  const handleTierSubmit = async () => {
    setProcessing(true);
    try {
      const data = {
        min_price: tierFormData.min_price,
        max_price: tierFormData.max_price ? parseInt(tierFormData.max_price) : null,
        credit_cost: tierFormData.credit_cost,
        description: tierFormData.description || null,
        is_active: true
      };

      if (editingTier) {
        const { error } = await supabase
          .from('quota_tiers')
          .update(data)
          .eq('id', editingTier.id);

        if (error) throw error;
        toast.success('Tier kuota berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('quota_tiers')
          .insert({
            ...data,
            sort_order: tiers.length + 1
          });

        if (error) throw error;
        toast.success('Tier kuota berhasil ditambahkan');
      }
      
      setTierDialogOpen(false);
      resetTierForm();
      fetchData();
    } catch (error) {
      console.error('Error saving tier:', error);
      toast.error('Gagal menyimpan tier kuota');
    } finally {
      setProcessing(false);
    }
  };

  const handleTierDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus tier ini?')) return;
    
    try {
      const { error } = await supabase
        .from('quota_tiers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Tier kuota berhasil dihapus');
      fetchData();
    } catch (error) {
      console.error('Error deleting tier:', error);
      toast.error('Gagal menghapus tier kuota');
    }
  };

  // Request handlers
  const handleApproveRequest = async (request: PackageRequest) => {
    setProcessing(true);
    try {
      // 1. Check if merchant already has an active subscription
      const { data: activeSubs } = await supabase
        .from('merchant_subscriptions')
        .select('id, transaction_quota, used_quota')
        .eq('merchant_id', request.merchant_id)
        .eq('status', 'ACTIVE')
        .gt('expired_at', new Date().toISOString())
        .order('expired_at', { ascending: false })
        .limit(1);

      let accumulatedQuota = request.package?.transaction_quota || 0;

      if (activeSubs && activeSubs.length > 0) {
        const activeSub = activeSubs[0];
        const remainingQuota = activeSub.transaction_quota - activeSub.used_quota;
        
        // Accumulate remaining quota from old subscription
        if (remainingQuota > 0) {
          accumulatedQuota += remainingQuota;
        }

        // Mark old subscription as COMPLETED
        await supabase
          .from('merchant_subscriptions')
          .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
          .eq('id', activeSub.id);
      }

      // 2. Activate the new subscription with accumulated quota
      const { error } = await supabase
        .from('merchant_subscriptions')
        .update({
          status: 'ACTIVE',
          payment_status: 'PAID',
          paid_at: new Date().toISOString(),
          transaction_quota: accumulatedQuota,
          used_quota: 0,
        })
        .eq('id', request.id);

      if (error) throw error;

      // 3. Update merchant's current_subscription_id
      await supabase
        .from('merchants')
        .update({
          current_subscription_id: request.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.merchant_id);
      
      toast.success(`Permintaan disetujui. Kuota aktif: ${accumulatedQuota} kredit`);
      setRequestDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Gagal menyetujui permintaan');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectRequest = async (request: PackageRequest) => {
    if (!adminNotes) {
      toast.error('Silakan masukkan alasan penolakan di catatan admin');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('merchant_subscriptions')
        .update({
          status: 'INACTIVE',
          payment_status: 'REJECTED',
        })
        .eq('id', request.id);

      if (error) throw error;

      toast.success('Permintaan berhasil ditolak');
      setRequestDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Gagal menolak permintaan');
    } finally {
      setProcessing(false);
    }
  };

  // Utility functions
  const handleQRISUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `admin/qris-${Math.random()}.${fileExt}`;
      const filePath = `settings/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('merchants')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('merchants')
        .getPublicUrl(filePath);
      
      const publicUrl = data.publicUrl;

      setPaymentSettings({ ...paymentSettings, qris_image_url: publicUrl });
      toast.success('QRIS berhasil diunggah');
    } catch (error) {
      console.error('Error uploading QRIS:', error);
      toast.error('Gagal mengunggah QRIS');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      // Save to admin_payment_info (main settings)
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'admin_payment_info')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({
            value: paymentSettings as unknown as import('@/integrations/supabase/types').Json,
          })
          .eq('key', 'admin_payment_info');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({
            key: 'admin_payment_info',
            value: paymentSettings as unknown as import('@/integrations/supabase/types').Json,
            category: 'payment',
            description: 'Rekening & QRIS default admin untuk pembayaran'
          });
        if (error) throw error;
      }

      toast.success('Pengaturan pembayaran berhasil diperbarui');
      setSettingsDialogOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Gagal menyimpan pengaturan');
    }
  };

  const resetPackageForm = () => {
    setEditingPackage(null);
    setPackageFormData({
      name: '',
      price_per_transaction: 50000,
      group_commission_percent: 10,
      transaction_quota: 100,
      validity_days: 30,
      description: '',
      is_active: true,
    });
  };

  const resetTierForm = () => {
    setEditingTier(null);
    setTierFormData({
      min_price: 0,
      max_price: '',
      credit_cost: 1,
      description: ''
    });
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge className="bg-green-100 text-green-700">Lunas</Badge>;
      case 'PENDING_APPROVAL':
        return <Badge className="bg-yellow-100 text-yellow-700">Menunggu Verifikasi</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-700">Ditolak</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700">Belum Bayar</Badge>;
    }
  };

  return (
    <AdminLayout title="Paket Kuota" subtitle="Kelola paket, pengaturan kuota, dan verifikasi permintaan">
      <div className="space-y-6">
        <Tabs defaultValue="requests">
          <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
            <TabsTrigger value="requests">Manajemen Permintaan</TabsTrigger>
            <TabsTrigger value="packages">Paket Kuota</TabsTrigger>
            <TabsTrigger value="tiers">Pengaturan Kuota</TabsTrigger>
          </TabsList>

          {/* TAB: REQUESTS */}
          <TabsContent value="requests" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Pengaturan Pembayaran
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Daftar Permintaan Paket</CardTitle>
                <CardDescription>Verifikasi bukti pembayaran dari merchant untuk aktivasi kuota</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : requests.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    Belum ada permintaan paket
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4">Tanggal</th>
                          <th className="text-left py-3 px-4">Merchant</th>
                          <th className="text-left py-3 px-4">Paket</th>
                          <th className="text-left py-3 px-4">Jumlah</th>
                          <th className="text-left py-3 px-4">Status</th>
                          <th className="text-right py-3 px-4">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map((req) => (
                          <tr key={req.id} className="border-b hover:bg-secondary/20">
                            <td className="py-3 px-4">{new Date(req.created_at).toLocaleDateString('id-ID')}</td>
                            <td className="py-3 px-4 font-medium">{req.merchant?.name}</td>
                            <td className="py-3 px-4">{req.package?.name} ({req.package?.transaction_quota} Kuota)</td>
                            <td className="py-3 px-4">{formatPrice(req.payment_amount)}</td>
                            <td className="py-3 px-4">{getPaymentStatusBadge(req.payment_status)}</td>
                            <td className="py-3 px-4 text-right">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setAdminNotes(req.admin_notes || '');
                                  setRequestDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Detail
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: PACKAGES */}
          <TabsContent value="packages" className="space-y-4 pt-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Daftar Paket Tersedia</h3>
              <Button onClick={() => { resetPackageForm(); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Paket
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <Card key={pkg.id} className={!pkg.is_active ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                        {pkg.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                    <CardDescription>{pkg.description || 'Tidak ada deskripsi'}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Kuota:</span>
                        <span className="font-medium">{pkg.transaction_quota} Kredit</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Harga:</span>
                        <span className="font-medium">{formatPrice(pkg.price_per_transaction)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Masa Aktif:</span>
                        <span className="font-medium">{pkg.validity_days} Hari</span>
                      </div>
                    </div>
                  </CardContent>
                  <div className="p-6 pt-0 flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditingPackage(pkg);
                      setPackageFormData({
                        name: pkg.name,
                        price_per_transaction: pkg.price_per_transaction,
                        group_commission_percent: pkg.group_commission_percent,
                        transaction_quota: pkg.transaction_quota,
                        validity_days: pkg.validity_days,
                        description: pkg.description || '',
                        is_active: pkg.is_active,
                      });
                      setDialogOpen(true);
                    }}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handlePackageDelete(pkg.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB: TIERS */}
          <TabsContent value="tiers" className="space-y-4 pt-4">
            <Alert className="border-primary/20 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertTitle>Informasi</AlertTitle>
              <AlertDescription>
                Tier kuota menentukan berapa kuota yang dihabiskan untuk setiap transaksi berdasarkan rentang harga produk.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tier Biaya Kuota</CardTitle>
                    <CardDescription>Biaya kuota yang dipotong berdasarkan rentang harga produk</CardDescription>
                  </div>
                  <Button onClick={() => { resetTierForm(); setTierDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Tier
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tiers.map((tier, index) => (
                    <div key={tier.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
                      <div>
                        <p className="font-medium">Tier {index + 1}: {tier.description || 'Tanpa Deskripsi'}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(tier.min_price)} - {tier.max_price ? formatPrice(tier.max_price) : 'Tak terbatas'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-primary">{tier.credit_cost} Kuota</p>
                          <p className="text-xs text-muted-foreground">per transaksi</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => {
                            setEditingTier(tier);
                            setTierFormData({
                              min_price: tier.min_price,
                              max_price: tier.max_price?.toString() || '',
                              credit_cost: tier.credit_cost,
                              description: tier.description || ''
                            });
                            setTierDialogOpen(true);
                          }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleTierDelete(tier.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIALOGS */}
        
        {/* Package Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPackage ? 'Edit Paket' : 'Tambah Paket Baru'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="pkg-name">Nama Paket</Label>
                <Input id="pkg-name" value={packageFormData.name} onChange={(e) => setPackageFormData({ ...packageFormData, name: e.target.value })} placeholder="Contoh: Paket Hemat" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pkg-quota">Jumlah Kuota</Label>
                  <Input id="pkg-quota" type="number" value={packageFormData.transaction_quota} onChange={(e) => setPackageFormData({ ...packageFormData, transaction_quota: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pkg-price">Harga Paket (Rp)</Label>
                  <Input id="pkg-price" type="number" value={packageFormData.price_per_transaction} onChange={(e) => setPackageFormData({ ...packageFormData, price_per_transaction: parseInt(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pkg-validity">Masa Aktif (Hari)</Label>
                  <Input id="pkg-validity" type="number" value={packageFormData.validity_days} onChange={(e) => setPackageFormData({ ...packageFormData, validity_days: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pkg-commission">Komisi Kas (%)</Label>
                  <Input id="pkg-commission" type="number" value={packageFormData.group_commission_percent} onChange={(e) => setPackageFormData({ ...packageFormData, group_commission_percent: parseInt(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-desc">Deskripsi</Label>
                <Textarea id="pkg-desc" value={packageFormData.description} onChange={(e) => setPackageFormData({ ...packageFormData, description: e.target.value })} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="pkg-active" checked={packageFormData.is_active} onCheckedChange={(checked) => setPackageFormData({ ...packageFormData, is_active: checked })} />
                <Label htmlFor="pkg-active">Paket Aktif</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button onClick={handlePackageSubmit}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tier Dialog */}
        <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTier ? 'Edit Tier Kuota' : 'Tambah Tier Kuota'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Harga Minimal (Rp)</Label>
                  <Input type="number" value={tierFormData.min_price} onChange={(e) => setTierFormData({ ...tierFormData, min_price: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Harga Maksimal (Rp)</Label>
                  <Input type="number" value={tierFormData.max_price} onChange={(e) => setTierFormData({ ...tierFormData, max_price: e.target.value })} placeholder="Tak terbatas" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Jumlah Kuota yang Dihabiskan</Label>
                <Input type="number" min={1} value={tierFormData.credit_cost} onChange={(e) => setTierFormData({ ...tierFormData, credit_cost: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Input value={tierFormData.description} onChange={(e) => setTierFormData({ ...tierFormData, description: e.target.value })} placeholder="Contoh: Produk harga rendah" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTierDialogOpen(false)}>Batal</Button>
              <Button onClick={handleTierSubmit} disabled={processing}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request Detail Dialog */}
        <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detail Permintaan Paket</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Merchant</Label>
                    <p className="font-medium text-lg">{selectedRequest.merchant?.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Paket yang Dibeli</Label>
                    <p className="font-medium">{selectedRequest.package?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedRequest.package?.transaction_quota} Kuota</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Jumlah Pembayaran</Label>
                    <p className="font-bold text-primary text-xl">{formatPrice(selectedRequest.payment_amount)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminNotes">Catatan Admin (Wajib jika ditolak)</Label>
                    <Textarea 
                      id="adminNotes"
                      placeholder="Masukkan catatan atau alasan penolakan..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Bukti Pembayaran</Label>
                  <div className="border rounded-lg overflow-hidden bg-secondary/20 aspect-[3/4] flex items-center justify-center relative group">
                    {selectedRequest.payment_proof_url ? (
                      <>
                        <img src={selectedRequest.payment_proof_url} alt="Bukti Pembayaran" className="w-full h-full object-contain" />
                        <a href={selectedRequest.payment_proof_url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Button variant="secondary" size="sm"><ExternalLink className="h-4 w-4 mr-2" />Buka Gambar</Button>
                        </a>
                      </>
                    ) : (
                      <div className="text-center p-6 text-muted-foreground"><Info className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>Belum ada bukti pembayaran</p></div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="flex justify-between items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">Status: {selectedRequest && getPaymentStatusBadge(selectedRequest.payment_status)}</div>
              <div className="flex gap-2">
                <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => selectedRequest && handleRejectRequest(selectedRequest)} disabled={processing || !selectedRequest || selectedRequest.payment_status === 'PAID' || selectedRequest.payment_status === 'REJECTED'}><X className="h-4 w-4 mr-1" />Tolak</Button>
                <Button onClick={() => selectedRequest && handleApproveRequest(selectedRequest)} disabled={processing || !selectedRequest || selectedRequest.payment_status === 'PAID' || selectedRequest.payment_status === 'REJECTED'}><Check className="h-4 w-4 mr-1" />Setujui & Aktifkan</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Settings Dialog */}
        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pengaturan Pembayaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Nama Bank</Label>
                <Input id="bankName" value={paymentSettings.bank_name} onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accNumber">Nomor Rekening</Label>
                <Input id="accNumber" value={paymentSettings.bank_account_number} onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_account_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accName">Nama Pemilik Rekening</Label>
                <Input id="accName" value={paymentSettings.bank_account_name} onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_account_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>QRIS (Opsional)</Label>
                <div className="flex items-center gap-4">
                  {paymentSettings.qris_image_url && (
                    <div className="h-16 w-16 border rounded overflow-hidden">
                      <img src={paymentSettings.qris_image_url} alt="QRIS" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input type="file" accept="image/*" onChange={handleQRISUpload} disabled={uploading} />
                  </div>
                </div>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Pengaturan ini sama dengan Rekening & QRIS Default di halaman Pengaturan Utama.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>Batal</Button>
              <Button onClick={handleUpdateSettings}>Simpan Pengaturan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
