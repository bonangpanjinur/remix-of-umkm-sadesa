import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TicketCheck, Store, TrendingUp, Wallet, Copy, Calendar, Check, X, Plus, Settings, ChevronRight, Users, Bell } from 'lucide-react';
import { VerifikatorLayout } from '@/components/verifikator/VerifikatorLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';

interface Stats {
  totalMerchants: number;
  pendingMerchants: number;
  totalUsage: number;
  totalEarnings: number;
  pendingEarnings: number;
  totalKasCollected: number;
  totalKasPending: number;
}

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
  merchant: {
    name: string;
  };
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function VerifikatorDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalMerchants: 0,
    pendingMerchants: 0,
    totalUsage: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
    totalKasCollected: 0,
    totalKasPending: 0,
  });
  const [loading, setLoading] = useState(true);
  
  // Group & Code info
  const [group, setGroup] = useState<TradeGroup | null>(null);
  const [codeInfo, setCodeInfo] = useState<CodeInfo | null>(null);
  
  // Kas payments
  const [payments, setPayments] = useState<KasPayment[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Dialogs
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('10000');
  const [referralCode, setReferralCode] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit group settings dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Get code info
      const { data: codes } = await supabase
        .from('verifikator_codes')
        .select('*')
        .eq('verifikator_id', user.id)
        .limit(1);

      const code = codes && codes.length > 0 ? codes[0] : null;
      setCodeInfo(code);

      // Get group info
      const { data: groups } = await supabase
        .from('trade_groups')
        .select('*')
        .eq('verifikator_id', user.id)
        .limit(1);

      const grp = groups && groups.length > 0 ? groups[0] : null;
      setGroup(grp);

      if (!code) {
        setLoading(false);
        return;
      }

      // Get merchants using this code
      const { data: merchants } = await supabase
        .from('merchants')
        .select('registration_status')
        .eq('verifikator_code', code.code);

      const totalMerchants = merchants?.length || 0;
      const pendingMerchants = merchants?.filter(m => m.registration_status === 'PENDING').length || 0;

      // Get earnings
      const { data: earnings } = await supabase
        .from('verifikator_earnings')
        .select('commission_amount, status')
        .eq('verifikator_id', user.id);

      const totalEarnings = earnings?.reduce((sum, e) => sum + e.commission_amount, 0) || 0;
      const pendingEarnings = earnings?.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + e.commission_amount, 0) || 0;

      // Get total kas (all time)
      let totalKasCollected = 0;
      let totalKasPending = 0;
      
      if (grp) {
        const { data: allKas } = await supabase
          .from('kas_payments')
          .select('amount, status')
          .eq('group_id', grp.id);

        totalKasCollected = allKas?.filter(k => k.status === 'PAID').reduce((sum, k) => sum + k.amount, 0) || 0;
        totalKasPending = allKas?.filter(k => k.status === 'UNPAID').reduce((sum, k) => sum + k.amount, 0) || 0;
      }

      setStats({
        totalMerchants,
        pendingMerchants,
        totalUsage: code.usage_count,
        totalEarnings,
        pendingEarnings,
        totalKasCollected,
        totalKasPending,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    if (!user || !group) return;
    
    try {
      const { data, error } = await supabase
        .from('kas_payments')
        .select(`
          *,
          merchant:merchants(name)
        `)
        .eq('group_id', group.id)
        .eq('payment_month', selectedMonth)
        .eq('payment_year', selectedYear)
        .order('status', { ascending: true });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (group) {
      fetchPayments();
    }
  }, [group, selectedMonth, selectedYear]);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setReferralCode(code);
  };

  const copyCode = () => {
    if (codeInfo) {
      navigator.clipboard.writeText(codeInfo.code);
      toast.success('Kode berhasil disalin');
    }
  };

  const handleSetup = async () => {
    if (!groupName.trim() || !referralCode.trim()) {
      toast.error('Nama kelompok dan kode referral wajib diisi');
      return;
    }

    setSaving(true);
    try {
      // Create trade group
      const { data: newGroup, error: groupError } = await supabase
        .from('trade_groups')
        .insert({
          name: groupName.trim(),
          code: referralCode.toUpperCase(),
          description: groupDescription.trim() || null,
          monthly_fee: parseInt(monthlyFee) || 10000,
          verifikator_id: user?.id,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Create referral code
      const { error: codeError } = await supabase
        .from('verifikator_codes')
        .insert({
          code: referralCode.toUpperCase(),
          trade_group: groupName.trim(),
          verifikator_id: user?.id,
        });

      if (codeError) throw codeError;

      toast.success('Kelompok dagang berhasil dibuat');
      setSetupDialogOpen(false);
      fetchData();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Kode referral sudah digunakan');
      } else {
        toast.error('Gagal membuat kelompok: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!group) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('trade_groups')
        .update({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          monthly_fee: parseInt(monthlyFee) || 10000,
        })
        .eq('id', group.id);

      if (error) throw error;

      toast.success('Pengaturan berhasil diperbarui');
      setEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error('Gagal memperbarui: ' + error.message);
    } finally {
      setSaving(false);
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

  const handleGenerateKas = async () => {
    if (!group) return;
    
    try {
      const { data, error } = await supabase.rpc('generate_monthly_kas', {
        p_group_id: group.id,
        p_month: selectedMonth,
        p_year: selectedYear,
      });

      if (error) throw error;
      
      toast.success(`${data} tagihan kas telah dibuat untuk ${MONTHS[selectedMonth - 1]} ${selectedYear}`);
      fetchPayments();
      fetchData(); // Refresh stats
    } catch (error: any) {
      toast.error('Gagal membuat tagihan: ' + error.message);
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('kas_payments')
        .update({
          status: 'PAID',
          payment_date: new Date().toISOString(),
          collected_by: user?.id,
        })
        .eq('id', paymentId);

      if (error) throw error;
      toast.success('Pembayaran berhasil dicatat');
      fetchPayments();
      fetchData(); // Refresh total kas
    } catch (error: any) {
      toast.error('Gagal mencatat pembayaran');
    }
  };

  const handleMarkAsUnpaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('kas_payments')
        .update({
          status: 'UNPAID',
          payment_date: null,
          collected_by: null,
        })
        .eq('id', paymentId);

      if (error) throw error;
      toast.success('Status pembayaran diperbarui');
      fetchPayments();
      fetchData();
    } catch (error: any) {
      toast.error('Gagal memperbarui status');
    }
  };

  const handleSendReminder = async (payment: KasPayment) => {
    try {
      // Find the merchant's user_id
      const { data: merchantData } = await supabase
        .from('merchants')
        .select('user_id, name')
        .eq('id', payment.merchant_id)
        .maybeSingle();

      if (!merchantData?.user_id) {
        toast.error('Merchant belum terhubung ke user');
        return;
      }

      // Send in-app notification
      const { error } = await supabase.from('notifications').insert({
        user_id: merchantData.user_id,
        title: 'Pengingat Iuran Kas',
        message: `Iuran kas bulan ${MONTHS[payment.payment_month - 1]} ${payment.payment_year} sebesar ${formatPrice(payment.amount)} belum dibayar. Segera lakukan pembayaran.`,
        type: 'warning',
      });

      if (error) throw error;
      toast.success(`Pengingat terkirim ke ${merchantData.name}`);
    } catch (error: any) {
      toast.error('Gagal mengirim pengingat');
    }
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

  // Show setup screen if no group/code
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

        {/* Setup Dialog */}
        <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Kelompok Dagang</DialogTitle>
              <DialogDescription>
                Satu kelompok dagang = satu kode referral untuk merchant
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nama Kelompok Dagang *</Label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Contoh: Kelompok UMKM Sukamaju"
                />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Deskripsi singkat tentang kelompok"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Kode Referral *</Label>
                <div className="flex gap-2">
                  <Input
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="KODE123"
                    className="font-mono"
                  />
                  <Button variant="outline" onClick={generateRandomCode}>
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Kode ini akan digunakan merchant untuk mendaftar ke kelompok Anda
                </p>
              </div>
              <div className="space-y-2">
                <Label>Iuran Kas Bulanan (Rp)</Label>
                <Input
                  type="number"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                  placeholder="10000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSetupDialogOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleSetup} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Buat Kelompok'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </VerifikatorLayout>
    );
  }

  const paidCount = payments.filter(p => p.status === 'PAID').length;
  const unpaidCount = payments.filter(p => p.status === 'UNPAID').length;
  const monthlyCollected = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <VerifikatorLayout title="Dashboard" subtitle={group.name}>
      {/* Group Info Card */}
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
              <Button variant="outline" size="icon" onClick={openEditDialog}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Anggota"
          value={stats.totalMerchants}
          icon={<Store className="h-5 w-5" />}
          description={`${stats.pendingMerchants} menunggu`}
        />
        <StatsCard
          title="Iuran/Bulan"
          value={formatPrice(group.monthly_fee)}
          icon={<TicketCheck className="h-5 w-5" />}
        />
        {/* Total Kas - clickable summary */}
        <Card 
          className="cursor-default"
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Kas Terkumpul</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(stats.totalKasCollected)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPrice(stats.totalKasPending)} belum terbayar
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Total Komisi - clickable to earnings */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/verifikator/earnings')}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Komisi</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(stats.totalEarnings)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPrice(stats.pendingEarnings)} dapat ditarik
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex items-center justify-end mt-2 text-xs text-primary">
              Lihat Detail <ChevronRight className="h-3 w-3 ml-1" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kas Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Pembayaran Kas Bulanan</CardTitle>
              <CardDescription>Kelola iuran kas anggota kelompok</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleGenerateKas}>
                <Plus className="h-4 w-4 mr-2" />
                Buat Tagihan
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada tagihan untuk {MONTHS[selectedMonth - 1]} {selectedYear}</p>
              <Button variant="outline" className="mt-4" onClick={handleGenerateKas}>
                Buat Tagihan Sekarang
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-muted rounded-lg flex justify-between items-center">
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Check className="h-4 w-4 text-primary" />
                    {paidCount} Lunas
                  </span>
                  <span className="flex items-center gap-1">
                    <X className="h-4 w-4 text-destructive" />
                    {unpaidCount} Belum Bayar
                  </span>
                </div>
                <span className="font-bold text-primary">{formatPrice(monthlyCollected)}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedagang</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal Bayar</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.merchant?.name || '-'}
                      </TableCell>
                      <TableCell>{formatPrice(payment.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={payment.status === 'PAID' ? 'default' : 'destructive'}>
                          {payment.status === 'PAID' ? 'Lunas' : 'Belum Bayar'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.payment_date 
                          ? new Date(payment.payment_date).toLocaleDateString('id-ID')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {payment.status === 'UNPAID' ? (
                          <>
                            <Button 
                              size="sm" 
                              onClick={() => handleMarkAsPaid(payment.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Lunas
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendReminder(payment)}
                            >
                              <Bell className="h-4 w-4 mr-1" />
                              Ingatkan
                            </Button>
                          </>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleMarkAsUnpaid(payment.id)}
                          >
                            Batalkan
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Group Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pengaturan Kelompok</DialogTitle>
            <DialogDescription>
              Perbarui informasi kelompok dagang Anda
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Kelompok</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Iuran Kas Bulanan (Rp)</Label>
              <Input
                type="number"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdateGroup} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VerifikatorLayout>
  );
}
