import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Wallet, Plus, Minus, Clock, CheckCircle, TrendingUp, TrendingDown,
  ArrowUpCircle, ArrowDownCircle, Download, AlertCircle, RefreshCw,
  LockOpen, Lock, ShoppingCart, Banknote
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface CashSession {
  id: string;
  session_number: string;
  cashier_name: string;
  status: 'open' | 'closed';
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  cash_sales_total: number;
  non_cash_sales_total: number;
  cash_in_total: number;
  cash_out_total: number;
  notes_open: string | null;
  notes_close: string | null;
  opened_at: string;
  closed_at: string | null;
  pos_cash_mutations?: CashMutation[];
}

interface CashMutation {
  id: string;
  type: 'in' | 'out';
  category: string;
  amount: number;
  description: string;
  reference: string | null;
  created_at: string;
}

const CASH_IN_CATEGORIES = [
  { value: 'sales_cash', label: 'Penjualan Tunai' },
  { value: 'modal', label: 'Modal / Setoran' },
  { value: 'hutang_diterima', label: 'Pembayaran Piutang' },
  { value: 'lain_masuk', label: 'Lain-lain (Masuk)' },
];

const CASH_OUT_CATEGORIES = [
  { value: 'purchase', label: 'Pembelian Barang' },
  { value: 'operational', label: 'Biaya Operasional' },
  { value: 'gaji', label: 'Gaji / Upah' },
  { value: 'hutang_bayar', label: 'Bayar Hutang' },
  { value: 'lain_keluar', label: 'Lain-lain (Keluar)' },
];

function generateSessionNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `KAS-${y}${m}${d}-${h}${min}`;
}

export default function POSKasPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [mutations, setMutations] = useState<CashMutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('session');

  const [openSessionDialog, setOpenSessionDialog] = useState(false);
  const [closeSessionDialog, setCloseSessionDialog] = useState(false);
  const [mutationDialog, setMutationDialog] = useState(false);
  const [mutationType, setMutationType] = useState<'in' | 'out'>('in');

  const [openForm, setOpenForm] = useState({ opening_balance: '', notes: '', cashier_name: '' });
  const [closeForm, setCloseForm] = useState({ closing_balance: '', notes: '' });
  const [mutationForm, setMutationForm] = useState({ category: '', amount: '', description: '', reference: '' });

  const [salesCashToday, setSalesCashToday] = useState(0);
  const [salesNonCashToday, setSalesNonCashToday] = useState(0);

  const fetchSessions = useCallback(async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);

    const { data } = await supabase
      .from('pos_cash_sessions' as any)
      .select('*, pos_cash_mutations(*)')
      .eq('tenant_id', tenant.id)
      .eq('outlet_id', activeOutlet.id)
      .order('opened_at', { ascending: false })
      .limit(30);

    const list = (data || []) as unknown as CashSession[];
    setSessions(list);
    const open = list.find(s => s.status === 'open') || null;
    setActiveSession(open);

    if (open) {
      setMutations((open.pos_cash_mutations || []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    }
    setLoading(false);
  }, [tenant, activeOutlet]);

  const fetchTodaySales = useCallback(async () => {
    if (!tenant || !activeOutlet) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('pos_sales' as any)
      .select('total, payment_method')
      .eq('tenant_id', tenant.id)
      .eq('outlet_id', activeOutlet.id)
      .eq('status', 'completed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const sales = (data || []) as any[];
    const cashTotal = sales.filter(s => s.payment_method === 'cash').reduce((s, r) => s + Number(r.total), 0);
    const nonCashTotal = sales.filter(s => s.payment_method !== 'cash').reduce((s, r) => s + Number(r.total), 0);
    setSalesCashToday(cashTotal);
    setSalesNonCashToday(nonCashTotal);
  }, [tenant, activeOutlet]);

  useEffect(() => {
    fetchSessions();
    fetchTodaySales();
  }, [fetchSessions, fetchTodaySales]);

  useEffect(() => {
    if (user) {
      setOpenForm(f => ({ ...f, cashier_name: user.email?.split('@')[0] || 'Kasir' }));
    }
  }, [user]);

  const openSession = async () => {
    if (!tenant || !activeOutlet || !user) return;
    if (!openForm.opening_balance) { toast.error('Saldo awal wajib diisi'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('pos_cash_sessions' as any).insert({
        tenant_id: tenant.id,
        outlet_id: activeOutlet.id,
        cashier_id: user.id,
        cashier_name: openForm.cashier_name || user.email || 'Kasir',
        session_number: generateSessionNumber(),
        status: 'open',
        opening_balance: Number(openForm.opening_balance),
        cash_sales_total: salesCashToday,
        non_cash_sales_total: salesNonCashToday,
        cash_in_total: 0,
        cash_out_total: 0,
        notes_open: openForm.notes || null,
      });
      if (error) throw error;
      toast.success('Sesi kas dibuka');
      setOpenSessionDialog(false);
      setOpenForm({ opening_balance: '', notes: '', cashier_name: openForm.cashier_name });
      fetchSessions();
    } catch (err: any) {
      toast.error('Gagal buka sesi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getExpectedBalance = () => {
    if (!activeSession) return 0;
    return (
      Number(activeSession.opening_balance) +
      salesCashToday +
      Number(activeSession.cash_in_total) -
      Number(activeSession.cash_out_total)
    );
  };

  const closeSession = async () => {
    if (!activeSession || !user) return;
    if (!closeForm.closing_balance) { toast.error('Saldo akhir wajib diisi'); return; }
    setSaving(true);
    const expected = getExpectedBalance();
    const closing = Number(closeForm.closing_balance);
    const diff = closing - expected;
    try {
      const { error } = await supabase.from('pos_cash_sessions' as any)
        .update({
          status: 'closed',
          closing_balance: closing,
          expected_balance: expected,
          difference: diff,
          cash_sales_total: salesCashToday,
          non_cash_sales_total: salesNonCashToday,
          notes_close: closeForm.notes || null,
          closed_at: new Date().toISOString(),
        })
        .eq('id', activeSession.id);
      if (error) throw error;
      toast.success('Sesi kas ditutup');
      setCloseSessionDialog(false);
      setCloseForm({ closing_balance: '', notes: '' });
      fetchSessions();
    } catch (err: any) {
      toast.error('Gagal tutup sesi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addMutation = async () => {
    if (!activeSession || !tenant || !activeOutlet || !user) return;
    if (!mutationForm.amount || !mutationForm.description) {
      toast.error('Jumlah dan keterangan wajib diisi'); return;
    }
    setSaving(true);
    try {
      const amount = Number(mutationForm.amount);
      const { error: mutErr } = await supabase.from('pos_cash_mutations' as any).insert({
        tenant_id: tenant.id,
        outlet_id: activeOutlet.id,
        cash_session_id: activeSession.id,
        type: mutationType,
        category: mutationForm.category || (mutationType === 'in' ? 'lain_masuk' : 'lain_keluar'),
        amount,
        description: mutationForm.description,
        reference: mutationForm.reference || null,
        created_by: user.id,
      });
      if (mutErr) throw mutErr;

      const field = mutationType === 'in' ? 'cash_in_total' : 'cash_out_total';
      const currentVal = mutationType === 'in' ? Number(activeSession.cash_in_total) : Number(activeSession.cash_out_total);
      await supabase.from('pos_cash_sessions' as any)
        .update({ [field]: currentVal + amount })
        .eq('id', activeSession.id);

      toast.success(`Kas ${mutationType === 'in' ? 'masuk' : 'keluar'} berhasil dicatat`);
      setMutationDialog(false);
      setMutationForm({ category: '', amount: '', description: '', reference: '' });
      fetchSessions();
    } catch (err: any) {
      toast.error('Gagal catat mutasi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['No Sesi', 'Kasir', 'Status', 'Dibuka', 'Ditutup', 'Saldo Awal', 'Saldo Akhir', 'Selisih'],
      ...sessions.map(s => [
        s.session_number, s.cashier_name,
        s.status === 'open' ? 'Aktif' : 'Tutup',
        format(new Date(s.opened_at), 'dd/MM/yyyy HH:mm'),
        s.closed_at ? format(new Date(s.closed_at), 'dd/MM/yyyy HH:mm') : '-',
        s.opening_balance,
        s.closing_balance ?? '-',
        s.difference ?? '-',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `kas-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  if (!tenant) {
    return (
      <POSLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-10 w-10 mx-auto mb-2" />
            <p>Silakan setup usaha terlebih dahulu</p>
          </div>
        </div>
      </POSLayout>
    );
  }

  const expectedBalance = getExpectedBalance();

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Kas Harian</h1>
            <p className="text-muted-foreground text-sm">Kelola sesi kasir & mutasi kas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchSessions(); fetchTodaySales(); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            {!activeSession ? (
              <Button onClick={() => setOpenSessionDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <LockOpen className="h-4 w-4 mr-1" /> Buka Sesi Kasir
              </Button>
            ) : (
              <Button onClick={() => setCloseSessionDialog(true)} variant="destructive">
                <Lock className="h-4 w-4 mr-1" /> Tutup Sesi
              </Button>
            )}
          </div>
        </div>

        {/* Active Session Banner */}
        {activeSession ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-700">{activeSession.session_number}</span>
                      <Badge className="bg-emerald-600 text-white border-0 text-xs">Sesi Aktif</Badge>
                    </div>
                    <p className="text-sm text-emerald-600">
                      Kasir: {activeSession.cashier_name} • Dibuka: {format(new Date(activeSession.opened_at), 'HH:mm, dd MMM', { locale: idLocale })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <div className="text-center">
                    <p className="text-xs text-emerald-600">Saldo Awal</p>
                    <p className="font-bold">{formatCurrency(Number(activeSession.opening_balance))}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-emerald-600">Penjualan Tunai</p>
                    <p className="font-bold text-emerald-700">{formatCurrency(salesCashToday)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-emerald-600">Kas Masuk</p>
                    <p className="font-bold text-blue-600">{formatCurrency(Number(activeSession.cash_in_total))}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-emerald-600">Kas Keluar</p>
                    <p className="font-bold text-red-500">{formatCurrency(Number(activeSession.cash_out_total))}</p>
                  </div>
                  <div className="text-center border-l pl-4">
                    <p className="text-xs text-emerald-600">Ekspektasi Kas</p>
                    <p className="font-bold text-lg text-emerald-700">{formatCurrency(expectedBalance)}</p>
                  </div>
                </div>
              </div>

              {/* Quick action buttons */}
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8"
                  onClick={() => { setMutationType('in'); setMutationDialog(true); }}>
                  <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Kas Masuk
                </Button>
                <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-8"
                  onClick={() => { setMutationType('out'); setMutationDialog(true); }}>
                  <ArrowDownCircle className="h-3.5 w-3.5 mr-1" /> Kas Keluar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-2">
            <CardContent className="py-8 text-center text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Tidak ada sesi kasir aktif</p>
              <p className="text-sm mb-4">Buka sesi kasir untuk mulai mencatat kas hari ini</p>
              <Button onClick={() => setOpenSessionDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <LockOpen className="h-4 w-4 mr-1" /> Buka Sesi Kasir
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Today's Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-muted-foreground">Penjualan Tunai Hari Ini</span>
              </div>
              <p className="font-bold text-xl text-emerald-600">{formatCurrency(salesCashToday)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">Non-Tunai Hari Ini</span>
              </div>
              <p className="font-bold text-xl">{formatCurrency(salesNonCashToday)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total Kas Masuk</span>
              </div>
              <p className="font-bold text-xl text-blue-600">
                {formatCurrency(activeSession ? Number(activeSession.cash_in_total) : 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Total Kas Keluar</span>
              </div>
              <p className="font-bold text-xl text-red-500">
                {formatCurrency(activeSession ? Number(activeSession.cash_out_total) : 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Mutasi & Riwayat Sesi */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="session">Riwayat Sesi</TabsTrigger>
            {activeSession && <TabsTrigger value="mutations">Mutasi Kas</TabsTrigger>}
          </TabsList>

          {/* Mutasi Kas Tab */}
          {activeSession && (
            <TabsContent value="mutations">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Mutasi Kas — {activeSession.session_number}</CardTitle>
                </CardHeader>
                <CardContent>
                  {mutations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Belum ada mutasi kas. Gunakan tombol "Kas Masuk/Keluar"</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Waktu</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>Keterangan</TableHead>
                          <TableHead className="text-right">Jumlah</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mutations.map(mut => (
                          <TableRow key={mut.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(mut.created_at), 'HH:mm', { locale: idLocale })}
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs border-0 ${mut.type === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                {mut.type === 'in' ? (
                                  <><ArrowUpCircle className="h-3 w-3 mr-1" />Masuk</>
                                ) : (
                                  <><ArrowDownCircle className="h-3 w-3 mr-1" />Keluar</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{mut.category}</TableCell>
                            <TableCell className="text-sm">{mut.description}</TableCell>
                            <TableCell className={`text-right font-bold ${mut.type === 'in' ? 'text-blue-600' : 'text-red-500'}`}>
                              {mut.type === 'in' ? '+' : '-'}{formatCurrency(Number(mut.amount))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Riwayat Sesi Tab */}
          <TabsContent value="session">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat...</div>
            ) : sessions.filter(s => s.status === 'closed').length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Belum ada riwayat sesi kasir</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {sessions.filter(s => s.status === 'closed').map(session => {
                  const isPlus = (session.difference || 0) >= 0;
                  return (
                    <Card key={session.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-sm">{session.session_number}</span>
                              <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Tutup</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Kasir: {session.cashier_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(session.opened_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                              {session.closed_at && ` — ${format(new Date(session.closed_at), 'HH:mm', { locale: idLocale })}`}
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Saldo Awal</p>
                              <p className="font-medium">{formatCurrency(Number(session.opening_balance))}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Saldo Akhir</p>
                              <p className="font-medium">{formatCurrency(Number(session.closing_balance))}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Selisih</p>
                              <p className={`font-bold ${isPlus ? 'text-emerald-600' : 'text-red-500'}`}>
                                {isPlus ? '+' : ''}{formatCurrency(Number(session.difference))}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-4 gap-3 text-xs text-center">
                          <div>
                            <p className="text-muted-foreground">Penjualan Tunai</p>
                            <p className="font-medium text-emerald-600">{formatCurrency(Number(session.cash_sales_total))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Non-Tunai</p>
                            <p className="font-medium">{formatCurrency(Number(session.non_cash_sales_total))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Kas Masuk</p>
                            <p className="font-medium text-blue-600">{formatCurrency(Number(session.cash_in_total))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Kas Keluar</p>
                            <p className="font-medium text-red-500">{formatCurrency(Number(session.cash_out_total))}</p>
                          </div>
                        </div>
                        {session.notes_close && (
                          <p className="text-xs text-muted-foreground mt-2 italic">Catatan: {session.notes_close}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Open Session Dialog */}
        <Dialog open={openSessionDialog} onOpenChange={setOpenSessionDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Buka Sesi Kasir</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Kasir</Label>
                <Input placeholder="Nama kasir..." value={openForm.cashier_name}
                  onChange={e => setOpenForm(f => ({ ...f, cashier_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Saldo Awal Kas (Rp) *</Label>
                <Input type="number" min="0" placeholder="0" value={openForm.opening_balance}
                  onChange={e => setOpenForm(f => ({ ...f, opening_balance: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Hitung uang tunai yang ada di laci kasir sekarang</p>
              </div>
              <div className="space-y-2">
                <Label>Catatan (opsional)</Label>
                <Textarea rows={2} placeholder="Catatan pembukaan sesi..."
                  value={openForm.notes} onChange={e => setOpenForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenSessionDialog(false)}>Batal</Button>
              <Button onClick={openSession} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Membuka...' : 'Buka Sesi'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Close Session Dialog */}
        <Dialog open={closeSessionDialog} onOpenChange={setCloseSessionDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Tutup Sesi Kasir</DialogTitle>
            </DialogHeader>
            {activeSession && (
              <div className="space-y-4">
                <Card className="bg-muted/50">
                  <CardContent className="p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Saldo Awal:</span>
                      <span>{formatCurrency(Number(activeSession.opening_balance))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Penjualan Tunai:</span>
                      <span className="text-emerald-600">+{formatCurrency(salesCashToday)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kas Masuk Manual:</span>
                      <span className="text-blue-600">+{formatCurrency(Number(activeSession.cash_in_total))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kas Keluar Manual:</span>
                      <span className="text-red-500">-{formatCurrency(Number(activeSession.cash_out_total))}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Ekspektasi Saldo Akhir:</span>
                      <span className="text-emerald-600">{formatCurrency(expectedBalance)}</span>
                    </div>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  <Label>Saldo Akhir Aktual (Rp) *</Label>
                  <Input type="number" min="0" placeholder="Hitung tunai di laci..."
                    value={closeForm.closing_balance}
                    onChange={e => setCloseForm(f => ({ ...f, closing_balance: e.target.value }))} />
                  {closeForm.closing_balance && (
                    <div className={`text-sm font-medium ${Number(closeForm.closing_balance) >= expectedBalance ? 'text-emerald-600' : 'text-red-500'}`}>
                      Selisih: {Number(closeForm.closing_balance) >= expectedBalance ? '+' : ''}
                      {formatCurrency(Number(closeForm.closing_balance) - expectedBalance)}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Catatan Penutupan (opsional)</Label>
                  <Textarea rows={2} placeholder="Catatan penutupan sesi..."
                    value={closeForm.notes} onChange={e => setCloseForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCloseSessionDialog(false)}>Batal</Button>
              <Button onClick={closeSession} disabled={saving} variant="destructive">
                {saving ? 'Menutup...' : 'Tutup Sesi'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cash Mutation Dialog */}
        <Dialog open={mutationDialog} onOpenChange={setMutationDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className={mutationType === 'in' ? 'text-blue-600' : 'text-red-600'}>
                {mutationType === 'in' ? (
                  <><ArrowUpCircle className="h-5 w-5 inline mr-2" />Kas Masuk</>
                ) : (
                  <><ArrowDownCircle className="h-5 w-5 inline mr-2" />Kas Keluar</>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={mutationForm.category} onValueChange={v => setMutationForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
                  <SelectContent>
                    {(mutationType === 'in' ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES).map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jumlah (Rp) *</Label>
                <Input type="number" min="0" placeholder="0"
                  value={mutationForm.amount}
                  onChange={e => setMutationForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Keterangan *</Label>
                <Input placeholder="Deskripsi singkat..."
                  value={mutationForm.description}
                  onChange={e => setMutationForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Referensi (opsional)</Label>
                <Input placeholder="No. faktur, nama, dll..."
                  value={mutationForm.reference}
                  onChange={e => setMutationForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMutationDialog(false)}>Batal</Button>
              <Button onClick={addMutation} disabled={saving}
                className={mutationType === 'in' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </POSLayout>
  );
}
