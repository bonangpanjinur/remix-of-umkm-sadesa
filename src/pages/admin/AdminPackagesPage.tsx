import { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Info, CreditCard, Check, X, Eye, Upload } from 'lucide-react';
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
  account_number: string;
  account_name: string;
  qris_url: string;
}

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<TransactionPackage[]>([]);
  const [requests, setRequests] = useState<PackageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<TransactionPackage | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<PackageRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    classification_price: 'medium',
    price_per_transaction: 50000,
    group_commission_percent: 10,
    transaction_quota: 100,
    validity_days: 30,
    description: '',
    is_active: true,
  });

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    bank_name: '',
    account_number: '',
    account_name: '',
    qris_url: '',
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
          merchant:merchants(name),
          package:transaction_packages(name, transaction_quota)
        `)
        .order('created_at', { ascending: false });

      if (reqError) throw reqError;
      setRequests((reqData || []) as any[]);

      // Fetch payment settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'payment_settings')
        .maybeSingle();
      
      if (settingsData) {
        setPaymentSettings(settingsData.value as PaymentSettings);
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

  const handleSubmit = async () => {
    try {
      if (editingPackage) {
        const { error } = await supabase
          .from('transaction_packages')
          .update(formData)
          .eq('id', editingPackage.id);

        if (error) throw error;
        toast.success('Paket berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('transaction_packages')
          .insert(formData);

        if (error) throw error;
        toast.success('Paket berhasil ditambahkan');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error('Gagal menyimpan paket');
    }
  };

  const handleDelete = async (id: string) => {
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

  const handleUpdateSettings = async () => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'payment_settings',
          value: paymentSettings,
          category: 'payment',
          description: 'Pengaturan pembayaran untuk pembelian paket'
        }, { onConflict: 'key' });

      if (error) throw error;
      toast.success('Pengaturan pembayaran berhasil diperbarui');
      setSettingsDialogOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Gagal menyimpan pengaturan');
    }
  };

  const handleApproveRequest = async (request: PackageRequest) => {
    try {
      // Update subscription status to PAID and ACTIVE
      // The DB trigger on_subscription_activation will handle merchant's current_subscription_id
      const { error: subError } = await supabase
        .from('merchant_subscriptions')
        .update({
          status: 'ACTIVE',
          payment_status: 'PAID',
          paid_at: new Date().toISOString(),
          admin_notes: adminNotes
        })
        .eq('id', request.id);

      if (subError) throw subError;

      toast.success('Permintaan paket berhasil disetujui. Kuota telah diaktifkan.');
      setRequestDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Gagal menyetujui permintaan');
    }
  };

  const handleRejectRequest = async (request: PackageRequest) => {
    if (!adminNotes) {
      toast.error('Silakan masukkan alasan penolakan di catatan admin');
      return;
    }

    try {
      const { error } = await supabase
        .from('merchant_subscriptions')
        .update({
          status: 'INACTIVE',
          payment_status: 'REJECTED',
          admin_notes: adminNotes
        })
        .eq('id', request.id);

      if (error) throw error;

      toast.success('Permintaan paket berhasil ditolak');
      setRequestDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Gagal menolak permintaan');
    }
  };

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

      const { data: { publicUrl } } = supabase.storage
        .from('merchants')
        .getPublicUrl(filePath);

      setPaymentSettings({ ...paymentSettings, qris_url: publicUrl });
      toast.success('QRIS berhasil diunggah');
    } catch (error) {
      console.error('Error uploading QRIS:', error);
      toast.error('Gagal mengunggah QRIS');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (pkg: TransactionPackage) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      classification_price: (pkg as any).classification_price || 'medium',
      price_per_transaction: pkg.price_per_transaction,
      group_commission_percent: pkg.group_commission_percent,
      transaction_quota: pkg.transaction_quota,
      validity_days: pkg.validity_days,
      description: pkg.description || '',
      is_active: pkg.is_active,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPackage(null);
    setFormData({
      name: '',
      classification_price: 'medium',
      price_per_transaction: 50000,
      group_commission_percent: 10,
      transaction_quota: 100,
      validity_days: 30,
      description: '',
      is_active: true,
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
    <AdminLayout title="Manajemen Paket" subtitle="Kelola paket transaksi dan permintaan dari merchant">
      <Tabs defaultValue="packages" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="packages" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Paket Transaksi
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Permintaan Beli Paket
            {requests.filter(r => r.payment_status === 'PENDING_APPROVAL').length > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center ml-1">
                {requests.filter(r => r.payment_status === 'PENDING_APPROVAL').length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="packages">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-muted-foreground text-sm">
                {packages.length} paket tersedia
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSettingsDialogOpen(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Pengaturan Pembayaran
              </Button>
              <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Paket
              </Button>
            </div>
          </div>

          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle>Sinkronisasi Harga</AlertTitle>
            <AlertDescription>
              Harga yang diatur di sini akan otomatis tampil di sisi merchant. 
              Pastikan harga paket sudah sesuai sebelum diaktifkan.
            </AlertDescription>
          </Alert>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <Card key={pkg.id} className={!pkg.is_active ? 'opacity-60' : 'border-primary/10'}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{pkg.name}</CardTitle>
                        <CardDescription>Paket Kuota Transaksi</CardDescription>
                      </div>
                      <Badge variant={pkg.is_active ? "success" : "secondary"}>
                        {pkg.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Harga Paket</span>
                        <span className="font-bold text-primary">{formatPrice(pkg.price_per_transaction)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Kredit</span>
                        <span className="font-bold">{pkg.transaction_quota} Kredit</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Komisi Kelompok</span>
                        <span className="font-bold">{pkg.group_commission_percent}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Masa Aktif</span>
                        <span className="font-medium">{pkg.validity_days === 0 ? 'Selamanya' : `${pkg.validity_days} hari`}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(pkg)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/5" onClick={() => handleDelete(pkg.id)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Hapus
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">Tanggal</th>
                    <th className="text-left p-4 font-medium">Merchant</th>
                    <th className="text-left p-4 font-medium">Paket</th>
                    <th className="text-left p-4 font-medium">Total Bayar</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Belum ada permintaan pembelian paket.
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr key={req.id} className="border-b last:border-0">
                        <td className="p-4">{new Date(req.created_at).toLocaleDateString('id-ID')}</td>
                        <td className="p-4 font-medium">{req.merchant?.name || 'Unknown'}</td>
                        <td className="p-4">{req.package?.name}</td>
                        <td className="p-4 font-bold">{formatPrice(req.payment_amount)}</td>
                        <td className="p-4">{getPaymentStatusBadge(req.payment_status)}</td>
                        <td className="p-4">
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Package Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPackage ? 'Edit Paket' : 'Tambah Paket Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="name">Nama Paket *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Paket Pemula"
              />
            </div>
            <div>
              <Label htmlFor="price_per_transaction">Harga Paket (Rp) *</Label>
              <Input
                id="price_per_transaction"
                type="number"
                value={formData.price_per_transaction}
                onChange={(e) => setFormData({ ...formData, price_per_transaction: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="transaction_quota">Total Kredit *</Label>
              <Input
                id="transaction_quota"
                type="number"
                value={formData.transaction_quota}
                onChange={(e) => setFormData({ ...formData, transaction_quota: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="group_commission_percent">Komisi Kelompok (%)</Label>
              <Input
                id="group_commission_percent"
                type="number"
                step="0.01"
                value={formData.group_commission_percent}
                onChange={(e) => setFormData({ ...formData, group_commission_percent: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="validity_days">Masa Aktif (hari)</Label>
              <Input
                id="validity_days"
                type="number"
                value={formData.validity_days}
                onChange={(e) => setFormData({ ...formData, validity_days: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label htmlFor="is_active">Paket Aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pengaturan Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="bank_name">Nama Bank</Label>
              <Input
                id="bank_name"
                value={paymentSettings.bank_name}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_name: e.target.value })}
                placeholder="Contoh: BCA"
              />
            </div>
            <div>
              <Label htmlFor="account_number">Nomor Rekening</Label>
              <Input
                id="account_number"
                value={paymentSettings.account_number}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, account_number: e.target.value })}
                placeholder="1234567890"
              />
            </div>
            <div>
              <Label htmlFor="account_name">Atas Nama</Label>
              <Input
                id="account_name"
                value={paymentSettings.account_name}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, account_name: e.target.value })}
                placeholder="Admin Desa Digital"
              />
            </div>
            <div>
              <Label htmlFor="qris">Upload QRIS</Label>
              <div className="flex items-center gap-4">
                <Input 
                  id="qris" 
                  type="file" 
                  accept="image/*" 
                  onChange={handleQRISUpload}
                  disabled={uploading}
                />
                {uploading && <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />}
              </div>
              {paymentSettings.qris_url && (
                <div className="mt-2 p-2 border rounded bg-muted flex justify-center">
                  <img src={paymentSettings.qris_url} alt="QRIS" className="h-32 object-contain" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateSettings}>Simpan Pengaturan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Detail Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Permintaan Paket</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Merchant:</span>
                <span className="font-medium">{selectedRequest.merchant?.name}</span>
                <span className="text-muted-foreground">Paket:</span>
                <span className="font-medium">{selectedRequest.package?.name}</span>
                <span className="text-muted-foreground">Total Bayar:</span>
                <span className="font-bold text-primary">{formatPrice(selectedRequest.payment_amount)}</span>
                <span className="text-muted-foreground">Status:</span>
                <span>{getPaymentStatusBadge(selectedRequest.payment_status)}</span>
              </div>

              {selectedRequest.payment_proof_url ? (
                <div className="space-y-2">
                  <Label>Bukti Pembayaran:</Label>
                  <a href={selectedRequest.payment_proof_url} target="_blank" rel="noreferrer" className="block border rounded-lg overflow-hidden hover:opacity-90 transition-opacity">
                    <img src={selectedRequest.payment_proof_url} alt="Bukti Pembayaran" className="w-full h-auto max-h-60 object-contain bg-black/5" />
                    <div className="p-2 text-center text-xs bg-muted text-muted-foreground">Klik untuk memperbesar</div>
                  </a>
                </div>
              ) : (
                <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground text-sm">
                  Belum ada bukti pembayaran diunggah
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Catatan Admin (Alasan tolak/info tambahan)</Label>
                <Textarea 
                  id="notes" 
                  value={adminNotes} 
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Masukkan alasan jika menolak..."
                  rows={2}
                />
              </div>

              {selectedRequest.payment_status === 'PENDING_APPROVAL' && (
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 text-destructive" onClick={() => handleRejectRequest(selectedRequest)}>
                    <X className="h-4 w-4 mr-2" />
                    Tolak
                  </Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleApproveRequest(selectedRequest)}>
                    <Check className="h-4 w-4 mr-2" />
                    Setujui & Aktifkan
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
