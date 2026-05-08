import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Star, Crown, Award, Gift, Settings, Users, TrendingUp,
  Search, RefreshCw, Plus, Minus, Download, History, Trophy,
  Bell, AlertTriangle, Clock
} from 'lucide-react';
import { format, parseISO, addDays, differenceInDays, isAfter } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface LoyaltyProgram {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  earn_per_rupiah: number;
  redeem_rate: number;
  min_redeem_points: number;
  max_redeem_percent: number;
  point_expiry_days: number;
  tiers: Tier[];
}

interface Tier {
  name: string;
  min_points: number;
  discount_percent: number;
  color: string;
}

interface CustomerPoints {
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  total_points: number;
  used_points: number;
  available_points: number;
  tier: string;
  total_purchase: number;
  transaction_count: number;
}

interface PointTransaction {
  id: string;
  type: string;
  points: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

const TIER_COLORS: Record<string, string> = {
  Bronze: '#92400e',
  Silver: '#6b7280',
  Gold: '#d97706',
  Platinum: '#7c3aed',
};

const DEFAULT_TIERS: Tier[] = [
  { name: 'Bronze', min_points: 0, discount_percent: 0, color: '#92400e' },
  { name: 'Silver', min_points: 500, discount_percent: 2, color: '#6b7280' },
  { name: 'Gold', min_points: 2000, discount_percent: 5, color: '#d97706' },
  { name: 'Platinum', min_points: 5000, discount_percent: 8, color: '#7c3aed' },
];

export default function POSLoyaltyPage() {
  const { tenant, formatCurrency } = usePOS();
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [customers, setCustomers] = useState<CustomerPoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('overview');

  const [settingsDialog, setSettingsDialog] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>({});

  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjustCustomer, setAdjustCustomer] = useState<CustomerPoints | null>(null);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');

  const [historyDialog, setHistoryDialog] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<CustomerPoints | null>(null);
  const [historyTx, setHistoryTx] = useState<PointTransaction[]>([]);

  // Expiry notifications state
  const [expiringCustomers, setExpiringCustomers] = useState<{ customer: CustomerPoints; expiry_date: Date; days_left: number }[]>([]);

  const [stats, setStats] = useState({
    totalMembers: 0, activeMembers: 0, totalPointsIssued: 0, totalPointsRedeemed: 0,
  });

  // Hitung pelanggan dengan poin hampir kedaluwarsa — dideklarasikan sebelum fetchAll
  const calcExpiringCustomers = useCallback((customerList: CustomerPoints[], prog: LoyaltyProgram | null) => {
    if (!prog || prog.point_expiry_days <= 0) { setExpiringCustomers([]); return; }
    const WARN_DAYS = 30;
    const results: { customer: CustomerPoints; expiry_date: Date; days_left: number }[] = [];
    customerList.forEach(c => {
      if (c.available_points <= 0) return;
      const expiry_date = addDays(new Date(), prog.point_expiry_days);
      const days_left = prog.point_expiry_days;
      if (days_left <= WARN_DAYS) {
        results.push({ customer: c, expiry_date, days_left });
      }
    });
    setExpiringCustomers(results);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);

    // Ambil program loyalty
    const { data: prog } = await supabase
      .from('pos_loyalty_programs' as any)
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    setProgram(prog as unknown as LoyaltyProgram | null);

    // Ambil data poin pelanggan
    const { data: custData } = await supabase
      .from('pos_customers' as any)
      .select('id, name, phone, total_purchase, transaction_count, loyalty_points, loyalty_tier')
      .eq('tenant_id', tenant.id)
      .order('loyalty_points', { ascending: false });

    const mapped: CustomerPoints[] = ((custData || []) as any[]).map((c: any) => ({
      customer_id: c.id,
      customer_name: c.name,
      customer_phone: c.phone,
      total_points: c.loyalty_points || 0,
      used_points: 0,
      available_points: c.loyalty_points || 0,
      tier: c.loyalty_tier || 'Bronze',
      total_purchase: c.total_purchase || 0,
      transaction_count: c.transaction_count || 0,
    }));

    setCustomers(mapped);
    calcExpiringCustomers(mapped, prog as unknown as LoyaltyProgram | null);

    // Stats
    setStats({
      totalMembers: mapped.length,
      activeMembers: mapped.filter(c => c.transaction_count > 0).length,
      totalPointsIssued: mapped.reduce((s, c) => s + c.total_points, 0),
      totalPointsRedeemed: mapped.reduce((s, c) => s + c.used_points, 0),
    });

    setLoading(false);
  }, [tenant, calcExpiringCustomers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openSettings = () => {
    setSettingsForm(program ? {
      name: program.name,
      description: program.description || '',
      is_active: program.is_active,
      earn_per_rupiah: program.earn_per_rupiah,
      redeem_rate: program.redeem_rate,
      min_redeem_points: program.min_redeem_points,
      max_redeem_percent: program.max_redeem_percent,
      point_expiry_days: program.point_expiry_days,
      tiers: program.tiers,
    } : {
      name: 'Program Poin',
      description: '',
      is_active: true,
      earn_per_rupiah: 10000,
      redeem_rate: 100,
      min_redeem_points: 100,
      max_redeem_percent: 50,
      point_expiry_days: 0,
      tiers: DEFAULT_TIERS,
    });
    setSettingsDialog(true);
  };

  const saveSettings = async () => {
    if (!tenant) return;
    const payload = {
      tenant_id: tenant.id,
      name: settingsForm.name,
      description: settingsForm.description || null,
      is_active: settingsForm.is_active,
      earn_per_rupiah: Number(settingsForm.earn_per_rupiah),
      redeem_rate: Number(settingsForm.redeem_rate),
      min_redeem_points: Number(settingsForm.min_redeem_points),
      max_redeem_percent: Number(settingsForm.max_redeem_percent),
      point_expiry_days: Number(settingsForm.point_expiry_days),
      tiers: settingsForm.tiers,
      updated_at: new Date().toISOString(),
    };
    const { error } = program
      ? await supabase.from('pos_loyalty_programs' as any).update(payload).eq('id', program.id)
      : await supabase.from('pos_loyalty_programs' as any).insert(payload);
    if (error) { toast.error('Gagal menyimpan pengaturan'); return; }
    toast.success('Pengaturan loyalty disimpan');
    setSettingsDialog(false);
    fetchAll();
  };

  const openAdjust = (c: CustomerPoints) => {
    setAdjustCustomer(c);
    setAdjustPoints('');
    setAdjustNote('');
    setAdjustType('add');
    setAdjustDialog(true);
  };

  const saveAdjust = async () => {
    if (!tenant || !adjustCustomer || !adjustPoints) return;
    const pts = parseInt(adjustPoints);
    if (isNaN(pts) || pts <= 0) return toast.error('Masukkan jumlah poin yang valid');
    if (adjustType === 'subtract' && pts > adjustCustomer.available_points) {
      return toast.error('Poin tidak mencukupi');
    }
    const delta = adjustType === 'add' ? pts : -pts;
    const newPoints = adjustCustomer.available_points + delta;
    await supabase.from('pos_customers' as any)
      .update({ loyalty_points: Math.max(0, newPoints) })
      .eq('id', adjustCustomer.customer_id);
    toast.success(`Berhasil ${adjustType === 'add' ? 'menambah' : 'mengurangi'} ${pts} poin`);
    setAdjustDialog(false);
    fetchAll();
  };

  const openHistory = async (c: CustomerPoints) => {
    setHistoryCustomer(c);
    const { data } = await supabase
      .from('pos_loyalty_transactions' as any)
      .select('*')
      .eq('customer_id', c.customer_id)
      .eq('tenant_id', tenant!.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setHistoryTx((data || []) as unknown as PointTransaction[]);
    setHistoryDialog(true);
  };

  const exportCSV = () => {
    const rows = [['Nama Pelanggan', 'Telepon', 'Tier', 'Poin Tersedia', 'Total Transaksi', 'Total Pembelian']];
    customers.forEach(c => rows.push([
      c.customer_name, c.customer_phone || '-', c.tier,
      String(c.available_points), String(c.transaction_count), formatCurrency(c.total_purchase),
    ]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'loyalty-pelanggan.csv'; a.click();
  };

  const filtered = customers.filter(c =>
    c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.customer_phone || '').includes(search)
  );

  const getTierInfo = (tierName: string) => {
    if (!program) return DEFAULT_TIERS.find(t => t.name === tierName) || DEFAULT_TIERS[0];
    return program.tiers.find(t => t.name === tierName) || program.tiers[0];
  };

  const getNextTier = (currentTier: string) => {
    const tiers = program?.tiers || DEFAULT_TIERS;
    const idx = tiers.findIndex(t => t.name === currentTier);
    return idx < tiers.length - 1 ? tiers[idx + 1] : null;
  };

  const pointTypeConfig: Record<string, { label: string; color: string }> = {
    earn: { label: 'Poin Masuk', color: 'text-emerald-600' },
    redeem: { label: 'Penukaran', color: 'text-orange-600' },
    adjust: { label: 'Penyesuaian', color: 'text-blue-600' },
    expire: { label: 'Kedaluwarsa', color: 'text-red-600' },
  };

  return (
    <POSLayout
      title="Program Loyalty"
      subtitle="Kelola poin pelanggan, tier member, dan reward"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>
          <Button size="sm" variant="outline" onClick={openSettings}>
            <Settings className="h-4 w-4 mr-1" />Pengaturan Program
          </Button>
        </div>
      }
    >
      {/* Status banner jika belum ada program */}
      {!program && !loading && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-orange-800">Program Loyalty Belum Dikonfigurasi</p>
              <p className="text-sm text-orange-700 mt-0.5">Klik "Pengaturan Program" untuk mengaktifkan sistem poin pelanggan</p>
            </div>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" size="sm" onClick={openSettings}>
              Konfigurasi Sekarang
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Pelanggan', value: stats.totalMembers, icon: <Users className="h-5 w-5 text-blue-500" />, color: 'bg-blue-50' },
          { label: 'Pernah Bertransaksi', value: stats.activeMembers, icon: <TrendingUp className="h-5 w-5 text-emerald-500" />, color: 'bg-emerald-50' },
          { label: 'Total Poin Diterbitkan', value: stats.totalPointsIssued.toLocaleString('id-ID'), icon: <Star className="h-5 w-5 text-yellow-500" />, color: 'bg-yellow-50' },
          { label: 'Total Poin Ditukar', value: stats.totalPointsRedeemed.toLocaleString('id-ID'), icon: <Gift className="h-5 w-5 text-purple-500" />, color: 'bg-purple-50' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ---- EXPIRY NOTIFICATION BANNER ---- */}
      {expiringCustomers.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0 animate-pulse" />
              <div className="flex-1">
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Notifikasi Expiry Poin — {expiringCustomers.length} Pelanggan
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                  Program loyalty mengatur masa berlaku poin <strong>{program?.point_expiry_days} hari</strong>. Ingatkan pelanggan berikut untuk menukarkan poin mereka sebelum kedaluwarsa:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {expiringCustomers.slice(0, 8).map(({ customer, days_left }) => (
                    <div key={customer.customer_id} className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full px-3 py-1">
                      <Clock className="h-3 w-3 text-amber-700" />
                      <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">{customer.customer_name}</span>
                      <span className="text-xs text-amber-600">— {customer.available_points.toLocaleString('id-ID')} poin</span>
                      <Badge className="bg-amber-200 text-amber-800 border-0 text-xs ml-1">{days_left}h</Badge>
                    </div>
                  ))}
                  {expiringCustomers.length > 8 && (
                    <span className="text-xs text-amber-700 self-center">+{expiringCustomers.length - 8} lainnya</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="overview"><Users className="h-3.5 w-3.5 mr-1.5" />Daftar Poin</TabsTrigger>
            <TabsTrigger value="tiers"><Trophy className="h-3.5 w-3.5 mr-1.5" />Tier Member</TabsTrigger>
            <TabsTrigger value="expiry" className="relative">
              <Bell className="h-3.5 w-3.5 mr-1.5" />Notif Expiry
              {expiringCustomers.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {expiringCustomers.length > 9 ? '9+' : expiringCustomers.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm" placeholder="Cari pelanggan..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* ---- DAFTAR POIN ---- */}
        <TabsContent value="overview">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Memuat data...</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <Star className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Belum ada data pelanggan</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pelanggan</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Poin Tersedia</TableHead>
                      <TableHead>Kemajuan Tier</TableHead>
                      <TableHead>Total Belanja</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(c => {
                      const tierInfo = getTierInfo(c.tier);
                      const nextTier = getNextTier(c.tier);
                      const progress = nextTier
                        ? Math.min(100, ((c.total_points - (tierInfo?.min_points || 0)) / (nextTier.min_points - (tierInfo?.min_points || 0))) * 100)
                        : 100;
                      return (
                        <TableRow key={c.customer_id}>
                          <TableCell>
                            <div className="font-medium text-sm">{c.customer_name}</div>
                            {c.customer_phone && <div className="text-xs text-muted-foreground">{c.customer_phone}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge style={{ backgroundColor: TIER_COLORS[c.tier] || '#6b7280', color: 'white' }}>
                              {c.tier === 'Platinum' && <Crown className="h-3 w-3 mr-1 inline" />}
                              {c.tier === 'Gold' && <Award className="h-3 w-3 mr-1 inline" />}
                              {c.tier}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-emerald-600">{c.available_points.toLocaleString('id-ID')}</div>
                            <div className="text-xs text-muted-foreground">poin</div>
                          </TableCell>
                          <TableCell className="w-36">
                            {nextTier ? (
                              <div>
                                <Progress value={progress} className="h-1.5 mb-1" />
                                <div className="text-xs text-muted-foreground">
                                  {(nextTier.min_points - c.total_points).toLocaleString('id-ID')} poin lagi ke {nextTier.name}
                                </div>
                              </div>
                            ) : (
                              <Badge className="bg-purple-100 text-purple-700 text-xs">Tier Tertinggi</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{formatCurrency(c.total_purchase)}</div>
                            <div className="text-xs text-muted-foreground">{c.transaction_count} transaksi</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openAdjust(c)}>
                                <Plus className="h-3 w-3 mr-1" />Sesuaikan
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openHistory(c)}>
                                <History className="h-3 w-3 mr-1" />Riwayat
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- TIERS ---- */}
        <TabsContent value="tiers">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(program?.tiers || DEFAULT_TIERS).map((tier, i) => {
              const memberCount = customers.filter(c => c.tier === tier.name).length;
              const pct = customers.length > 0 ? Math.round((memberCount / customers.length) * 100) : 0;
              return (
                <Card key={i} className="relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: tier.color }} />
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }} />
                      {tier.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min. Poin</span>
                        <span className="font-medium">{tier.min_points.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bonus Diskon</span>
                        <span className="font-medium text-emerald-600">{tier.discount_percent}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Jumlah Member</span>
                        <span className="font-bold">{memberCount}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <div className="text-xs text-muted-foreground text-center">{pct}% dari total pelanggan</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {program && (
            <Card className="mt-6">
              <CardHeader><CardTitle className="text-sm">Cara Kerja Program Poin</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <div className="font-semibold text-emerald-700 mb-1">📈 Cara Dapatkan Poin</div>
                    <div className="text-emerald-600">
                      Setiap belanja {formatCurrency(program.earn_per_rupiah)} = <strong>1 poin</strong>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="font-semibold text-blue-700 mb-1">🔄 Cara Tukar Poin</div>
                    <div className="text-blue-600">
                      {program.redeem_rate} poin = <strong>{formatCurrency(1)}</strong> diskon
                    </div>
                    <div className="text-xs text-blue-500 mt-1">Min. tukar: {program.min_redeem_points} poin</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="font-semibold text-purple-700 mb-1">⏰ Masa Berlaku Poin</div>
                    <div className="text-purple-600">
                      {program.point_expiry_days > 0 ? `${program.point_expiry_days} hari` : 'Tidak kedaluwarsa'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ---- NOTIFIKASI EXPIRY POIN ---- */}
        <TabsContent value="expiry">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-500" />
                Notifikasi Expiry Poin
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!program || program.point_expiry_days <= 0 ? (
                <div className="text-center py-10">
                  <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">Masa berlaku poin tidak diatur</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Atur masa berlaku poin di <strong>Pengaturan Program</strong> untuk mengaktifkan notifikasi expiry.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={openSettings}>
                    <Settings className="h-4 w-4 mr-1" />Pengaturan Program
                  </Button>
                </div>
              ) : expiringCustomers.length === 0 ? (
                <div className="text-center py-10">
                  <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Tidak ada poin yang hampir kedaluwarsa</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pelanggan yang poinnya akan kedaluwarsa dalam 30 hari akan muncul di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-800">
                      <strong>{expiringCustomers.length} pelanggan</strong> memiliki poin yang akan kedaluwarsa dalam {Math.min(...expiringCustomers.map(e => e.days_left))}–{Math.max(...expiringCustomers.map(e => e.days_left))} hari.
                      Segera hubungi mereka untuk mengingatkan penggunaan poin.
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pelanggan</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Poin Tersedia</TableHead>
                        <TableHead>Kedaluwarsa Dalam</TableHead>
                        <TableHead>Estimasi Nilai</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiringCustomers.map(({ customer, expiry_date, days_left }) => (
                        <TableRow key={customer.customer_id}>
                          <TableCell>
                            <div className="font-medium text-sm">{customer.customer_name}</div>
                            {customer.customer_phone && (
                              <div className="text-xs text-muted-foreground">{customer.customer_phone}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge style={{ backgroundColor: TIER_COLORS[customer.tier] || '#6b7280', color: 'white' }}>
                              {customer.tier}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-amber-600">{customer.available_points.toLocaleString('id-ID')}</span>
                            <span className="text-xs text-muted-foreground ml-1">poin</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                              <Badge className={`border-0 text-xs ${days_left <= 7 ? 'bg-red-100 text-red-700' : days_left <= 14 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                                {days_left} hari
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {format(expiry_date, 'dd MMM yyyy', { locale: idLocale })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {program && (
                              <span className="text-sm font-medium text-emerald-600">
                                {formatCurrency(Math.floor(customer.available_points / program.redeem_rate))}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---- DIALOG PENGATURAN ---- */}
      <Dialog open={settingsDialog} onOpenChange={setSettingsDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pengaturan Program Loyalty</DialogTitle>
          </DialogHeader>
          {settingsForm.name !== undefined && (
            <div className="space-y-4">
              <div>
                <Label>Nama Program</Label>
                <Input value={settingsForm.name} onChange={e => setSettingsForm((f: any) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={settingsForm.is_active} onCheckedChange={v => setSettingsForm((f: any) => ({ ...f, is_active: v }))} />
                <Label>Program Aktif</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Earn: Rp per 1 Poin</Label>
                  <Input type="number" min={1} value={settingsForm.earn_per_rupiah}
                    onChange={e => setSettingsForm((f: any) => ({ ...f, earn_per_rupiah: e.target.value }))} />
                  <p className="text-xs text-muted-foreground mt-1">Setiap kelipatan Rp ini = 1 poin</p>
                </div>
                <div>
                  <Label>Redeem: Poin per Rp 1</Label>
                  <Input type="number" min={1} value={settingsForm.redeem_rate}
                    onChange={e => setSettingsForm((f: any) => ({ ...f, redeem_rate: e.target.value }))} />
                  <p className="text-xs text-muted-foreground mt-1">Jumlah poin untuk mendapat Rp 1 diskon</p>
                </div>
                <div>
                  <Label>Min. Poin untuk Tukar</Label>
                  <Input type="number" min={0} value={settingsForm.min_redeem_points}
                    onChange={e => setSettingsForm((f: any) => ({ ...f, min_redeem_points: e.target.value }))} />
                </div>
                <div>
                  <Label>Maks. Diskon dari Poin (%)</Label>
                  <Input type="number" min={0} max={100} value={settingsForm.max_redeem_percent}
                    onChange={e => setSettingsForm((f: any) => ({ ...f, max_redeem_percent: e.target.value }))} />
                  <p className="text-xs text-muted-foreground mt-1">Batas % nilai transaksi yang bisa dibayar poin</p>
                </div>
                <div className="col-span-2">
                  <Label>Masa Berlaku Poin (hari, 0 = tidak kedaluwarsa)</Label>
                  <Input type="number" min={0} value={settingsForm.point_expiry_days}
                    onChange={e => setSettingsForm((f: any) => ({ ...f, point_expiry_days: e.target.value }))} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialog(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveSettings}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- DIALOG PENYESUAIAN POIN ---- */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sesuaikan Poin — {adjustCustomer?.customer_name}</DialogTitle>
          </DialogHeader>
          {adjustCustomer && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold text-emerald-600">{adjustCustomer.available_points.toLocaleString('id-ID')}</div>
                <div className="text-xs text-muted-foreground">Poin saat ini</div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={adjustType === 'add' ? 'default' : 'outline'}
                  className={adjustType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700 flex-1' : 'flex-1'}
                  onClick={() => setAdjustType('add')}
                >
                  <Plus className="h-4 w-4 mr-1" />Tambah
                </Button>
                <Button
                  variant={adjustType === 'subtract' ? 'destructive' : 'outline'}
                  className="flex-1"
                  onClick={() => setAdjustType('subtract')}
                >
                  <Minus className="h-4 w-4 mr-1" />Kurangi
                </Button>
              </div>
              <div>
                <Label>Jumlah Poin</Label>
                <Input type="number" min={1} value={adjustPoints}
                  onChange={e => setAdjustPoints(e.target.value)} placeholder="Masukkan jumlah poin" />
              </div>
              <div>
                <Label>Catatan</Label>
                <Input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="Alasan penyesuaian (opsional)" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveAdjust}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- DIALOG RIWAYAT POIN ---- */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riwayat Poin — {historyCustomer?.customer_name}</DialogTitle>
          </DialogHeader>
          {historyTx.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Belum ada riwayat transaksi poin
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Poin</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyTx.map(tx => {
                  const cfg = pointTypeConfig[tx.type] || { label: tx.type, color: 'text-foreground' };
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs">
                        {format(parseISO(tx.created_at), 'dd MMM yy HH:mm', { locale: idLocale })}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                        {tx.description && <div className="text-xs text-muted-foreground">{tx.description}</div>}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${tx.points > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right text-sm">{tx.balance_after.toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
