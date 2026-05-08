import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Plus, RefreshCw, AlertCircle, Download, TrendingDown, TrendingUp,
  AlertTriangle, DollarSign, MessageCircle, Send, Phone
} from 'lucide-react';
import { format, parseISO, isBefore, differenceInDays, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Debt {
  id: string;
  type: 'payable' | 'receivable';
  party_name: string;
  phone: string | null;
  amount: number;
  remaining: number;
  due_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:  { label: 'Aktif',       color: 'bg-blue-100 text-blue-700'    },
  paid:    { label: 'Lunas',       color: 'bg-emerald-100 text-emerald-700' },
  overdue: { label: 'Jatuh Tempo', color: 'bg-red-100 text-red-700'      },
};

function cleanPhone(raw: string) {
  let p = raw.replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  if (!p.startsWith('62')) p = '62' + p;
  return p;
}

export default function POSHutangPiutangPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [debts, setDebts]       = useState<Debt[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterType, setFilterType]     = useState<'all'|'payable'|'receivable'>('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({
    type:'payable', party_name:'', phone:'', amount:'', due_date:'', notes:''
  });
  const [saving, setSaving] = useState(false);

  const [payDialog, setPayDialog] = useState(false);
  const [payForm, setPayForm] = useState({
    amount:'', payment_date: format(new Date(),'yyyy-MM-dd'), notes:''
  });

  const fetchAll = useCallback(async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    try {
      const res = await supabase.from('pos_debts' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('outlet_id', activeOutlet.id)
        .order('created_at', { ascending: false });
      const now = new Date();
      const list = ((res.data || []) as Debt[]).map(d => ({
        ...d,
        status: d.remaining <= 0 ? 'paid'
          : (d.due_date && isBefore(parseISO(d.due_date), now)) ? 'overdue'
          : 'active',
      }));
      setDebts(list);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [tenant, activeOutlet]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── WhatsApp helpers ─────────────────────────────────────────── */
  const buildWAMessage = (d: Debt) => {
    const toko   = tenant?.name || 'Toko Kami';
    const sisa   = formatCurrency(d.remaining);
    const jatuh  = d.due_date ? format(parseISO(d.due_date), 'dd MMMM yyyy', { locale: idLocale }) : '-';
    const days   = d.due_date ? differenceInDays(parseISO(d.due_date), new Date()) : null;
    const status = d.status === 'overdue' ? '⛔ SUDAH LEWAT JATUH TEMPO' : days !== null ? `⚠️ ${days} hari lagi` : '';

    if (d.type === 'receivable') {
      // Tagihan ke customer — pesan koleksi
      return encodeURIComponent(
        `Halo ${d.party_name},\n\n` +
        `Kami dari *${toko}* ingin mengingatkan bahwa Anda masih memiliki tagihan yang belum dilunasi:\n\n` +
        `💰 Sisa tagihan : *${sisa}*\n` +
        `📅 Jatuh tempo  : *${jatuh}*\n` +
        (status ? `📢 Status        : ${status}\n` : '') +
        `\nMohon segera melunasi sebelum jatuh tempo. Terima kasih atas kerjasamanya.\n\n` +
        `Salam,\n${toko}`
      );
    } else {
      // Hutang ke supplier — pengingat internal (kirim ke nomor sendiri / supplier)
      return encodeURIComponent(
        `Halo ${d.party_name},\n\n` +
        `Ini adalah pengingat dari *${toko}* bahwa kami memiliki hutang yang perlu segera diselesaikan:\n\n` +
        `💰 Sisa hutang  : *${sisa}*\n` +
        `📅 Jatuh tempo  : *${jatuh}*\n` +
        (status ? `📢 Status        : ${status}\n` : '') +
        `\nKami akan segera melakukan pembayaran. Terima kasih atas kesabaran Anda.\n\n` +
        `Salam,\n${toko}`
      );
    }
  };

  const sendWA = (d: Debt) => {
    const msg = buildWAMessage(d);
    const phone = d.phone ? cleanPhone(d.phone) : '';
    const url = phone
      ? `https://wa.me/${phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
    toast.success(`Membuka WhatsApp untuk ${d.party_name}`);
  };

  const sendBulkWA = () => {
    const overdue = debts.filter(d => d.status === 'overdue');
    if (overdue.length === 0) { toast.info('Tidak ada yang jatuh tempo'); return; }
    overdue.forEach((d, i) => {
      setTimeout(() => {
        const msg = buildWAMessage(d);
        const phone = d.phone ? cleanPhone(d.phone) : '';
        const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
        window.open(url, '_blank');
      }, i * 600);
    });
    toast.success(`Mengirim ${overdue.length} notifikasi WhatsApp...`);
  };

  /* ── CRUD ──────────────────────────────────────────────────────── */
  const saveDebt = async () => {
    if (!tenant || !activeOutlet || !form.party_name || !form.amount) {
      toast.error('Nama pihak dan jumlah wajib diisi'); return;
    }
    setSaving(true);
    try {
      const amount = Number(form.amount);
      await supabase.from('pos_debts' as any).insert({
        tenant_id: tenant.id, outlet_id: activeOutlet.id,
        type: form.type, party_name: form.party_name,
        phone: form.phone || null,
        amount, remaining: amount,
        due_date: form.due_date || null,
        status: 'active',
        notes: form.notes || null,
      });
      toast.success(`${form.type === 'payable' ? 'Hutang' : 'Piutang'} ditambahkan`);
      setDialog(false);
      fetchAll();
    } catch { toast.error('Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const recordPayment = async () => {
    if (!selectedDebt || !payForm.amount) { toast.error('Jumlah bayar wajib diisi'); return; }
    const amount = Number(payForm.amount);
    if (amount > selectedDebt.remaining) { toast.error('Jumlah melebihi sisa'); return; }
    setSaving(true);
    try {
      await supabase.from('pos_debt_payments' as any).insert({
        debt_id: selectedDebt.id, amount,
        payment_date: payForm.payment_date, notes: payForm.notes || null,
      });
      const newRemaining = selectedDebt.remaining - amount;
      await supabase.from('pos_debts' as any).update({
        remaining: newRemaining, status: newRemaining <= 0 ? 'paid' : 'active',
      }).eq('id', selectedDebt.id);
      toast.success('Pembayaran dicatat');
      setPayDialog(false);
      fetchAll();
    } catch { toast.error('Gagal mencatat'); }
    finally { setSaving(false); }
  };

  const exportCSV = () => {
    const rows = [
      ['Tipe','Pihak','No HP','Jumlah Awal','Sisa','Jatuh Tempo','Status','Keterangan'],
      ...filtered.map(d => [
        d.type === 'payable' ? 'Hutang' : 'Piutang', d.party_name,
        d.phone || '-', d.amount, d.remaining,
        d.due_date ? format(parseISO(d.due_date), 'dd/MM/yyyy') : '-',
        STATUS_CONFIG[d.status]?.label || d.status, d.notes || '-',
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `hutang-piutang-${format(new Date(),'yyyyMMdd')}.csv`; a.click();
  };

  /* ── Derived ───────────────────────────────────────────────────── */
  const filtered = debts.filter(d => {
    if (filterType !== 'all' && d.type !== filterType) return false;
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    return true;
  });

  const totalHutang  = debts.filter(d=>d.type==='payable'&&d.status!=='paid').reduce((s,d)=>s+Number(d.remaining),0);
  const totalPiutang = debts.filter(d=>d.type==='receivable'&&d.status!=='paid').reduce((s,d)=>s+Number(d.remaining),0);
  const jatuhTempo   = debts.filter(d=>d.status==='overdue');

  // Debts approaching due in ≤3 days (but not yet overdue)
  const nearDue = debts.filter(d => {
    if (d.status !== 'active' || !d.due_date) return false;
    const days = differenceInDays(parseISO(d.due_date), new Date());
    return days >= 0 && days <= 3;
  });

  if (!tenant) return (
    <POSLayout>
      <div className="flex items-center justify-center h-64">
        <AlertCircle className="h-8 w-8 text-muted-foreground"/>
      </div>
    </POSLayout>
  );

  return (
    <POSLayout>
      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Hutang & Piutang (AP/AR)</h1>
            <p className="text-muted-foreground text-sm">Kelola hutang ke supplier dan piutang dari customer</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading?'animate-spin':''}`}/> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1"/> CSV
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
              onClick={()=>{ setForm({type:'payable',party_name:'',phone:'',amount:'',due_date:'',notes:''}); setDialog(true); }}>
              <Plus className="h-4 w-4 mr-1"/> Tambah
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-red-500"/>
                <span className="text-xs text-muted-foreground">Total Hutang</span>
              </div>
              <p className="font-bold text-2xl text-red-500">{formatCurrency(totalHutang)}</p>
              <p className="text-xs text-muted-foreground">
                {debts.filter(d=>d.type==='payable'&&d.status!=='paid').length} aktif
              </p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-500"/>
                <span className="text-xs text-muted-foreground">Total Piutang</span>
              </div>
              <p className="font-bold text-2xl text-emerald-600">{formatCurrency(totalPiutang)}</p>
              <p className="text-xs text-muted-foreground">
                {debts.filter(d=>d.type==='receivable'&&d.status!=='paid').length} aktif
              </p>
            </CardContent>
          </Card>
          <Card className={jatuhTempo.length > 0 ? 'border-amber-200' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`h-4 w-4 ${jatuhTempo.length>0?'text-amber-500':'text-muted-foreground'}`}/>
                <span className="text-xs text-muted-foreground">Jatuh Tempo</span>
              </div>
              <p className={`font-bold text-2xl ${jatuhTempo.length>0?'text-amber-500':''}`}>{jatuhTempo.length}</p>
              <p className="text-xs text-muted-foreground">perlu segera diselesaikan</p>
            </CardContent>
          </Card>
        </div>

        {/* Alert: overdue → bulk WA */}
        {jatuhTempo.length > 0 && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0"/>
              <span className="text-sm font-medium text-red-700">
                {jatuhTempo.length} hutang/piutang sudah melewati jatuh tempo!
              </span>
            </div>
            <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white shrink-0" onClick={sendBulkWA}>
              <MessageCircle className="h-4 w-4 mr-1.5"/>
              Kirim Notif WA ({jatuhTempo.length})
            </Button>
          </div>
        )}

        {/* Alert: near due (≤3 hari) */}
        {nearDue.length > 0 && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0"/>
              <span className="text-sm font-medium text-amber-700">
                {nearDue.length} hutang/piutang mendekati jatuh tempo dalam 3 hari ke depan.
              </span>
            </div>
            <Button size="sm" variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-100 shrink-0"
              onClick={()=>{
                nearDue.forEach((d,i)=>setTimeout(()=>sendWA(d), i*600));
                toast.success(`Mengirim ${nearDue.length} pengingat WA...`);
              }}>
              <MessageCircle className="h-4 w-4 mr-1.5"/>
              Ingatkan via WA
            </Button>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <Select value={filterType} onValueChange={(v:any)=>setFilterType(v)}>
            <SelectTrigger className="w-36 h-9"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="payable">Hutang</SelectItem>
              <SelectItem value="receivable">Piutang</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-9"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="overdue">Jatuh Tempo</SelectItem>
              <SelectItem value="paid">Lunas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3"/>
              <p className="text-muted-foreground">Belum ada data hutang/piutang.</p>
              <Button size="sm" className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                onClick={()=>{ setForm({type:'payable',party_name:'',phone:'',amount:'',due_date:'',notes:''}); setDialog(true); }}>
                <Plus className="h-4 w-4 mr-1"/> Tambah Sekarang
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Pihak</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Sisa</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(d => {
                  const daysLeft = d.due_date ? differenceInDays(parseISO(d.due_date), new Date()) : null;
                  const isNear   = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
                  return (
                    <TableRow key={d.id} className={d.status==='overdue'?'bg-red-50/40':isNear?'bg-amber-50/40':''}>
                      <TableCell>
                        <Badge className={`border-0 text-xs ${d.type==='payable'?'bg-red-100 text-red-700':'bg-emerald-100 text-emerald-700'}`}>
                          {d.type==='payable'?'Hutang':'Piutang'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{d.party_name}</p>
                        {d.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3"/>{d.phone}
                          </p>
                        )}
                        {d.notes && <p className="text-xs text-muted-foreground truncate max-w-40">{d.notes}</p>}
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(d.amount)}</TableCell>
                      <TableCell className={`text-right font-bold ${d.remaining>0?'text-amber-600':'text-emerald-600'}`}>
                        {formatCurrency(d.remaining)}
                      </TableCell>
                      <TableCell>
                        {d.due_date ? (
                          <div>
                            <p className={`text-sm ${d.status==='overdue'?'text-red-500 font-semibold':isNear?'text-amber-600 font-medium':''}`}>
                              {format(parseISO(d.due_date),'dd MMM yyyy',{locale:idLocale})}
                            </p>
                            {daysLeft !== null && d.status !== 'paid' && (
                              <p className={`text-xs ${d.status==='overdue'?'text-red-400':isNear?'text-amber-500':'text-muted-foreground'}`}>
                                {d.status === 'overdue'
                                  ? `${Math.abs(daysLeft)} hari lalu`
                                  : daysLeft === 0 ? 'Hari ini!'
                                  : `${daysLeft} hari lagi`}
                              </p>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground text-sm">-</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={`border-0 text-xs ${STATUS_CONFIG[d.status]?.color}`}>
                          {STATUS_CONFIG[d.status]?.label || d.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* WhatsApp button */}
                          {d.status !== 'paid' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm"
                                  className={`h-7 w-7 p-0 ${d.status==='overdue'?'text-green-600 hover:text-green-700 hover:bg-green-50':isNear?'text-amber-600 hover:bg-amber-50':'text-muted-foreground hover:text-green-600'}`}
                                  onClick={()=>sendWA(d)}>
                                  <MessageCircle className="h-4 w-4"/>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {d.type==='receivable' ? 'Kirim tagihan via WA' : 'Kirim pengingat pembayaran via WA'}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {/* Pay button */}
                          {d.status !== 'paid' && (
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2"
                              onClick={()=>{ setSelectedDebt(d); setPayForm({amount:'',payment_date:format(new Date(),'yyyy-MM-dd'),notes:''}); setPayDialog(true); }}>
                              Bayar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* ── Add Debt Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tambah Hutang / Piutang</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tipe</Label>
              <Select value={form.type} onValueChange={v=>setForm(f=>({...f,type:v}))}>
                <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="payable">Hutang (ke supplier / pihak lain)</SelectItem>
                  <SelectItem value="receivable">Piutang (dari customer / pihak lain)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nama Pihak *</Label>
                <Input value={form.party_name} onChange={e=>setForm(f=>({...f,party_name:e.target.value}))}
                  placeholder="Nama supplier / customer..." className="mt-1"/>
              </div>
              <div className="col-span-2">
                <Label className="flex items-center gap-1">
                  <Phone className="h-3 w-3"/> No. WhatsApp
                  <span className="text-xs text-muted-foreground font-normal ml-1">(untuk notifikasi otomatis)</span>
                </Label>
                <Input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                  placeholder="08xx-xxxx-xxxx" className="mt-1"/>
              </div>
              <div><Label>Jumlah (Rp) *</Label>
                <Input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
                  placeholder="1500000" className="mt-1"/>
              </div>
              <div><Label>Jatuh Tempo</Label>
                <Input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} className="mt-1"/>
              </div>
            </div>
            <div><Label>Keterangan</Label>
              <Textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} className="mt-1" placeholder="Opsional..."/>
            </div>
            {/* WA preview hint */}
            {form.phone && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200">
                <MessageCircle className="h-4 w-4 text-green-600 shrink-0"/>
                <p className="text-xs text-green-700">
                  Notifikasi WhatsApp siap dikirim ke <strong>{form.phone}</strong> saat jatuh tempo mendekat.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setDialog(false)}>Batal</Button>
            <Button onClick={saveDebt} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Payment Dialog ──────────────────────────────────────────── */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Catat Pembayaran</DialogTitle></DialogHeader>
          {selectedDebt && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{selectedDebt.party_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Sisa: <span className="font-bold text-amber-600">{formatCurrency(selectedDebt.remaining)}</span>
                  </p>
                </div>
                {selectedDebt.status === 'overdue' && (
                  <Badge className="border-0 bg-red-100 text-red-700 text-xs">Jatuh Tempo</Badge>
                )}
              </div>
              <div><Label>Jumlah Bayar (Rp) *</Label>
                <Input type="number" value={payForm.amount}
                  onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))}
                  placeholder={`Maks ${formatCurrency(selectedDebt.remaining)}`} className="mt-1"/>
              </div>
              <div><Label>Tanggal Bayar</Label>
                <Input type="date" value={payForm.payment_date}
                  onChange={e=>setPayForm(f=>({...f,payment_date:e.target.value}))} className="mt-1"/>
              </div>
              <div><Label>Keterangan</Label>
                <Textarea value={payForm.notes} onChange={e=>setPayForm(f=>({...f,notes:e.target.value}))} rows={2} className="mt-1"/>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={()=>setPayDialog(false)}>Batal</Button>
            {selectedDebt?.phone && (
              <Button variant="outline" className="text-green-600 border-green-500 hover:bg-green-50"
                onClick={()=>{ if(selectedDebt) sendWA(selectedDebt); }}>
                <MessageCircle className="h-4 w-4 mr-1"/> Kirim WA
              </Button>
            )}
            <Button onClick={recordPayment} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Menyimpan...' : 'Catat Pembayaran'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
