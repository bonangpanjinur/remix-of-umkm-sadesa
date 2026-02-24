import { useState, useEffect } from 'react';
import { VerifikatorLayout } from '@/components/verifikator/VerifikatorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';
import { TrendingUp, Wallet, Clock, CheckCircle, XCircle, ArrowDownToLine, History } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Earning {
  id: string;
  merchant_id: string;
  subscription_id: string;
  package_id: string;
  package_amount: number;
  commission_percent: number;
  commission_amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  merchant?: { name: string };
  package?: { name: string };
}

interface Withdrawal {
  id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: string;
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
}

const BANKS = [
  'BCA', 'BNI', 'BRI', 'Mandiri', 'CIMB Niaga', 'Danamon',
  'Permata', 'OCBC NISP', 'Maybank', 'BTN', 'Bank Jago',
  'Jenius', 'SeaBank', 'Bank Neo Commerce', 'OVO', 'GoPay', 'DANA', 'ShopeePay'
];

export default function VerifikatorEarningsPage() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    bank_name: '',
    account_number: '',
    account_holder: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const pendingBalance = earnings.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + e.commission_amount, 0);
  const paidBalance = earnings.filter(e => e.status === 'PAID').reduce((sum, e) => sum + e.commission_amount, 0);
  const totalWithdrawn = withdrawals.filter(w => ['APPROVED', 'COMPLETED', 'PENDING'].includes(w.status)).reduce((sum, w) => sum + w.amount, 0);
  const pendingWithdrawal = withdrawals.filter(w => w.status === 'PENDING').reduce((sum, w) => sum + w.amount, 0);
  const availableBalance = paidBalance - totalWithdrawn;

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [earningsRes, withdrawalsRes] = await Promise.all([
        supabase
          .from('verifikator_earnings')
          .select(`
            *,
            merchant:merchants(name),
            package:transaction_packages(name)
          `)
          .eq('verifikator_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('verifikator_withdrawals')
          .select('*')
          .eq('verifikator_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      setEarnings(earningsRes.data || []);
      setWithdrawals(withdrawalsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user) return;
    
    const amount = parseInt(withdrawForm.amount);
    if (!amount || amount < 10000) {
      toast({
        title: 'Error',
        description: 'Minimum withdrawal Rp 10.000',
        variant: 'destructive',
      });
      return;
    }

    if (amount > availableBalance) {
      toast({
        title: 'Error',
        description: 'Saldo tidak mencukupi',
        variant: 'destructive',
      });
      return;
    }

    if (!withdrawForm.bank_name || !withdrawForm.account_number || !withdrawForm.account_holder) {
      toast({
        title: 'Error',
        description: 'Lengkapi semua data rekening',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('verifikator_withdrawals').insert({
        verifikator_id: user.id,
        amount,
        bank_name: withdrawForm.bank_name,
        account_number: withdrawForm.account_number,
        account_holder: withdrawForm.account_holder,
        status: 'PENDING'
      });

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Permintaan withdrawal telah diajukan',
      });

      setShowWithdrawDialog(false);
      setWithdrawForm({ amount: '', bank_name: '', account_number: '', account_holder: '' });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Gagal mengajukan withdrawal',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="text-warning border-warning"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'PAID':
      case 'APPROVED':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" /> {status === 'PAID' ? 'Dibayar' : 'Disetujui'}</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Ditolak</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <VerifikatorLayout title="Pendapatan Komisi" subtitle="Kelola pendapatan dan withdrawal Anda">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </VerifikatorLayout>
    );
  }

  return (
    <VerifikatorLayout title="Pendapatan Komisi" subtitle="Kelola pendapatan dan withdrawal Anda">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/20">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Tersedia</p>
                <p className="text-2xl font-bold">{formatPrice(availableBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-warning/20">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Proses Withdrawal</p>
                <p className="text-2xl font-bold">{formatPrice(pendingWithdrawal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-success/20">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Dicairkan</p>
                <p className="text-2xl font-bold">{formatPrice(paidBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Withdraw Button */}
      <div className="mb-6">
        <Button 
          onClick={() => setShowWithdrawDialog(true)} 
          disabled={availableBalance < 10000}
          className="gap-2"
        >
          <ArrowDownToLine className="h-4 w-4" />
          Tarik Saldo
        </Button>
        {availableBalance < 10000 && (
          <p className="text-sm text-muted-foreground mt-2">
            Minimum saldo untuk withdrawal adalah Rp 10.000
          </p>
        )}
      </div>

      <Tabs defaultValue="earnings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="earnings" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Riwayat Komisi
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-2">
            <History className="h-4 w-4" />
            Riwayat Withdrawal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="earnings">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Riwayat Komisi</CardTitle>
            </CardHeader>
            <CardContent>
              {earnings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada riwayat komisi. Komisi akan masuk ketika merchant binaan Anda membeli paket transaksi.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Pedagang</TableHead>
                      <TableHead>Paket</TableHead>
                      <TableHead className="text-right">Harga Paket</TableHead>
                      <TableHead className="text-right">Komisi</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.map((earning) => (
                      <TableRow key={earning.id}>
                        <TableCell>
                          {format(new Date(earning.created_at), 'dd MMM yyyy', { locale: id })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {earning.merchant?.name || '-'}
                        </TableCell>
                        <TableCell>{earning.package?.name || '-'}</TableCell>
                        <TableCell className="text-right">
                          {formatPrice(earning.package_amount)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-success">
                          +{formatPrice(earning.commission_amount)} ({earning.commission_percent}%)
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(earning.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Riwayat Withdrawal</CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada riwayat withdrawal
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{formatPrice(withdrawal.amount)}</p>
                            {getStatusBadge(withdrawal.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {withdrawal.bank_name} - {withdrawal.account_number}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            a.n. {withdrawal.account_holder}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(withdrawal.created_at), 'dd MMM yyyy HH:mm', { locale: id })}
                          </p>
                          {withdrawal.admin_notes && (
                            <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                              Catatan: {withdrawal.admin_notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tarik Saldo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Saldo Tersedia</p>
              <p className="text-2xl font-bold">{formatPrice(availableBalance)}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Jumlah Penarikan</Label>
              <Input
                type="number"
                placeholder="Minimum Rp 10.000"
                value={withdrawForm.amount}
                onChange={(e) => setWithdrawForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Bank / E-Wallet</Label>
              <Select
                value={withdrawForm.bank_name}
                onValueChange={(value) => setWithdrawForm(prev => ({ ...prev, bank_name: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih bank atau e-wallet" />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nomor Rekening / HP</Label>
              <Input
                placeholder="Contoh: 1234567890"
                value={withdrawForm.account_number}
                onChange={(e) => setWithdrawForm(prev => ({ ...prev, account_number: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Nama Pemilik Rekening</Label>
              <Input
                placeholder="Nama sesuai rekening"
                value={withdrawForm.account_holder}
                onChange={(e) => setWithdrawForm(prev => ({ ...prev, account_holder: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleWithdraw} disabled={submitting}>
              {submitting ? 'Memproses...' : 'Ajukan Withdrawal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VerifikatorLayout>
  );
}
