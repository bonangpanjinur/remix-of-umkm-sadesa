import { useState, useEffect } from 'react';
import { Package, CreditCard, AlertTriangle, Check, Clock, TrendingUp } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
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
  package: {
    name: string;
    classification_price: string;
    price_per_transaction: number;
    validity_days: number;
  };
}

interface TransactionPackage {
  id: string;
  name: string;
  classification_price: string;
  price_per_transaction: number;
  kas_fee: number;
  transaction_quota: number;
  validity_days: number;
  description: string | null;
}

export default function MerchantSubscriptionPage() {
  const { user } = useAuth();
  const [merchant, setMerchant] = useState<{ id: string; classification_price: string | null } | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState<Subscription[]>([]);
  const [availablePackages, setAvailablePackages] = useState<TransactionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<TransactionPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Get merchant
        const { data: merchantData } = await supabase
          .from('merchants')
          .select('id, classification_price')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!merchantData) {
          setLoading(false);
          return;
        }

        setMerchant(merchantData);

        // Get current active subscription
        const { data: subData } = await supabase
          .from('merchant_subscriptions')
          .select(`
            *,
            package:transaction_packages(name, classification_price, price_per_transaction, validity_days)
          `)
          .eq('merchant_id', merchantData.id)
          .eq('status', 'ACTIVE')
          .gte('expired_at', new Date().toISOString())
          .order('expired_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subData) {
          setCurrentSubscription({
            ...subData,
            package: subData.package as Subscription['package'],
          });
        }

        // Get subscription history
        const { data: historyData } = await supabase
          .from('merchant_subscriptions')
          .select(`
            *,
            package:transaction_packages(name, classification_price, price_per_transaction, validity_days)
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

        // Get available packages (matching classification or all if no classification set)
        const packageQuery = supabase
          .from('transaction_packages')
          .select('*')
          .eq('is_active', true);

        if (merchantData.classification_price) {
          packageQuery.eq('classification_price', merchantData.classification_price);
        }

        const { data: packagesData } = await packageQuery;
        setAvailablePackages(packagesData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Gagal memuat data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleBuyPackage = async () => {
    if (!selectedPackage || !merchant) return;

    setPurchasing(true);
    try {
      const expiredAt = new Date();
      expiredAt.setDate(expiredAt.getDate() + selectedPackage.validity_days);

      const paymentAmount = (selectedPackage.price_per_transaction * selectedPackage.transaction_quota) + selectedPackage.kas_fee;

      const { error } = await supabase.from('merchant_subscriptions').insert({
        merchant_id: merchant.id,
        package_id: selectedPackage.id,
        transaction_quota: selectedPackage.transaction_quota,
        used_quota: 0,
        expired_at: expiredAt.toISOString(),
        status: 'ACTIVE',
        payment_status: 'PENDING',
        payment_amount: paymentAmount,
      });

      if (error) throw error;

      toast.success('Paket berhasil dibeli! Silakan lakukan pembayaran.');
      setBuyDialogOpen(false);
      setSelectedPackage(null);

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Error purchasing package:', error);
      toast.error('Gagal membeli paket');
    } finally {
      setPurchasing(false);
    }
  };

  const getRemainingDays = (expiredAt: string) => {
    const now = new Date();
    const exp = new Date(expiredAt);
    const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const getQuotaPercentage = (used: number, total: number) => {
    if (total === 0) return 100;
    return Math.min(100, (used / total) * 100);
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
                <CardDescription>Paket aktif saat ini</CardDescription>
              </div>
              <Badge className="bg-green-100 text-green-700">Aktif</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Quota Progress */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Kuota Transaksi</span>
                  <span className="font-medium">
                    {currentSubscription.used_quota} / {currentSubscription.transaction_quota}
                  </span>
                </div>
                <Progress 
                  value={getQuotaPercentage(currentSubscription.used_quota, currentSubscription.transaction_quota)} 
                  className="h-3"
                />
                {currentSubscription.used_quota >= currentSubscription.transaction_quota && (
                  <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Kuota habis! Beli paket baru untuk melanjutkan transaksi.
                  </p>
                )}
              </div>

              {/* Remaining Days */}
              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Sisa Masa Aktif</span>
                </div>
                <span className="font-semibold text-primary">
                  {getRemainingDays(currentSubscription.expired_at)} hari
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-background rounded-lg">
                  <p className="text-muted-foreground">Tersisa</p>
                  <p className="font-bold text-xl text-primary">
                    {currentSubscription.transaction_quota - currentSubscription.used_quota}
                  </p>
                  <p className="text-xs text-muted-foreground">transaksi</p>
                </div>
                <div className="p-3 bg-background rounded-lg">
                  <p className="text-muted-foreground">Biaya/Transaksi</p>
                  <p className="font-bold text-xl">
                    {formatPrice(currentSubscription.package.price_per_transaction)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6 border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Tidak Ada Kuota Aktif</h3>
                <p className="text-sm text-muted-foreground">
                  Anda tidak dapat menerima pesanan tanpa kuota aktif. Silakan beli paket di bawah.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Packages */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Beli Paket Kuota
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {availablePackages.map((pkg) => (
            <Card key={pkg.id} className="hover:border-primary transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{pkg.name}</CardTitle>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kuota</span>
                    <span className="font-medium">{pkg.transaction_quota} transaksi</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Masa Aktif</span>
                    <span className="font-medium">{pkg.validity_days} hari</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Biaya per Transaksi</span>
                    <span className="font-medium">{formatPrice(pkg.price_per_transaction)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Biaya Kas</span>
                    <span className="font-medium">{formatPrice(pkg.kas_fee)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Total</span>
                      <span className="font-bold text-primary">
                        {formatPrice((pkg.price_per_transaction * pkg.transaction_quota) + pkg.kas_fee)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => { setSelectedPackage(pkg); setBuyDialogOpen(true); }}
                >
                  Beli Paket
                </Button>
              </CardContent>
            </Card>
          ))}

          {availablePackages.length === 0 && (
            <div className="col-span-2 text-center py-10 text-muted-foreground">
              Tidak ada paket tersedia untuk klasifikasi harga Anda.
            </div>
          )}
        </div>
      </div>

      {/* Subscription History */}
      {subscriptionHistory.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Riwayat Langganan
          </h2>
          <div className="space-y-3">
            {subscriptionHistory.map((sub) => (
              <Card key={sub.id} className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{sub.package.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sub.started_at).toLocaleDateString('id-ID')} - {new Date(sub.expired_at).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={sub.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {sub.status === 'ACTIVE' ? 'Aktif' : sub.status === 'EXPIRED' ? 'Kadaluarsa' : sub.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {sub.used_quota}/{sub.transaction_quota} transaksi
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Buy Confirmation Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembelian</DialogTitle>
          </DialogHeader>

          {selectedPackage && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">{selectedPackage.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Kuota</span>
                    <span>{selectedPackage.transaction_quota} transaksi</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Masa Aktif</span>
                    <span>{selectedPackage.validity_days} hari</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Biaya Transaksi</span>
                    <span>{formatPrice(selectedPackage.price_per_transaction * selectedPackage.transaction_quota)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Biaya Kas</span>
                    <span>{formatPrice(selectedPackage.kas_fee)}</span>
                  </div>
                  <div className="border-t pt-2 font-semibold flex justify-between">
                    <span>Total Bayar</span>
                    <span className="text-primary">
                      {formatPrice((selectedPackage.price_per_transaction * selectedPackage.transaction_quota) + selectedPackage.kas_fee)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Paket akan langsung aktif setelah pembelian. Kuota berlaku selama {selectedPackage.validity_days} hari.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleBuyPackage} disabled={purchasing}>
              {purchasing ? 'Memproses...' : 'Beli Sekarang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
