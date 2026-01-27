import { useState, useEffect } from 'react';
import { Wallet, ArrowUpRight, Clock, CheckCircle, XCircle, Building2, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

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

interface MerchantBalance {
  available_balance: number;
  pending_balance: number;
  total_withdrawn: number;
}

interface WithdrawalManagerProps {
  merchantId: string;
}

const BANKS = [
  'BCA',
  'BNI',
  'BRI',
  'Mandiri',
  'CIMB Niaga',
  'Danamon',
  'BTN',
  'Permata',
  'OCBC NISP',
  'Bank Jago',
  'Bank Neo Commerce',
  'SeaBank',
  'Dana',
  'OVO',
  'GoPay',
  'ShopeePay',
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  'PENDING': { label: 'Menunggu', color: 'bg-yellow-500', icon: Clock },
  'APPROVED': { label: 'Disetujui', color: 'bg-green-500', icon: CheckCircle },
  'REJECTED': { label: 'Ditolak', color: 'bg-destructive', icon: XCircle },
  'COMPLETED': { label: 'Selesai', color: 'bg-blue-500', icon: CheckCircle },
};

export function WithdrawalManager({ merchantId }: WithdrawalManagerProps) {
  const [balance, setBalance] = useState<MerchantBalance>({
    available_balance: 0,
    pending_balance: 0,
    total_withdrawn: 0,
  });
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [amount, setAmount] = useState<number>(0);
  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountHolder, setAccountHolder] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [merchantId]);

  const fetchData = async () => {
    try {
      // Fetch merchant balance
      const { data: merchantData, error: merchantError } = await supabase
        .from('merchants')
        .select('available_balance, pending_balance, total_withdrawn')
        .eq('id', merchantId)
        .single();

      if (merchantError) throw merchantError;
      setBalance(merchantData);

      // Fetch withdrawal history
      const { data: withdrawalData, error: withdrawalError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      if (withdrawalError) throw withdrawalError;
      setWithdrawals(withdrawalData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitWithdrawal = async () => {
    if (amount < 10000) {
      toast.error('Minimal penarikan Rp 10.000');
      return;
    }

    if (amount > balance.available_balance) {
      toast.error('Saldo tidak mencukupi');
      return;
    }

    if (!bankName || !accountNumber || !accountHolder) {
      toast.error('Lengkapi semua data rekening');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .insert({
          merchant_id: merchantId,
          amount,
          bank_name: bankName,
          account_number: accountNumber,
          account_holder: accountHolder,
          status: 'PENDING',
        });

      if (error) throw error;

      // Update merchant balance (move to pending)
      await supabase
        .from('merchants')
        .update({
          available_balance: balance.available_balance - amount,
          pending_balance: balance.pending_balance + amount,
        })
        .eq('id', merchantId);

      toast.success('Permintaan penarikan berhasil diajukan');
      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Gagal mengajukan penarikan');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setAmount(0);
    setBankName('');
    setAccountNumber('');
    setAccountHolder('');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Penarikan Saldo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-muted rounded" />
            <div className="h-48 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Penarikan Saldo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Balance Overview */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-xs text-muted-foreground mb-1">Saldo Tersedia</p>
              <p className="text-xl font-bold text-green-600">
                {formatPrice(balance.available_balance)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-xs text-muted-foreground mb-1">Dalam Proses</p>
              <p className="text-xl font-bold text-yellow-600">
                {formatPrice(balance.pending_balance)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-xs text-muted-foreground mb-1">Total Ditarik</p>
              <p className="text-xl font-bold text-blue-600">
                {formatPrice(balance.total_withdrawn)}
              </p>
            </div>
          </div>

          <Button 
            className="w-full"
            onClick={() => setShowDialog(true)}
            disabled={balance.available_balance < 10000}
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Tarik Saldo
          </Button>

          {/* Withdrawal History */}
          <div>
            <h4 className="font-medium mb-3">Riwayat Penarikan</h4>
            
            {withdrawals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Belum ada riwayat penarikan
              </p>
            ) : (
              <div className="space-y-3">
                {withdrawals.map((withdrawal) => {
                  const config = STATUS_CONFIG[withdrawal.status] || STATUS_CONFIG['PENDING'];
                  const StatusIcon = config.icon;

                  return (
                    <div 
                      key={withdrawal.id}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      <div className={`w-10 h-10 rounded-full ${config.color}/10 flex items-center justify-center`}>
                        <StatusIcon className={`h-5 w-5 ${config.color.replace('bg-', 'text-')}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{formatPrice(withdrawal.amount)}</p>
                          <Badge className={`${config.color} text-white`}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Building2 className="h-3 w-3" />
                          {withdrawal.bank_name} - {withdrawal.account_number}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(withdrawal.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                        </p>
                        {withdrawal.admin_notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Catatan: {withdrawal.admin_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tarik Saldo</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Saldo Tersedia</p>
              <p className="text-xl font-bold">{formatPrice(balance.available_balance)}</p>
            </div>

            <div className="space-y-2">
              <Label>Jumlah Penarikan</Label>
              <Input
                type="number"
                placeholder="0"
                value={amount || ''}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Minimal Rp 10.000
              </p>
            </div>

            <div className="space-y-2">
              <Label>Bank / E-Wallet</Label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih bank..." />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nomor Rekening / HP</Label>
              <Input
                placeholder="Contoh: 1234567890"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Nama Pemilik Rekening</Label>
              <Input
                placeholder="Nama sesuai rekening"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Batal
            </Button>
            <Button 
              onClick={submitWithdrawal} 
              disabled={saving || amount < 10000 || amount > balance.available_balance}
            >
              Ajukan Penarikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
