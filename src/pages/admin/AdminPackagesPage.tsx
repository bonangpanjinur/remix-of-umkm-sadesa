import { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Info, CreditCard, Check, X, Eye, Upload, ExternalLink } from 'lucide-react';
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
  const [processing, setProcessing] = useState(false);
  
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
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('approve_quota_subscription', {
        p_subscription_id: request.id,
        p_admin_notes: adminNotes
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success(data.message);
        setRequestDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.message);
      }
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
      const { data, error } = await supabase.rpc('reject_quota_subscription', {
        p_subscription_id: request.id,
        p_admin_notes: adminNotes
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        setRequestDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Gagal menolak permintaan');
    } finally {
      setProcessing(false);
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
    <AdminLayout title="Paket Transaksi" subtitle="Kelola paket kuota transaksi dan verifikasi pembayaran">
      <div className="space-y-6">
        <Tabs defaultValue="requests">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="requests">Permintaan Paket</TabsTrigger>
            <TabsTrigger value="packages">Daftar Paket</TabsTrigger>
          </TabsList>

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
                <CardDescription>Verifikasi pembayaran dari merchant untuk aktivasi kuota</CardDescription>
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

          <TabsContent value="packages" className="space-y-4 pt-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Paket Tersedia</h3>
              <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
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
                        <span className="font-medium">{pkg.transaction_quota} Transaksi</span>
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
                  <CardFooter className="pt-2 flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(pkg)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(pkg.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog Add/Edit Package */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPackage ? 'Edit Paket' : 'Tambah Paket Baru'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Paket</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Paket UMKM Hemat"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quota">Kuota Transaksi</Label>
                  <Input 
                    id="quota" 
                    type="number"
                    value={formData.transaction_quota} 
                    onChange={(e) => setFormData({ ...formData, transaction_quota: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Harga Paket (Rp)</Label>
                  <Input 
                    id="price" 
                    type="number"
                    value={formData.price_per_transaction} 
                    onChange={(e) => setFormData({ ...formData, price_per_transaction: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="validity">Masa Aktif (Hari)</Label>
                  <Input 
                    id="validity" 
                    type="number"
                    value={formData.validity_days} 
                    onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission">Komisi Kas (%)</Label>
                  <Input 
                    id="commission" 
                    type="number"
                    value={formData.group_commission_percent} 
                    onChange={(e) => setFormData({ ...formData, group_commission_percent: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea 
                  id="description" 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="active" 
                  checked={formData.is_active} 
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="active">Paket Aktif</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button onClick={handleSubmit}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Request Detail */}
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
                    <p className="text-sm text-muted-foreground">{selectedRequest.package?.transaction_quota} Kuota Transaksi</p>
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
                <div className="space-y-4">
                  <Label className="text-muted-foreground">Bukti Pembayaran</Label>
                  <div className="border rounded-lg overflow-hidden bg-secondary/20 aspect-[3/4] flex items-center justify-center relative group">
                    {selectedRequest.payment_proof_url ? (
                      <>
                        <img 
                          src={selectedRequest.payment_proof_url} 
                          alt="Bukti Pembayaran" 
                          className="w-full h-full object-contain"
                        />
                        <a 
                          href={selectedRequest.payment_proof_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <Button variant="secondary" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Buka Gambar
                          </Button>
                        </a>
                      </>
                    ) : (
                      <div className="text-center p-6 text-muted-foreground">
                        <Info className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>Belum ada bukti pembayaran yang diunggah</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="flex justify-between items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Status: {selectedRequest && getPaymentStatusBadge(selectedRequest.payment_status)}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => selectedRequest && handleRejectRequest(selectedRequest)}
                  disabled={processing || !selectedRequest || selectedRequest.payment_status === 'PAID' || selectedRequest.payment_status === 'REJECTED'}
                >
                  <X className="h-4 w-4 mr-1" />
                  Tolak
                </Button>
                <Button 
                  onClick={() => selectedRequest && handleApproveRequest(selectedRequest)}
                  disabled={processing || !selectedRequest || selectedRequest.payment_status === 'PAID' || selectedRequest.payment_status === 'REJECTED'}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Setujui & Aktifkan
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Payment Settings */}
        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pengaturan Pembayaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Nama Bank</Label>
                <Input 
                  id="bankName" 
                  value={paymentSettings.bank_name} 
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accNumber">Nomor Rekening</Label>
                <Input 
                  id="accNumber" 
                  value={paymentSettings.account_number} 
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, account_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accName">Nama Pemilik Rekening</Label>
                <Input 
                  id="accName" 
                  value={paymentSettings.account_name} 
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, account_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>QRIS (Opsional)</Label>
                <div className="flex items-center gap-4">
                  {paymentSettings.qris_url && (
                    <div className="h-16 w-16 border rounded overflow-hidden">
                      <img src={paymentSettings.qris_url} alt="QRIS" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input type="file" accept="image/*" onChange={handleQRISUpload} disabled={uploading} />
                  </div>
                </div>
              </div>
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

function CardFooter({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`p-6 pt-0 ${className}`}>
      {children}
    </div>
  );
}
