import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TicketCheck, Store, TrendingUp, Wallet, Copy, Calendar, Check, X, Plus, Settings, ChevronRight, Users, Bell, FileText, Send, Megaphone } from 'lucide-react';
import { GroupAnnouncementDialog } from '@/components/verifikator/GroupAnnouncementDialog';
import { VerifikatorLayout } from '@/components/verifikator/VerifikatorLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface TradeGroup {
  id: string;
  name: string;
  description: string | null;
  monthly_fee: number;
}

interface CodeInfo {
  id: string;
  code: string;
  trade_group: string;
  is_active: boolean;
  usage_count: number;
  max_usage: number | null;
}

interface KasPayment {
  id: string;
  merchant_id: string;
  amount: number;
  payment_month: number;
  payment_year: number;
  payment_date: string | null;
  status: string;
  sent_at?: string | null;
  merchant: { name: string };
}

interface DashboardData {
  codeInfo: CodeInfo | null;
  group: TradeGroup | null;
  stats: {
    totalMerchants: number;
    pendingMerchants: number;
    totalUsage: number;
    totalEarnings: number;
    pendingEarnings: number;
    totalKasCollected: number;
    totalKasPending: number;
  };
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function VerifikatorDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('10000');
  const [referralCode, setReferralCode] = useState('');

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);

  const [billingDialogOpen, setBillingDialogOpen] = useState(false);
  const [billingMerchantId, setBillingMerchantId] = useState('');
  const [billingAmount, setBillingAmount] = useState('');
  const [billingNote, setBillingNote] = useState('');
  const [billingMonth, setBillingMonth] = useState((new Date().getMonth() + 1).toString());
  const [billingYear, setBillingYear] = useState(new Date().getFullYear().toString());

  // Query: data utama dashboard (group, code, stats)
  const { data: dashboardData, isLoading: loading } = useQuery<DashboardData>({
    queryKey: ['verifikator-dashboard', user?.id],
    queryFn: async () => {
      const { data: codes } = await supabase
        .from('verifikator_codes')
        .select('*')
        .eq('verifikator_id', user!.id)
        .limit(1);
      const code = codes && codes.length > 0 ? codes[0] : null;

      const { data: groups } = await supabase
        .from('trade_groups')
        .select('*')
        .eq('verifikator_id', user!.id)
        .limit(1);
      const grp = groups && groups.length > 0 ? groups[0] : null;

      if (!code) {
        return { codeInfo: null, group: grp, stats: { totalMerchants: 0, pendingMerchants: 0, totalUsage: 0, totalEarnings: 0, pendingEarnings: 0, totalKasCollected: 0, totalKasPending: 0 } };
      }

      const [merchantsRes, earningsRes] = await Promise.all([
        supabase.from('merchants').select('registration_status').eq('verifikator_code', code.code),
        supabase.from('verifikator_earnings').select('commission_amount, status').eq('verifikator_id', user!.id),
      ]);

      const merchants = merchantsRes.data || [];
      const earnings = earningsRes.data || [];

      let totalKasCollected = 0;
      let totalKasPending = 0;
      if (grp) {
        const { data: allKas } = await supabase.from('kas_payments').select('amount, status').eq('group_id', grp.id);
        totalKasCollected = (allKas || []).filter(k => k.status === 'PAID').reduce((s, k) => s + k.amount, 0);
        totalKasPending = (allKas || []).filter(k => k.status === 'UNPAID').reduce((s, k) => s + k.amount, 0);
      }

      return {
        codeInfo: code as CodeInfo,
        group: grp as TradeGroup | null,
        stats: {
          totalMerchants: merchants.length,
          pendingMerchants: merchants.filter(m => m.registration_status === 'PENDING').length,
          totalUsage: code.usage_count,
          totalEarnings: earnings.reduce((s, e) => s + e.commission_amount, 0),
          pendingEarnings: earnings.filter(e => e.status === 'PENDING').reduce((s, e) => s + e.commission_amount, 0),
          totalKasCollected,
          totalKasPending,
        },
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const group = dashboardData?.group ?? null;
  const codeInfo = dashboardData?.codeInfo ?? null;
  const stats = dashboardData?.stats ?? { totalMerchants: 0, pendingMerchants: 0, totalUsage: 0, totalEarnings: 0, pendingEarnings: 0, totalKasCollected: 0, totalKasPending: 0 };

  // Query: kas payments per bulan
  const { data: payments = [] } = useQuery<KasPayment[]>({
    queryKey: ['kas-payments', group?.id, selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kas_payments')
        .select('*, merchant:merchants(name)')
        .eq('group_id', group!.id)
        .eq('payment_month', selectedMonth)
        .eq('payment_year', selectedYear)
        .order('status', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as KasPayment[];
    },
    enabled: !!group,
    staleTime: 30_000,
  });

  // Query: anggota grup untuk dialog tagihan individual
  const { data: groupMembers = [], refetch: refetchMembers } = useQuery<Array<{ merchant_id: string; merchant: { id: string; name: string } }>>({
    queryKey: ['group-members', group?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('group_members')
        .select('merchant_id, merchant:merchants(id, name)')
        .eq('group_id', group!.id)
        .eq('status', 'ACTIVE');
      return data || [];
    },
    enabled: !!group && billingDialogOpen,
    staleTime: 60_000,
  });

  // Mutation: setup kelompok baru
  const setupMutation = useMutation({
    mutationFn: async () => {
      if (!groupName.trim() || !referralCode.trim()) throw new Error('Nama kelompok dan kode referral wajib diisi');
      const { error: groupError } = await supabase.from('trade_groups').insert({
        name: groupName.trim(),
        code: referralCode.toUpperCase(),
        description: groupDescription.trim() || null,
        monthly_fee: parseInt(monthlyFee) || 10000,
        verifikator_id: user?.id,
      }).select().single();
      if (groupError) throw groupError;

      const { error: codeError } = await supabase.from('verifikator_codes').insert({
        code: referralCode.toUpperCase(),
        trade_group: groupName.trim(),
        verifikator_id: user?.id,
      });
      if (codeError) throw codeError;
    },
    onSuccess: () => {
      toast.success('Kelompok dagang berhasil dibuat');
      setSetupDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['verifikator-dashboard', user?.id] });
    },
    onError: (err: any) => {
      if (err.code === '23505') toast.error('Kode referral sudah digunakan');
      else toast.error('Gagal membuat kelompok: ' + err.message);
    },
  });

  // Mutation: update pengaturan grup
  const updateGroupMutation = useMutation({
    mutationFn: async () => {
      if (!group) return;
      const { error } = await supabase.from('trade_groups').update({
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        monthly_fee: parseInt(monthlyFee) || 10000,
      }).eq('id', group.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pengaturan berhasil diperbarui');
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['verifikator-dashboard', user?.id] });
    },
    onError: (err: any) => toast.error('Gagal memperbarui: ' + err.message),
  });

  // Mutation: tandai lunas
  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.from('kas_payments').update({
        status: 'PAID',
        payment_date: new Date().toISOString(),
        collected_by: user?.id,
      }).eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pembayaran berhasil dicatat');
      queryClient.invalidateQueries({ queryKey: ['kas-payments', group?.id, selectedMonth, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['verifikator-dashboard', user?.id] });
    },
    onError: () => toast.error('Gagal mencatat pembayaran'),
  });

  // Mutation: tandai belum lunas
  const markUnpaidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.from('kas_payments').update({
        status: 'UNPAID',
        payment_date: null,
        collected_by: null,
      }).eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status pembayaran diperbarui');
      queryClient.invalidateQueries({ queryKey: ['kas-payments', group?.id, selectedMonth, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['verifikator-dashboard', user?.id] });
    },
    onError: () => toast.error('Gagal memperbarui status'),
  });

  // Mutation: kirim pengingat ke satu merchant
  const sendReminderMutation = useMutation({
    mutationFn: async (payment: KasPayment) => {
      const { data: merchantData } = await supabase
        .from('merchants')
        .select('user_id, name')
        .eq('id', payment.merchant_id)
        .maybeSingle();
      if (!merchantData?.user_id) throw new Error('Merchant belum terhubung ke user');
      const { error } = await supabase.from('notifications').insert({
        user_id: merchantData.user_id,
        title: 'Pengingat Iuran Kas',
        message: `Iuran kas bulan ${MONTHS[payment.payment_month - 1]} ${payment.payment_year} sebesar ${formatPrice(payment.amount)} belum dibayar. Segera lakukan pembayaran.`,
        type: 'warning',
      });
      if (error) throw error;
      return merchantData.name;
    },
    onSuccess: (name) => toast.success(`Pengingat terkirim ke ${name}`),
    onError: () => toast.error('Gagal mengirim pengingat'),
  });

  // Mutation: generate tagihan kas bulanan (RPC)
  const generateKasMutation = useMutation({
    mutationFn: async () => {
      if (!group) return;
      const { data, error } = await supabase.rpc('generate_monthly_kas', {
        p_group_id: group.id,
        p_month: selectedMonth,
        p_year: selectedYear,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      toast.success(`${count} tagihan kas telah dibuat untuk ${MONTHS[selectedMonth - 1]} ${selectedYear}`);
      queryClient.invalidateQueries({ queryKey: ['kas-payments', group?.id, selectedMonth, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['verifikator-dashboard', user?.id] });
    },
    onError: (err: any) => toast.error('Gagal membuat tagihan: ' + err.message),
  });

  // Mutation: tagihan individual
  const createBillingMutation = useMutation({
    mutationFn: async () => {
      if (!billingMerchantId || !group) throw new Error('Pilih merchant terlebih dahulu');
      const { error } = await supabase.from('kas_payments').insert({
        group_id: group.id,
        merchant_id: billingMerchantId,
        amount: parseInt(billingAmount) || group.monthly_fee,
        payment_month: parseInt(billingMonth),
        payment_year: parseInt(billingYear),
        status: 'UNPAID',
        invoice_note: billingNote || null,
        sent_at: new Date().toISOString(),
      });
      if (error) throw error;

      const { data: merchantData } = await supabase.from('merchants').select('user_id, name').eq('id', billingMerchantId).maybeSingle();
      if (merchantData?.user_id) {
        await supabase.from('notifications').insert({
          user_id: merchantData.user_id,
          title: 'Tagihan Iuran Kas',
          message: `Tagihan iuran kas ${MONTHS[parseInt(billingMonth) - 1]} ${billingYear} sebesar ${formatPrice(parseInt(billingAmount) || group.monthly_fee)}. ${billingNote || ''}`.trim(),
          type: 'warning',
        });
      }
    },
    onSuccess: () => {
      toast.success('Tagihan berhasil dibuat dan notifikasi terkirim');
      setBillingDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['kas-payments', group?.id, selectedMonth, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['verifikator-dashboard', user?.id] });
    },
    onError: (err: any) => {
      if (err.code === '23505') toast.error('Tagihan untuk bulan ini sudah ada');
      else toast.error('Gagal membuat tagihan: ' + err.message);
    },
  });

  // Kirim pengingat massal ke semua UNPAID
  const handleSendMassReminder = async () => {
    if (!group) return;
    const unpaid = payments.filter(p => p.status === 'UNPAID');
    if (unpaid.length === 0) { toast.info('Semua iuran sudah lunas bulan ini'); return; }
    let sentCount = 0;
    for (const payment of unpaid) {
      try {
        const { data: merchantData } = await supabase.from('merchants').select('user_id').eq('id', payment.merchant_id).maybeSingle();
        if (merchantData?.user_id) {
          await supabase.from('notifications').insert({
            user_id: merchantData.user_id,
            title: 'Pengingat Iuran Kas',
            message: `Iuran kas bulan ${MONTHS[payment.payment_month - 1]} ${payment.payment_year} sebesar ${formatPrice(payment.amount)} belum dibayar. Segera lakukan pembayaran.`,
            type: 'warning',
          });
          await supabase.from('kas_payments').update({ sent_at: new Date().toISOString() }).eq('id', payment.id);
          sentCount++;
        }
      } catch (e) {
        console.error('Error sending reminder:', e);
      }
    }
    toast.success(`${sentCount} pengingat berhasil terkirim`);
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setReferralCode(code);
  };

  const copyCode = () => {
    if (codeInfo) {
      navigator.clipboard.writeText(codeInfo.code);
      toast.success('Kode berhasil disalin');
    }
  };

  const openEditDialog = () => {
    if (group) {
      setGroupName(group.name);
      setGroupDescription(group.description || '');
      setMonthlyFee(group.monthly_fee.toString());
      setEditDialogOpen(true);
    }
  };

  const handleOpenBillingDialog = () => {
    setBillingAmount(group?.monthly_fee?.toString() || '10000');
    setBillingNote('');
    setBillingMerchantId('');
    setBillingDialogOpen(true);
  };

  if (loading) {
    return (
      <VerifikatorLayout title="Dashboard" subtitle="Ringkasan aktivitas verifikator">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </VerifikatorLayout>
    );
  }

  if (!group || !codeInfo) {
    return (
      <VerifikatorLayout title="Dashboard" subtitle="Selamat datang, Verifikator!">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Buat Kelompok Dagang Anda</CardTitle>
            <CardDescription>
              Sebagai verifikator, Anda mengelola satu kelompok dagang dengan satu kode referral untuk merchant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setSetupDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Mulai Buat Kelompok
            </Button>
          </CardContent>
        </Card>

        <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Kelompok Dagang</DialogTitle>
              <DialogDescription>Satu kelompok dagang = satu kode referral untuk merchant</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nama Kelompok Dagang *</Label>
                <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Contoh: Kelompok UMKM Sukamaju" />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea value={groupDescription} onChange={e => setGroupDescription(e.target.value)} placeholder="Deskripsi singkat tentang kelompok" rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Kode Referral *</Label>
                <div className="flex gap-2">
                  <Input value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase())} placeholder="KODE123" className="font-mono" />
                  <Button variant="outline" onClick={generateRandomCode}>Generate</Button>
                </div>
                <p className="text-xs text-muted-foreground">Kode ini akan digunakan merchant untuk mendaftar ke kelompok Anda</p>
              </div>
              <div className="space-y-2">
                <Label>Iuran Kas Bulanan (Rp)</Label>
                <Input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} placeholder="10000" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSetupDialogOpen(false)}>Batal</Button>
              <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
                {setupMutation.isPending ? 'Menyimpan...' : 'Buat Kelompok'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </VerifikatorLayout>
    );
  }

  const paidCount = payments.filter(p => p.status === 'PAID').length;
  const unpaidCount = payments.filter(p => p.status === 'UNPAID').length;
  const monthlyCollected = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);

  return (
    <VerifikatorLayout title="Dashboard" subtitle={group.name}>
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <p className="text-sm text-muted-foreground">{group.description || 'Kelompok dagang Anda'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-lg">
                <TicketCheck className="h-4 w-4 text-muted-foreground" />
                <code className="font-mono font-bold">{codeInfo.code}</code>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyCode}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <Button variant="outline" size="icon" onClick={() => setAnnouncementOpen(true)} title="Pengumuman">
                <Megaphone className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={openEditDialog}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Total Anggota" value={stats.totalMerchants} icon={<Store className="h-5 w-5" />} description={`${stats.pendingMerchants} menunggu`} />
        <StatsCard title="Iuran/Bulan" value={formatPrice(group.monthly_fee)} icon={<Wallet className="h-5 w-5" />} />
        <StatsCard title="Kas Terkumpul" value={formatPrice(stats.totalKasCollected)} icon={<TrendingUp className="h-5 w-5" />} description="Sepanjang waktu" />
        <StatsCard title="Kas Tertunggak" value={formatPrice(stats.totalKasPending)} icon={<Bell className="h-5 w-5" />} />
      </div>

      {/* Kas Bulanan */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Iuran Kas Bulanan
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => generateKasMutation.mutate()} disabled={generateKasMutation.isPending}>
                <Plus className="h-3 w-3 mr-1" /> Generate Tagihan
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleOpenBillingDialog}>
                <FileText className="h-3 w-3 mr-1" /> Tagihan Individual
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSendMassReminder}>
                <Send className="h-3 w-3 mr-1" /> Kirim Pengingat
              </Button>
            </div>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground pt-1">
            <span>Lunas: <strong className="text-green-600">{paidCount}</strong></span>
            <span>Belum: <strong className="text-red-500">{unpaidCount}</strong></span>
            <span>Terkumpul: <strong>{formatPrice(monthlyCollected)}</strong></span>
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Belum ada tagihan untuk {MONTHS[selectedMonth - 1]} {selectedYear}.</p>
              <p className="text-xs mt-1">Klik "Generate Tagihan" untuk membuat tagihan semua anggota.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal Bayar</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-sm">{p.merchant?.name || '—'}</TableCell>
                      <TableCell className="text-sm">{formatPrice(p.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'PAID' ? 'default' : 'secondary'} className={p.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {p.status === 'PAID' ? 'Lunas' : 'Belum Bayar'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.payment_date ? new Date(p.payment_date).toLocaleDateString('id-ID') : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.status === 'UNPAID' ? (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-200" onClick={() => markPaidMutation.mutate(p.id)} disabled={markPaidMutation.isPending}>
                                <Check className="h-3 w-3 mr-1" /> Lunas
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => sendReminderMutation.mutate(p)}>
                                <Send className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => markUnpaidMutation.mutate(p.id)} disabled={markUnpaidMutation.isPending}>
                              <X className="h-3 w-3 mr-1" /> Batalkan
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: edit pengaturan grup */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pengaturan Kelompok</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Kelompok</Label>
              <Input value={groupName} onChange={e => setGroupName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={groupDescription} onChange={e => setGroupDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Iuran Kas Bulanan (Rp)</Label>
              <Input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button>
            <Button onClick={() => updateGroupMutation.mutate()} disabled={updateGroupMutation.isPending}>
              {updateGroupMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: tagihan individual */}
      <Dialog open={billingDialogOpen} onOpenChange={setBillingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Tagihan Individual</DialogTitle>
            <DialogDescription>Buat tagihan kas untuk satu merchant secara manual</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pilih Merchant *</Label>
              <Select value={billingMerchantId} onValueChange={setBillingMerchantId}>
                <SelectTrigger><SelectValue placeholder="Pilih merchant..." /></SelectTrigger>
                <SelectContent>
                  {groupMembers.map(m => (
                    <SelectItem key={m.merchant_id} value={m.merchant_id}>{(m.merchant as any)?.name || m.merchant_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Jumlah (Rp)</Label>
                <Input type="number" value={billingAmount} onChange={e => setBillingAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bulan</Label>
                <Select value={billingMonth} onValueChange={setBillingMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tahun</Label>
              <Select value={billingYear} onValueChange={setBillingYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={billingNote} onChange={e => setBillingNote(e.target.value)} rows={2} placeholder="Catatan tagihan (opsional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillingDialogOpen(false)}>Batal</Button>
            <Button onClick={() => createBillingMutation.mutate()} disabled={createBillingMutation.isPending}>
              {createBillingMutation.isPending ? 'Membuat...' : 'Buat Tagihan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GroupAnnouncementDialog
        open={announcementOpen}
        onOpenChange={setAnnouncementOpen}
        groupId={group.id}
      />
    </VerifikatorLayout>
  );
}
