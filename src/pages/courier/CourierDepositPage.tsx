import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, PiggyBank, Upload, Clock, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
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

interface DepositRecord {
  id: string;
  amount: number;
  proof_url: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
}

export default function CourierDepositPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [courierId, setCourierId] = useState<string | null>(null);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [adminBankInfo, setAdminBankInfo] = useState<{ bank_name: string; bank_account_number: string; bank_account_name: string; qris_image_url?: string } | null>(null);

  useEffect(() => {
    if (!authLoading && user) fetchData();
    else if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const { data: courier } = await supabase
        .from('couriers')
        .select('id, available_balance, registration_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!courier || courier.registration_status !== 'APPROVED') {
        navigate('/courier');
        return;
      }

      setCourierId(courier.id);
      setAvailableBalance(courier.available_balance || 0);

      const [{ data: deps }, { data: bankSetting }] = await Promise.all([
        supabase
          .from('courier_deposits')
          .select('*')
          .eq('courier_id', courier.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'admin_payment_info')
          .maybeSingle(),
      ]);

      setDeposits(deps || []);
      if (bankSetting?.value) {
        setAdminBankInfo(bankSetting.value as any);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courierId) return;
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum < 10000) {
      toast.error('Minimal setoran Rp 10.000');
      return;
    }
    if (!proofUrl) {
      toast.error('Upload bukti transfer terlebih dahulu');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('courier_deposits').insert({
        courier_id: courierId,
        amount: amountNum,
        proof_url: proofUrl,
      });

      if (error) throw error;
      toast.success('Setoran berhasil diajukan, menunggu persetujuan admin');
      setAmount('');
      setProofUrl('');
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal mengajukan setoran');
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
              <CardTitle className="text-sm flex items-center gap-2"><PiggyBank className="h-4 w-4" />Saldo Saat Ini</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatPrice(availableBalance)}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Admin Bank Info */}
        {adminBankInfo && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-1">Transfer ke rekening admin:</p>
              <p className="text-sm">{adminBankInfo.bank_name} - {adminBankInfo.bank_account_number}</p>
              <p className="text-sm">a.n. {adminBankInfo.bank_account_name}</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Deposit Form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Upload className="h-5 w-5" />Setor Saldo</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Jumlah Setoran (Rp)</Label>
                  <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Minimal Rp 10.000" min={10000} />
                </div>
                <div className="space-y-2">
                  <Label>Bukti Transfer (URL gambar)</Label>
                  <Input 
                    value={proofUrl} 
                    onChange={e => setProofUrl(e.target.value)} 
                    placeholder="Paste URL bukti transfer" 
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Ajukan Setoran
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Deposit History */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 className="font-bold text-lg mb-3">Riwayat Setoran</h3>
          {deposits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PiggyBank className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Belum ada riwayat setoran</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deposits.map(dep => (
                <Card key={dep.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold">{formatPrice(dep.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(dep.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {statusBadge(dep.status)}
                    </div>
                    {dep.admin_notes && <p className="text-xs text-destructive mt-1">Catatan: {dep.admin_notes}</p>}
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
