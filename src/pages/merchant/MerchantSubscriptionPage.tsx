import { useState, useEffect } from 'react';
import { Package, CreditCard, AlertTriangle, Clock, TrendingUp, Upload, CheckCircle2, XCircle, Info, ExternalLink } from 'lucide-react';
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
      fetchData();
    } catch (error) {
      console.error('Error purchasing package:', error);
      toast.error('Gagal membuat permintaan pembelian');
    } finally {
      setPurchasing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, subId: string) => {
    const file = event.target.files?.[0];
    if (!file || !merchant) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `payment-proofs/${merchant.id}/${subId}-${Math.random()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('merchants')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('merchants')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('merchant_subscriptions')
        .update({ 
          payment_proof_url: publicUrl,
          payment_status: 'PENDING_APPROVAL'
        })
        .eq('id', subId);

      if (updateError) throw updateError;

      toast.success('Bukti pembayaran berhasil diunggah. Menunggu verifikasi admin.');
      setPaymentDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error('Gagal mengunggah bukti pembayaran');
    } finally {
      setUploading(false);
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
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Penggunaan Kuota</span>
                  <span className="font-medium">
                    {currentSubscription.used_quota} / {currentSubscription.transaction_quota} Transaksi
                  </span>
                </div>
                <Progress value={getQuotaPercentage(currentSubscription.used_quota, currentSubscription.transaction_quota)} className="h-2" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="text-xs">
                    <p className="text-muted-foreground">Berakhir pada</p>
                    <p className="font-medium">{new Date(currentSubscription.expired_at).toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div className="text-xs">
                    <p className="text-muted-foreground">Sisa Kuota</p>
                    <p className="font-medium">{currentSubscription.transaction_quota - currentSubscription.used_quota} Transaksi</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert className="mb-6 border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Kuota Tidak Aktif</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Anda belum memiliki paket kuota aktif. Toko Anda tidak dapat menerima pesanan baru hingga Anda membeli paket.
          </AlertDescription>
        </Alert>
      )}

      {/* Available Packages */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Pilih Paket Kuota</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {availablePackages.map((pkg) => (
            <Card key={pkg.id} className="relative overflow-hidden border-border hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-lg">{pkg.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-primary">{formatPrice(pkg.price_per_transaction)}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>{pkg.transaction_quota} Kuota Transaksi</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Aktif selama {pkg.validity_days} hari</span>
                  </li>
                  {pkg.description && (
                    <li className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                      <span className="text-muted-foreground">{pkg.description}</span>
                    </li>
                  )}
                </ul>
                <Button 
                  className="w-full" 
                  onClick={() => {
                    setSelectedPackage(pkg);
                    setBuyDialogOpen(true);
                  }}
                >
                  Beli Sekarang
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Subscription History */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Riwayat Pembelian</h3>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-secondary/20">
                    <th className="text-left py-3 px-4">Tanggal</th>
                    <th className="text-left py-3 px-4">Paket</th>
                    <th className="text-left py-3 px-4">Jumlah</th>
                    <th className="text-left py-3 px-4">Status Bayar</th>
                    <th className="text-right py-3 px-4">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada riwayat pembelian
                      </td>
                    </tr>
                  ) : (
                    subscriptionHistory.map((sub) => (
                      <tr key={sub.id} className="border-b hover:bg-secondary/10">
                        <td className="py-3 px-4">{new Date(sub.created_at).toLocaleDateString('id-ID')}</td>
                        <td className="py-3 px-4 font-medium">{sub.package?.name}</td>
                        <td className="py-3 px-4">{formatPrice(sub.payment_amount)}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            {getPaymentStatusBadge(sub.payment_status)}
                            {sub.payment_status === 'REJECTED' && sub.admin_notes && (
                              <span className="text-[10px] text-red-500 italic max-w-[150px] truncate" title={sub.admin_notes}>
                                Ket: {sub.admin_notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {sub.payment_status === 'UNPAID' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setPendingSubscription(sub);
                                setPaymentDialogOpen(true);
                              }}
                            >
                              Bayar
                            </Button>
                          )}
                          {(sub.payment_status === 'PENDING_APPROVAL' || sub.payment_status === 'PAID' || sub.payment_status === 'REJECTED') && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setPendingSubscription(sub);
                                setPaymentDialogOpen(true);
                              }}
                            >
                              Detail
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buy Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembelian</DialogTitle>
          </DialogHeader>
          {selectedPackage && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-sm text-muted-foreground">Paket yang dipilih:</p>
                <p className="text-lg font-bold">{selectedPackage.name}</p>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-sm">Total Pembayaran:</span>
                  <span className="text-xl font-bold text-primary">{formatPrice(selectedPackage.price_per_transaction)}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Setelah klik konfirmasi, Anda akan diarahkan untuk melakukan pembayaran transfer manual dan mengunggah bukti bayar.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyDialogOpen(false)}>Batal</Button>
            <Button onClick={handleBuyPackage} disabled={purchasing}>
              {purchasing ? 'Memproses...' : 'Konfirmasi Pembelian'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Pembayaran & Bukti</DialogTitle>
          </DialogHeader>
          {pendingSubscription && (
            <div className="py-4 space-y-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total yang harus dibayar:</p>
                <p className="text-3xl font-bold text-primary">{formatPrice(pendingSubscription.payment_amount)}</p>
              </div>

              {paymentSettings ? (
                <div className="space-y-4 p-4 bg-secondary/30 rounded-lg border border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Metode: Transfer Bank</span>
                    <Badge variant="outline">{paymentSettings.bank_name}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Nomor Rekening:</p>
                    <p className="text-lg font-mono font-bold tracking-wider">{paymentSettings.account_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Nama Penerima:</p>
                    <p className="font-medium">{paymentSettings.account_name}</p>
                  </div>
                  {paymentSettings.qris_url && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Atau Scan QRIS:</p>
                      <img src={paymentSettings.qris_url} alt="QRIS" className="w-48 h-48 mx-auto border p-2 bg-white rounded" />
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

              {pendingSubscription.payment_status === 'REJECTED' && (
                <Alert variant="destructive" className="bg-red-50">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Pembayaran Ditolak</AlertTitle>
                  <AlertDescription>
                    {pendingSubscription.admin_notes || 'Bukti pembayaran tidak valid. Silakan unggah ulang bukti yang benar.'}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <Label>Bukti Pembayaran</Label>
                {pendingSubscription.payment_proof_url ? (
                  <div className="space-y-3">
                    <div className="relative aspect-video border rounded-lg overflow-hidden bg-black/5 group">
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
                        <Input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileUpload(e, pendingSubscription.id)}
                          disabled={uploading}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center bg-secondary/10">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground">Unggah foto bukti transfer Anda di sini</p>
                    </div>
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleFileUpload(e, pendingSubscription.id)}
                      disabled={uploading}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setPaymentDialogOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
