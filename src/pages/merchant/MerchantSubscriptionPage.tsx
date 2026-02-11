import { useState, useEffect, useRef } from 'react';
import { Package, CreditCard, AlertTriangle, Clock, TrendingUp, Upload, CheckCircle2, XCircle, Info, ExternalLink, X, FileCheck, History, ShoppingCart } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { fetchMerchantQuotaInfo, fetchQuotaUsageLogs, type MerchantQuotaInfo, type QuotaUsageLog } from '@/lib/quotaHelpers';

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

// QuotaLog is now imported from quotaHelpers

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
  bank_account_number: string;
  bank_account_name: string;
  qris_image_url: string;
}

export default function MerchantSubscriptionPage() {
  const { user } = useAuth();
  const [merchant, setMerchant] = useState<{ id: string } | null>(null);
  const [currentQuotaInfo, setCurrentQuotaInfo] = useState<MerchantQuotaInfo | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState<Subscription[]>([]);
  const [quotaUsageLogs, setQuotaUsageLogs] = useState<QuotaUsageLog[]>([]);
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

      // Get centralized quota info (same as dashboard)
      const quotaInfo = await fetchMerchantQuotaInfo(merchantData.id);
      setCurrentQuotaInfo(quotaInfo);

      // Get current active subscription for detailed display
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

      // Get quota usage logs
      const logs = await fetchQuotaUsageLogs(merchantData.id);
      setQuotaUsageLogs(logs);

      // Get payment settings from main admin settings
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
  }, [user]);

  const handleBuyPackage = () => {
    if (!selectedPackage || !merchant) return;
    
    setBuyDialogOpen(false);
    setPaymentDialogOpen(true);
    setPreviewImage(null);
    setSelectedFile(null);
    // Reset pendingSubscription since we're starting a new purchase flow
    setPendingSubscription(null);
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

  const handleFileUpload = async () => {
    if (!selectedFile || !merchant || !selectedPackage) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const randomId = Math.random().toString(36).substring(7);
      const fileName = `payment-proofs/${merchant.id}/new-${Date.now()}-${randomId}.${fileExt}`;
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

      // Create subscription record after successful upload
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

      const { error: insertError } = await supabase.from('merchant_subscriptions').insert({
        merchant_id: merchant.id,
        package_id: selectedPackage.id,
        transaction_quota: selectedPackage.transaction_quota,
        used_quota: 0,
        expired_at: expiredAt,
        status: 'INACTIVE',
        payment_status: 'PENDING_APPROVAL',
        payment_amount: selectedPackage.price_per_transaction,
        payment_proof_url: publicUrl,
      });

      if (insertError) throw insertError;

      setUploadProgress(100);
      toast.success('Permintaan pembelian berhasil dibuat dan bukti pembayaran telah diunggah.');
      
      // Refresh data
      fetchData();
      
      // Close dialog after a short delay
      setTimeout(() => {
        setPaymentDialogOpen(false);
        setPendingSubscription(null);
        setSelectedPackage(null);
      }, 1500);
    } catch (error) {
      console.error('Error creating purchase request:', error);
      toast.error('Gagal membuat permintaan pembelian');
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
        return <Badge className="bg-green-500">Dibayar</Badge>;
      case 'PENDING_APPROVAL':
        return <Badge className="bg-yellow-500">Menunggu Verifikasi</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-500">Ditolak</Badge>;
      case 'UNPAID':
        return <Badge variant="outline">Belum Dibayar</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const openBuyDialog = (pkg: TransactionPackage) => {
    setSelectedPackage(pkg);
    setBuyDialogOpen(true);
  };

  const openDetailModal = (sub: Subscription) => {
    setSelectedSubscriptionDetail(sub);
    setDetailModalOpen(true);
  };

  return (
    <MerchantLayout title="Paket Kuota" subtitle="Kelola kuota untuk menerima pesanan">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Current Status Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Status Kuota Saat Ini
            </CardTitle>
            <CardDescription>Pantau penggunaan kuota Anda</CardDescription>
          </CardHeader>
          <CardContent>
            {currentQuotaInfo ? (
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Paket Aktif</p>
                    <p className="text-2xl font-bold">{currentQuotaInfo.packageName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Sisa Kuota</p>
                    <p className="text-3xl font-bold text-primary">
                      {currentQuotaInfo.remainingQuota} 
                      <span className="text-sm font-normal text-muted-foreground ml-1">Kredit</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progres Penggunaan</span>
                    <span>{getQuotaPercentage(currentQuotaInfo.usedQuota, currentQuotaInfo.totalQuota).toFixed(0)}%</span>
                  </div>
                  <Progress value={getQuotaPercentage(currentQuotaInfo.usedQuota, currentQuotaInfo.totalQuota)} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Terpakai {currentQuotaInfo.usedQuota} dari {currentQuotaInfo.totalQuota} kredit
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Berlaku Hingga</p>
                      <p className="text-sm font-medium">
                        {currentQuotaInfo.expiresAt
                          ? new Date(currentQuotaInfo.expiresAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
                          : currentQuotaInfo.type === 'free' ? 'Reset setiap bulan' : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-sm font-medium">{currentQuotaInfo.type === 'premium' ? 'Aktif' : 'Free Tier'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Tidak Ada Paket Aktif</h3>
                <p className="text-muted-foreground max-w-xs mb-6">
                  Anda belum memiliki paket kuota aktif. Beli paket di bawah untuk mulai menerima pesanan.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informasi Kuota</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">1</span>
              </div>
              <p>Setiap pesanan memotong kuota berdasarkan rentang harga produk (lihat tier biaya kuota).</p>
            </div>
            <div className="flex gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">2</span>
              </div>
              <p>Jika kuota habis, produk Anda tidak akan tampil di halaman publik.</p>
            </div>
            <div className="flex gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">3</span>
              </div>
              <p>Pastikan melakukan pembayaran dan unggah bukti untuk aktivasi paket.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Packages */}
      <h2 className="text-xl font-bold mb-4">Pilih Paket Kuota</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {availablePackages.map((pkg) => (
          <Card key={pkg.id} className="relative overflow-hidden flex flex-col border-2 hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <Badge className="w-fit mb-2" variant="secondary">{pkg.transaction_quota} Kredit</Badge>
              <CardTitle>{pkg.name}</CardTitle>
              <CardDescription className="line-clamp-2 h-10">{pkg.description || 'Paket kuota standar'}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow pb-4">
              <div className="mb-4">
                <span className="text-3xl font-bold">{formatPrice(pkg.price_per_transaction)}</span>
                <span className="text-muted-foreground text-sm ml-1">/paket</span>
              </div>
              <ul className="space-y-2 text-sm mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{pkg.transaction_quota} Kredit Kuota</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Aktif {pkg.validity_days} Hari</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Aktivasi Cepat</span>
                </li>
              </ul>
            </CardContent>
            <div className="p-4 pt-0">
              <Button className="w-full" onClick={() => openBuyDialog(pkg)}>Beli Paket</Button>
            </div>
          </Card>
        ))}
      </div>

      {/* History Section */}
      <div className="space-y-6 mb-8">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Riwayat & Transparansi</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subscription History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Riwayat Pembelian
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptionHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Paket</th>
                        <th className="text-left py-3 px-2 font-medium">Status</th>
                        <th className="text-left py-3 px-2 font-medium">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptionHistory.map((sub) => (
                        <tr key={sub.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => openDetailModal(sub)}>
                          <td className="py-3 px-2">
                            <p className="font-medium">{sub.package.name}</p>
                            <p className="text-xs text-muted-foreground">{sub.transaction_quota} Kredit</p>
                          </td>
                          <td className="py-3 px-2">{getPaymentStatusBadge(sub.payment_status)}</td>
                          <td className="py-3 px-2 text-xs">{new Date(sub.created_at).toLocaleDateString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">Belum ada riwayat pembelian.</div>
              )}
            </CardContent>
          </Card>

          {/* Quota Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Riwayat Penggunaan Kuota
              </CardTitle>
              <CardDescription>Detail pemakaian kuota per pesanan</CardDescription>
            </CardHeader>
            <CardContent>
              {quotaUsageLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-2">Pesanan</TableHead>
                        <TableHead className="px-2">Harga</TableHead>
                        <TableHead className="px-2">Kuota</TableHead>
                        <TableHead className="px-2">Sisa</TableHead>
                        <TableHead className="px-2">Tanggal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotaUsageLogs.map((log) => (
                        <TableRow key={log.id} className="text-xs">
                          <TableCell className="px-2 font-mono text-xs">
                            {log.order_id ? `#${log.order_id.slice(0, 8)}` : '-'}
                          </TableCell>
                          <TableCell className="px-2">
                            {formatPrice(log.order_total)}
                          </TableCell>
                          <TableCell className="px-2 text-destructive font-bold">
                            -{log.credits_used}
                          </TableCell>
                          <TableCell className="px-2 font-bold">{log.remaining_quota}</TableCell>
                          <TableCell className="px-2 text-muted-foreground">
                            {new Date(log.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">Belum ada riwayat penggunaan kuota.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
                    <p className="text-muted-foreground">Kuota</p>
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
            <Button onClick={handleBuyPackage}>
              Lanjutkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Detail Pembayaran & Bukti
            </DialogTitle>
          </DialogHeader>
          {(pendingSubscription || selectedPackage) && (
            <div className="space-y-6">
              {/* Payment Amount */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground mb-2">Total yang harus dibayar</p>
                <p className="text-4xl font-bold text-primary">
                  {formatPrice(pendingSubscription?.payment_amount || selectedPackage?.price_per_transaction || 0)}
                </p>
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
                         <p className="text-lg font-mono font-bold text-slate-900 tracking-wider">{paymentSettings.bank_account_number}</p>
                       </div>
                       <div>
                         <p className="text-xs text-slate-600 mb-1">Nama Penerima</p>
                         <p className="font-medium text-slate-900">{paymentSettings.bank_account_name}</p>
                       </div>
                     </div>
                   </div>

                   {/* QRIS */}
                   {paymentSettings.qris_image_url && (
                     <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                       <p className="text-sm font-medium text-slate-900 mb-3">Atau Scan QRIS</p>
                       <div className="flex justify-center bg-white p-4 rounded border border-slate-200">
                         <img src={paymentSettings.qris_image_url} alt="QRIS" className="w-40 h-40 object-contain" />
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
              {pendingSubscription?.payment_status === 'REJECTED' && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Pembayaran Ditolak</AlertTitle>
                  <AlertDescription>
                    {pendingSubscription.admin_notes || 'Bukti pembayaran tidak valid. Silakan unggah ulang bukti yang benar.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Pending Alert */}
              {pendingSubscription?.payment_status === 'PENDING_APPROVAL' && (
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
                
                {pendingSubscription?.payment_proof_url && pendingSubscription?.payment_status === 'PENDING_APPROVAL' ? (
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
                ) : (
                  // Show upload area
                  <div className="space-y-4">
                    {previewImage ? (
                      <div className="relative aspect-video border-2 border-dashed border-primary/50 rounded-lg overflow-hidden bg-black/5">
                        <img src={previewImage} alt="Preview" className="w-full h-full object-contain" />
                        <button 
                          onClick={clearPreview}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div 
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                          border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors
                          ${dragActive ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-primary hover:bg-slate-50'}
                        `}
                      >
                        <Upload className="h-10 w-10 text-slate-400 mb-3" />
                        <p className="text-sm font-medium text-slate-700">Klik atau seret file ke sini</p>
                        <p className="text-xs text-slate-500 mt-1">JPG, PNG, WebP atau PDF (Maks. 5MB)</p>
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleInputChange}
                          className="hidden" 
                          accept="image/*,application/pdf"
                        />
                      </div>
                    )}

                    {selectedFile && (
                      <div className="space-y-4">
                        {uploading && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>Mengunggah...</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} className="h-1" />
                          </div>
                        )}
                        <Button 
                          className="w-full" 
                          onClick={handleFileUpload}
                          disabled={uploading}
                        >
                          {uploading ? 'Memproses...' : 'Kirim Bukti Pembayaran'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentDialogOpen(false)} disabled={uploading}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <p className="font-medium">{selectedSubscriptionDetail.started_at ? new Date(selectedSubscriptionDetail.started_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Tanggal Berakhir</p>
                    <p className="font-medium">{selectedSubscriptionDetail.expired_at ? new Date(selectedSubscriptionDetail.expired_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</p>
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
    </MerchantLayout>
  );
}
