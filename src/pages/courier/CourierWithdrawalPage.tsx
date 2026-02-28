import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Wallet, Send, Clock, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';

interface CourierInfo {
  id: string;
  name: string;
  available_balance: number;
  pending_balance: number;
  total_withdrawn: number;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
}

export default function CourierWithdrawalPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [courier, setCourier] = useState<CourierInfo | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [minimumBalance, setMinimumBalance] = useState(50000);

  useEffect(() => {
    if (!authLoading && user) fetchData();
    else if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const { data: courierData } = await supabase
        .from('couriers')
        .select('id, name, available_balance, pending_balance, total_withdrawn, bank_name, bank_account_number, bank_account_name, registration_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!courierData || courierData.registration_status !== 'APPROVED') {
        navigate('/courier');
        return;
      }

      setCourier(courierData as CourierInfo);
      setBankName(courierData.bank_name || '');
      setAccountNumber(courierData.bank_account_number || '');
      setAccountHolder(courierData.bank_account_name || '');

      const [{ data: wds }, { data: minBalSetting }] = await Promise.all([
        supabase
          .from('courier_withdrawal_requests')
          .select('*')
          .eq('courier_id', courierData.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'courier_minimum_balance')
          .maybeSingle(),
      ]);

      setWithdrawals(wds || []);
      if (minBalSetting?.value) {
        setMinimumBalance((minBalSetting.value as any).amount || 50000);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courier) return;
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Masukkan jumlah yang valid');
      return;
    }
    if (amountNum > (courier.available_balance || 0)) {
      toast.error('Saldo tidak mencukupi');
      return;
    }
    const remainingBalance = (courier.available_balance || 0) - amountNum;
    if (remainingBalance < minimumBalance) {
      toast.error(`Saldo setelah penarikan harus minimal ${formatPrice(minimumBalance)}`);
      return;
    }
    if (!bankName || !accountNumber || !accountHolder) {
      toast.error('Lengkapi data rekening bank');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('courier_withdrawal_requests').insert({
        courier_id: courier.id,
        amount: amountNum,
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
      });

      if (error) throw error;

      // Update courier bank info if changed
      await supabase.from('couriers').update({
        bank_name: bankName,
        bank_account_number: accountNumber,
        bank_account_name: accountHolder,
      }).eq('id', courier.id);

      toast.success('Permintaan penarikan berhasil diajukan');
      setAmount('');
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal mengajukan penarikan');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Menunggu</Badge>;
      case 'APPROVED': return <Badge className="bg-primary/10 text-primary"><CheckCircle className="h-3 w-3 mr-1" />Disetujui</Badge>;
      case 'REJECTED': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Ditolak</Badge>;
      case 'COMPLETED': return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Selesai</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/courier')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>

        {/* Balance Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" />Saldo Tersedia</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatPrice(courier?.available_balance || 0)}</p>
              <div className="flex gap-4 mt-2 text-sm opacity-80">
                <span>Pending: {formatPrice(courier?.pending_balance || 0)}</span>
                <span>Ditarik: {formatPrice(courier?.total_withdrawn || 0)}</span>
              </div>
              <p className="text-xs mt-1 opacity-70">Saldo minimum: {formatPrice(minimumBalance)}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Withdrawal Form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Send className="h-5 w-5" />Ajukan Penarikan</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Jumlah (Rp)</Label>
                  <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Masukkan jumlah" min={1} />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <Label>Nama Bank</Label>
                    <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="BRI, BCA, dll" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nomor Rekening</Label>
                    <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Nomor rekening" />
                  </div>
                  <div className="space-y-2">
                    <Label>Atas Nama</Label>
                    <Input value={accountHolder} onChange={e => setAccountHolder(e.target.value)} placeholder="Nama pemilik rekening" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Ajukan Penarikan
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* History */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 className="font-bold text-lg mb-3">Riwayat Penarikan</h3>
          {withdrawals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Belum ada riwayat penarikan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map(wd => (
                <Card key={wd.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold">{formatPrice(wd.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(wd.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      {statusBadge(wd.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{wd.bank_name} • {wd.account_number} • {wd.account_holder}</p>
                    {wd.admin_notes && <p className="text-xs text-destructive mt-1">Catatan: {wd.admin_notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
