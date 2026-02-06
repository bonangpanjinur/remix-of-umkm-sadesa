import { useState, useEffect, useRef } from 'react';
import { Package, CreditCard, AlertTriangle, Clock, TrendingUp, Upload, CheckCircle2, XCircle, Info, ExternalLink, X, FileCheck } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';

interface Subscription {
  id: string;
  transaction_quota: number;
  used_quota: number;
  started_at: string;
  expired_at: string;
  status: string;
  payment_status: string;
  payment_amount: number;
  payment_proof_url?: string;
  admin_notes?: string;
  created_at: string;
  package: {
    name: string;
    price_per_transaction: number;
    transaction_quota: number;
    validity_days: number;
    group_commission_percent: number;
  };
}

interface TransactionPackage {
  id: string;
  name: string;
  price_per_transaction: number;
  group_commission_percent: number;
  transaction_quota: number;
  validity_days: number;
  description: string | null;
}

interface PaymentSettings {
  bank_name: string;
  account_number: string;
  account_name: string;
  qris_url: string;
}

export default function MerchantSubscriptionPage() {
  const { user } = useAuth();
  const [merchant, setMerchant] = useState<{ id: string } | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState<Subscription[]>([]);
  const [availablePackages, setAvailablePackages] = useState<TransactionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<TransactionPackage | null>(null);
  const [pendingSubscription, setPendingSubscription] = useState<Subscription | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSubscriptionDetail, setSelectedSubscriptionDetail] = useState<Subscription | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Get merchant
      const { data: merchantData } = await supabase
        .from('merchants')
        .select('id, current_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!merchantData) {
        setLoading(false);
        return;
      }

      setMerchant(merchantData);

      // Get current active subscription
      if (merchantData.current_subscription_id) {
        const { data: subData } = await supabase
          .from('merchant_subscriptions')
          .select(`
            *,
            package:transaction_packages(name, price_per_transaction, transaction_quota, validity_days, group_commission_percent)
          `)
          .eq('id', merchantData.current_subscription_id)
          .maybeSingle();

        if (subData) {
          setCurrentSubscription({
            ...subData,
            package: subData.package as Subscription['package'],
          });
        }
      }

      // Get subscription history
      const { data: historyData } = await supabase
        .from('merchant_subscriptions')
        .select(`
          *,
          package:transaction_packages(name, price_per_transaction, transaction_quota, validity_days, group_commission_percent)
        `)
        .eq('merchant_id', merchantData.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setSubscriptionHistory(
        (historyData || []).map((s) => ({
          ...s,
          package: s.package as Subscription['package'],
        }))
      );

      // Get available packages
      const { data: packagesData } = await supabase
        .from('transaction_packages')
        .select('*')
        .eq('is_active', true)
        .order('transaction_quota', { ascending: true });
        
      setAvailablePackages((packagesData || []) as TransactionPackage[]);

      // Get payment settings
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
  }, [user]);

  const handleBuyPackage = async () => {
    if (!selectedPackage || !merchant) return;

    setPurchasing(true);
    try {
      let expiredAt = null;
      if (selectedPackage.validity_days > 0) {
        const date = new Date();
        date.setDate(date.getDate() + selectedPackage.validity_days);
        expiredAt = date.toISOString();
      } else {
        const date = new Date();
        date.setFullYear(date.getFullYear() + 100);
        expiredAt = date.toISOString();
      }

      const { data, error } = await supabase.from('merchant_subscriptions').insert({
        merchant_id: merchant.id,
        package_id: selectedPackage.id,
        transaction_quota: selectedPackage.transaction_quota,
        used_quota: 0,
        expired_at: expiredAt,
        status: 'INACTIVE',
        payment_status: 'UNPAID',
        payment_amount: selectedPackage.price_per_transaction,
      }).select(`
        *,
        package:transaction_packages(name, price_per_transaction, transaction_quota, validity_days, group_commission_percent)
      `).single();

      if (error) throw error;

      toast.success('Permintaan pembelian berhasil dibuat. Silakan lakukan pembayaran.');
      setBuyDialogOpen(false);
      setPendingSubscription(data as any);
      setPaymentDialogOpen(true);
      setPreviewImage(null);
      setSelectedFile(null);
      fetchData();
    } catch (error) {
      console.error('Error purchasing package:', error);
      toast.error('Gagal membuat permintaan pembelian');
    } finally {
      setPurchasing(false);
    }
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    if (file.size > maxSize) {
      return { valid: false, error: 'Ukuran file tidak boleh lebih dari 5MB' };
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Format file harus JPG, PNG, WebP, atau PDF' };
    }

    return { valid: true };
  };

  const handleFileSelect = (file: File) => {
    const validation = validateFile(file);
    
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileUpload = async (subId: string) => {
    if (!selectedFile || !merchant) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `payment-proofs/${merchant.id}/${subId}-${Math.random()}.${fileExt}`;
      const filePath = fileName;

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 30, 90));
      }, 200);

      const { error: uploadError } = await supabase.storage
        .from('merchants')
        .upload(filePath, selectedFile);

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      setUploadProgress(95);

      const { data: publicUrlData } = supabase.storage
        .from('merchants')
        .getPublicUrl(filePath);
      
      const publicUrl = publicUrlData.publicUrl;

      // Update subscription with proof URL and status
      const { error: updateError } = await supabase
        .from('merchant_subscriptions')
        .update({ 
          payment_proof_url: publicUrl,
          payment_status: 'PENDING_APPROVAL',
          updated_at: new Date().toISOString()
        })
        .eq('id', subId);

      if (updateError) throw updateError;

      setUploadProgress(100);
      
      setTimeout(() => {
        toast.success('Bukti pembayaran berhasil diunggah. Menunggu verifikasi admin.');
        setPaymentDialogOpen(false);
        setPreviewImage(null);
        setSelectedFile(null);
        setUploadProgress(0);
        fetchData();
      }, 500);
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error('Gagal mengunggah bukti pembayaran');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    setPreviewImage(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getQuotaPercentage = (used: number, total: number) => {
    if (total === 0) return 100;
    return Math.min(100, (used / total) * 100);
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

  const openDetailModal = (subscription: Subscription) => {
    setSelectedSubscriptionDetail(subscription);
    setDetailModalOpen(true);
  };

  if (loading) {
    return (
      <MerchantLayout title="Kuota Transaksi" subtitle="Kelola paket kuota transaksi Anda">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Kuota Transaksi" subtitle="Kelola paket kuota transaksi Anda">
      {/* Current Subscription Status */}
      {currentSubscription ? (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  {currentSubscription.package.name}
                </CardTitle>
                <CardDescription>
                  Paket aktif saat ini
                </CardDescription>
              </div>
              <Badge variant={currentSubscription.status === 'ACTIVE' ? 'default' : 'secondary'}>
                {currentSubscription.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Kuota Tersisa</p>
                <p className="text-2xl font-bold text-primary">
                  {currentSubscription.transaction_quota - currentSubscription.used_quota}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Kuota</p>
                <p className="text-2xl font-bold">{currentSubscription.transaction_quota}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Digunakan</p>
                <p className="text-2xl font-bold text-orange-600">{currentSubscription.used_quota}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Berakhir</p>
                <p className="text-sm font-bold">
                  {new Date(currentSubscription.expired_at).toLocaleDateString('id-ID')}
                </p>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium">Penggunaan Kuota</p>
                <p className="text-xs text-muted-foreground">
                  {getQuotaPercentage(currentSubscription.used_quota, currentSubscription.transaction_quota).toFixed(0)}%
                </p>
              </div>
              <Progress 
                value={getQuotaPercentage(currentSubscription.used_quota, currentSubscription.transaction_quota)} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6 border-dashed">
          <CardContent className="py-8">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">Anda belum memiliki paket kuota aktif</p>
              <Button onClick={() => setBuyDialogOpen(true)}>
                Beli Paket Kuota
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Packages */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Paket Kuota Tersedia
          </CardTitle>
          <CardDescription>
            Pilih paket yang sesuai dengan kebutuhan bisnis Anda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availablePackages.map((pkg) => (
              <Card key={pkg.id} className="border-2 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => {
                setSelectedPackage(pkg);
                setBuyDialogOpen(true);
              }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{pkg.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{pkg.transaction_quota} transaksi</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Harga Total</p>
                    <p className="text-2xl font-bold text-primary">{formatPrice(pkg.price_per_transaction)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Validitas</p>
                      <p className="font-medium">{pkg.validity_days} hari</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Komisi</p>
                      <p className="font-medium">{pkg.group_commission_percent}%</p>
                    </div>
                  </div>
                  <Button className="w-full" size="sm">Pilih Paket</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscription History */}
      {subscriptionHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Riwayat Pembelian
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Paket</th>
                    <th className="text-left py-3 px-2 font-medium">Kuota</th>
                    <th className="text-left py-3 px-2 font-medium">Harga</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-left py-3 px-2 font-medium">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionHistory.map((sub) => (
                    <tr key={sub.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => openDetailModal(sub)}>
                      <td className="py-3 px-2">{sub.package.name}</td>
                      <td className="py-3 px-2">{sub.transaction_quota}</td>
                      <td className="py-3 px-2">{formatPrice(sub.payment_amount)}</td>
                      <td className="py-3 px-2">{getPaymentStatusBadge(sub.payment_status)}</td>
                      <td className="py-3 px-2">{new Date(sub.created_at).toLocaleDateString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buy Package Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembelian Paket</DialogTitle>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-4">
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Paket Dipilih</p>
                <p className="text-lg font-bold">{selectedPackage.name}</p>
                <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Kuota Transaksi</p>
                    <p className="font-bold text-primary">{selectedPackage.transaction_quota}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Validitas</p>
                    <p className="font-bold">{selectedPackage.validity_days} hari</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm text-muted-foreground mb-1">Total Pembayaran</p>
                <p className="text-3xl font-bold text-green-600">{formatPrice(selectedPackage.price_per_transaction)}</p>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Setelah mengklik Lanjutkan, Anda akan diminta untuk mengunggah bukti pembayaran.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBuyDialogOpen(false)}>Batal</Button>
            <Button onClick={handleBuyPackage} disabled={purchasing}>
              {purchasing ? 'Memproses...' : 'Lanjutkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog - IMPROVED */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Detail Pembayaran & Bukti
            </DialogTitle>
          </DialogHeader>
          {pendingSubscription && (
            <div className="space-y-6">
              {/* Payment Amount */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground mb-2">Total yang harus dibayar</p>
                <p className="text-4xl font-bold text-primary">{formatPrice(pendingSubscription.payment_amount)}</p>
              </div>

              {/* Payment Methods */}
              {paymentSettings ? (
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Metode Pembayaran</h3>
                  
                  {/* Bank Transfer */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Transfer Bank</p>
                        <Badge variant="outline" className="mt-1">{paymentSettings.bank_name}</Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded border border-slate-200">
                        <p className="text-xs text-slate-600 mb-1">Nomor Rekening</p>
                        <p className="text-lg font-mono font-bold text-slate-900 tracking-wider">{paymentSettings.account_number}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Nama Penerima</p>
                        <p className="font-medium text-slate-900">{paymentSettings.account_name}</p>
                      </div>
                    </div>
                  </div>

                  {/* QRIS */}
                  {paymentSettings.qris_url && (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-sm font-medium text-slate-900 mb-3">Atau Scan QRIS</p>
                      <div className="flex justify-center bg-white p-4 rounded border border-slate-200">
                        <img src={paymentSettings.qris_url} alt="QRIS" className="w-40 h-40 object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Informasi rekening pembayaran belum tersedia. Silakan hubungi admin.
                  </AlertDescription>
                </Alert>
              )}

              {/* Rejection Alert */}
              {pendingSubscription.payment_status === 'REJECTED' && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Pembayaran Ditolak</AlertTitle>
                  <AlertDescription>
                    {pendingSubscription.admin_notes || 'Bukti pembayaran tidak valid. Silakan unggah ulang bukti yang benar.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Pending Alert */}
              {pendingSubscription.payment_status === 'PENDING_APPROVAL' && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800">Menunggu Verifikasi</AlertTitle>
                  <AlertDescription className="text-yellow-700">
                    Bukti pembayaran Anda sedang diverifikasi oleh admin. Proses ini biasanya memakan waktu 1-24 jam.
                  </AlertDescription>
                </Alert>
              )}

              {/* Payment Proof Upload Section */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm">Bukti Pembayaran</h3>
                
                {pendingSubscription.payment_proof_url && pendingSubscription.payment_status === 'PENDING_APPROVAL' ? (
                  // Show uploaded proof with success state
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <FileCheck className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-900">Bukti pembayaran berhasil diunggah</p>
                        <p className="text-xs text-green-700">Menunggu verifikasi admin</p>
                      </div>
                    </div>
                    <div className="relative aspect-video border-2 border-green-200 rounded-lg overflow-hidden bg-black/5 group">
                      <img 
                        src={pendingSubscription.payment_proof_url} 
                        alt="Bukti Bayar" 
                        className="w-full h-full object-contain"
                      />
                      <a 
                        href={pendingSubscription.payment_proof_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <Button variant="secondary" size="sm">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Lihat Full
                        </Button>
                      </a>
                    </div>
                  </div>
                ) : pendingSubscription.payment_proof_url ? (
                  // Show uploaded proof with option to replace
                  <div className="space-y-3">
                    <div className="relative aspect-video border-2 border-slate-200 rounded-lg overflow-hidden bg-black/5 group">
                      <img 
                        src={pendingSubscription.payment_proof_url} 
                        alt="Bukti Bayar" 
                        className="w-full h-full object-contain"
                      />
                      <a 
                        href={pendingSubscription.payment_proof_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <Button variant="secondary" size="sm">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Lihat Full
                        </Button>
                      </a>
                    </div>
                    {(pendingSubscription.payment_status === 'UNPAID' || pendingSubscription.payment_status === 'REJECTED') && (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground">Ingin mengganti bukti pembayaran?</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Pilih File Lain
                        </Button>
                      </div>
                    )}
                  </div>
                ) : previewImage ? (
                  // Show preview before upload
                  <div className="space-y-4">
                    <div className="relative aspect-video border-2 border-blue-300 rounded-lg overflow-hidden bg-blue-50">
                      <img 
                        src={previewImage} 
                        alt="Preview" 
                        className="w-full h-full object-contain"
                      />
                      <button
                        onClick={clearPreview}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-900">
                        <strong>File:</strong> {selectedFile?.name}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        <strong>Ukuran:</strong> {((selectedFile?.size || 0) / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    {uploading && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-medium">Mengunggah...</p>
                          <p className="text-xs font-bold text-primary">{uploadProgress}%</p>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                      </div>
                    )}

                    <Button 
                      onClick={() => handleFileUpload(pendingSubscription.id)}
                      disabled={uploading}
                      className="w-full"
                    >
                      {uploading ? `Mengunggah ${uploadProgress}%...` : 'Unggah Bukti Pembayaran'}
                    </Button>
                  </div>
                ) : (
                  // Drag and drop area
                  <div 
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive 
                        ? 'border-primary bg-primary/5' 
                        : 'border-slate-300 bg-slate-50 hover:border-slate-400'
                    }`}
                  >
                    <Upload className="h-10 w-10 mx-auto mb-3 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900 mb-1">Drag & drop bukti pembayaran di sini</p>
                    <p className="text-xs text-slate-600 mb-4">atau klik untuk memilih file</p>
                    <p className="text-xs text-slate-500 mb-4">JPG, PNG, WebP, atau PDF (Max 5MB)</p>
                    <Input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/jpeg,image/png,image/webp,application/pdf" 
                      onChange={handleInputChange}
                      disabled={uploading}
                      className="hidden"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      Pilih File
                    </Button>
                  </div>
                )}
              </div>

              {/* Info Alert */}
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-900">Tips Mengambil Bukti Pembayaran</AlertTitle>
                <AlertDescription className="text-blue-800 text-xs space-y-1 mt-2">
                  <p>• Pastikan bukti transfer jelas dan terlihat semua informasi penting</p>
                  <p>• Sertakan nama pengirim, jumlah, dan tanggal transfer</p>
                  <p>• Gunakan foto dengan pencahayaan yang baik</p>
                  <p>• File harus dalam format JPG, PNG, WebP, atau PDF</p>
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setPaymentDialogOpen(false);
                clearPreview();
              }}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Detail Riwayat Pembelian
            </DialogTitle>
          </DialogHeader>
          {selectedSubscriptionDetail && (
            <div className="space-y-6">
              {/* Package Info */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-lg border border-primary/20">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nama Paket</p>
                    <p className="font-bold text-lg">{selectedSubscriptionDetail.package.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Kuota</p>
                    <p className="font-bold text-lg text-primary">{selectedSubscriptionDetail.transaction_quota}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Kuota Digunakan</p>
                    <p className="font-bold text-lg text-orange-600">{selectedSubscriptionDetail.used_quota}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Sisa Kuota</p>
                    <p className="font-bold text-lg text-green-600">{selectedSubscriptionDetail.transaction_quota - selectedSubscriptionDetail.used_quota}</p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Detail Pembayaran</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Total Pembayaran</p>
                    <p className="text-2xl font-bold text-primary">{formatPrice(selectedSubscriptionDetail.payment_amount)}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Status Pembayaran</p>
                    <div className="mt-2">{getPaymentStatusBadge(selectedSubscriptionDetail.payment_status)}</div>
                  </div>
                </div>
              </div>

              {/* Validity Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Periode Berlaku</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Tanggal Mulai</p>
                    <p className="font-medium">{new Date(selectedSubscriptionDetail.started_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Tanggal Berakhir</p>
                    <p className="font-medium">{new Date(selectedSubscriptionDetail.expired_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              {/* Package Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Informasi Paket</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Harga per Transaksi</p>
                    <p className="font-medium">{formatPrice(selectedSubscriptionDetail.package.price_per_transaction)}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Komisi Grup</p>
                    <p className="font-medium">{selectedSubscriptionDetail.package.group_commission_percent}%</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Validitas</p>
                    <p className="font-medium">{selectedSubscriptionDetail.package.validity_days} hari</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Status</p>
                    <Badge variant={selectedSubscriptionDetail.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {selectedSubscriptionDetail.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Usage Progress */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Penggunaan Kuota</h3>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium">Progress Penggunaan</p>
                    <p className="text-xs text-muted-foreground">
                      {getQuotaPercentage(selectedSubscriptionDetail.used_quota, selectedSubscriptionDetail.transaction_quota).toFixed(0)}%
                    </p>
                  </div>
                  <Progress 
                    value={getQuotaPercentage(selectedSubscriptionDetail.used_quota, selectedSubscriptionDetail.transaction_quota)} 
                    className="h-2"
                  />
                </div>
              </div>

              {/* Payment Proof */}
              {selectedSubscriptionDetail.payment_proof_url && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Bukti Pembayaran</h3>
                  <div className="relative aspect-video border-2 border-slate-200 rounded-lg overflow-hidden bg-black/5 group">
                    <img 
                      src={selectedSubscriptionDetail.payment_proof_url} 
                      alt="Bukti Pembayaran" 
                      className="w-full h-full object-contain"
                    />
                    <a 
                      href={selectedSubscriptionDetail.payment_proof_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Button variant="secondary" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Lihat Full
                      </Button>
                    </a>
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              {selectedSubscriptionDetail.admin_notes && (
                <Alert variant={selectedSubscriptionDetail.payment_status === 'REJECTED' ? 'destructive' : 'default'}>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Catatan Admin</AlertTitle>
                  <AlertDescription>
                    {selectedSubscriptionDetail.admin_notes}
                  </AlertDescription>
                </Alert>
              )}

              {/* Transaction Info */}
              <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold text-sm">Informasi Transaksi</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">ID Transaksi</p>
                    <p className="font-mono text-xs break-all">{selectedSubscriptionDetail.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tanggal Pesanan</p>
                    <p className="text-xs">{new Date(selectedSubscriptionDetail.created_at).toLocaleString('id-ID')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDetailModalOpen(false)}
              className="w-full"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
