import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Tag, Ticket, Gift, Clock, Search,
  RefreshCw, ToggleLeft, ToggleRight, Copy, CheckCircle2, Download
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: string;
  discount_percent: number;
  discount_amount: number;
  min_purchase: number;
  max_discount: number | null;
  buy_qty: number;
  get_qty: number;
  bundle_price: number | null;
  happy_hour_start: string | null;
  happy_hour_end: string | null;
  happy_hour_days: number[];
  applies_to: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  usage_limit: number | null;
  used_count: number;
  created_at: string;
}

interface Voucher {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  discount_percent: number;
  discount_amount: number;
  min_purchase: number;
  max_discount: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  usage_limit: number | null;
  used_count: number;
  per_customer_limit: number;
  created_at: string;
}

const PROMO_TYPES = [
  { value: 'discount_percent', label: 'Diskon Persen (%)', icon: '💯' },
  { value: 'discount_amount', label: 'Diskon Nominal (Rp)', icon: '💵' },
  { value: 'buy_x_get_y', label: 'Beli X Dapat Y', icon: '🎁' },
  { value: 'bundle', label: 'Bundling Harga Khusus', icon: '📦' },
  { value: 'happy_hour', label: 'Happy Hour', icon: '⏰' },
];

const DAYS_LABEL = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function promoStatusBadge(promo: Promotion | Voucher) {
  if (!promo.is_active) return <Badge variant="secondary">Nonaktif</Badge>;
  const now = new Date();
  if (promo.start_date && isBefore(now, parseISO(promo.start_date)))
    return <Badge className="bg-blue-100 text-blue-700">Belum Mulai</Badge>;
  if (promo.end_date && isAfter(now, parseISO(promo.end_date)))
    return <Badge variant="destructive">Kedaluwarsa</Badge>;
  if (promo.usage_limit && promo.used_count >= promo.usage_limit)
    return <Badge className="bg-orange-100 text-orange-700">Habis</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700">Aktif</Badge>;
}

const emptyPromo = {
  name: '', description: '', type: 'discount_percent',
  discount_percent: 0, discount_amount: 0, min_purchase: 0, max_discount: '',
  buy_qty: 1, get_qty: 1,
  bundle_price: '',
  happy_hour_start: '09:00', happy_hour_end: '12:00',
  happy_hour_days: [1, 2, 3, 4, 5],
  applies_to: 'all',
  start_date: '', end_date: '',
  is_active: true, usage_limit: '',
};

const emptyVoucher = {
  code: '', name: '', description: '', type: 'discount_percent',
  discount_percent: 0, discount_amount: 0, min_purchase: 0, max_discount: '',
  start_date: '', end_date: '',
  is_active: true, usage_limit: '', per_customer_limit: 1,
};

function generateCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function POSPromosiPage() {
  const { tenant, formatCurrency } = usePOS();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('promosi');

  const [promoDialog, setPromoDialog] = useState(false);
  const [voucherDialog, setVoucherDialog] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [promoForm, setPromoForm] = useState<any>(emptyPromo);
  const [voucherForm, setVoucherForm] = useState<any>(emptyVoucher);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'promo' | 'voucher'; id: string } | null>(null);

  const [stats, setStats] = useState({ totalPromos: 0, activePromos: 0, totalVouchers: 0, activeVouchers: 0 });

  const fetchAll = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const [{ data: pd }, { data: vd }] = await Promise.all([
      supabase.from('pos_promotions' as any).select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('pos_vouchers' as any).select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
    ]);
    const p = (pd || []) as unknown as Promotion[];
    const v = (vd || []) as unknown as Voucher[];
    setPromos(p);
    setVouchers(v);
    const now = new Date();
    setStats({
      totalPromos: p.length,
      activePromos: p.filter(x => x.is_active && (!x.end_date || isAfter(parseISO(x.end_date), now))).length,
      totalVouchers: v.length,
      activeVouchers: v.filter(x => x.is_active && (!x.end_date || isAfter(parseISO(x.end_date), now))).length,
    });
    setLoading(false);
  }, [tenant]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ---- PROMOSI CRUD ----
  const openAddPromo = () => { setEditingPromo(null); setPromoForm(emptyPromo); setPromoDialog(true); };
  const openEditPromo = (p: Promotion) => {
    setEditingPromo(p);
    setPromoForm({
      ...p,
      start_date: p.start_date ? format(parseISO(p.start_date), 'yyyy-MM-dd') : '',
      end_date: p.end_date ? format(parseISO(p.end_date), 'yyyy-MM-dd') : '',
      max_discount: p.max_discount ?? '',
      bundle_price: p.bundle_price ?? '',
      usage_limit: p.usage_limit ?? '',
      happy_hour_days: p.happy_hour_days || [1, 2, 3, 4, 5],
    });
    setPromoDialog(true);
  };

  const savePromo = async () => {
    if (!tenant || !promoForm.name.trim()) return toast.error('Nama promosi wajib diisi');
    const payload: any = {
      tenant_id: tenant.id,
      name: promoForm.name.trim(),
      description: promoForm.description || null,
      type: promoForm.type,
      discount_percent: Number(promoForm.discount_percent) || 0,
      discount_amount: Number(promoForm.discount_amount) || 0,
      min_purchase: Number(promoForm.min_purchase) || 0,
      max_discount: promoForm.max_discount !== '' ? Number(promoForm.max_discount) : null,
      buy_qty: Number(promoForm.buy_qty) || 1,
      get_qty: Number(promoForm.get_qty) || 1,
      bundle_price: promoForm.bundle_price !== '' ? Number(promoForm.bundle_price) : null,
      happy_hour_start: promoForm.happy_hour_start || null,
      happy_hour_end: promoForm.happy_hour_end || null,
      happy_hour_days: promoForm.happy_hour_days,
      applies_to: promoForm.applies_to,
      start_date: promoForm.start_date || null,
      end_date: promoForm.end_date || null,
      is_active: promoForm.is_active,
      usage_limit: promoForm.usage_limit !== '' ? Number(promoForm.usage_limit) : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingPromo
      ? await supabase.from('pos_promotions' as any).update(payload).eq('id', editingPromo.id)
      : await supabase.from('pos_promotions' as any).insert(payload);
    if (error) { toast.error('Gagal menyimpan promosi'); return; }
    toast.success(editingPromo ? 'Promosi diperbarui' : 'Promosi dibuat');
    setPromoDialog(false);
    fetchAll();
  };

  const togglePromo = async (p: Promotion) => {
    await supabase.from('pos_promotions' as any).update({ is_active: !p.is_active }).eq('id', p.id);
    fetchAll();
  };

  // ---- VOUCHER CRUD ----
  const openAddVoucher = () => {
    setEditingVoucher(null);
    setVoucherForm({ ...emptyVoucher, code: generateCode() });
    setVoucherDialog(true);
  };
  const openEditVoucher = (v: Voucher) => {
    setEditingVoucher(v);
    setVoucherForm({
      ...v,
      start_date: v.start_date ? format(parseISO(v.start_date), 'yyyy-MM-dd') : '',
      end_date: v.end_date ? format(parseISO(v.end_date), 'yyyy-MM-dd') : '',
      max_discount: v.max_discount ?? '',
      usage_limit: v.usage_limit ?? '',
    });
    setVoucherDialog(true);
  };

  const saveVoucher = async () => {
    if (!tenant || !voucherForm.code.trim()) return toast.error('Kode voucher wajib diisi');
    if (!voucherForm.name.trim()) return toast.error('Nama voucher wajib diisi');
    const payload: any = {
      tenant_id: tenant.id,
      code: voucherForm.code.trim().toUpperCase(),
      name: voucherForm.name.trim(),
      description: voucherForm.description || null,
      type: voucherForm.type,
      discount_percent: Number(voucherForm.discount_percent) || 0,
      discount_amount: Number(voucherForm.discount_amount) || 0,
      min_purchase: Number(voucherForm.min_purchase) || 0,
      max_discount: voucherForm.max_discount !== '' ? Number(voucherForm.max_discount) : null,
      start_date: voucherForm.start_date || null,
      end_date: voucherForm.end_date || null,
      is_active: voucherForm.is_active,
      usage_limit: voucherForm.usage_limit !== '' ? Number(voucherForm.usage_limit) : null,
      per_customer_limit: Number(voucherForm.per_customer_limit) || 1,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingVoucher
      ? await supabase.from('pos_vouchers' as any).update(payload).eq('id', editingVoucher.id)
      : await supabase.from('pos_vouchers' as any).insert(payload);
    if (error) { toast.error(error.message.includes('unique') ? 'Kode voucher sudah digunakan' : 'Gagal menyimpan voucher'); return; }
    toast.success(editingVoucher ? 'Voucher diperbarui' : 'Voucher dibuat');
    setVoucherDialog(false);
    fetchAll();
  };

  const toggleVoucher = async (v: Voucher) => {
    await supabase.from('pos_vouchers' as any).update({ is_active: !v.is_active }).eq('id', v.id);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'promo') {
      await supabase.from('pos_promotions' as any).delete().eq('id', deleteTarget.id);
    } else {
      await supabase.from('pos_vouchers' as any).delete().eq('id', deleteTarget.id);
    }
    toast.success('Berhasil dihapus');
    setDeleteTarget(null);
    fetchAll();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Kode disalin!');
  };

  const exportCSV = () => {
    if (tab === 'promosi') {
      const rows = [['Nama', 'Tipe', 'Diskon', 'Min. Pembelian', 'Penggunaan', 'Status']];
      promos.forEach(p => rows.push([
        p.name,
        PROMO_TYPES.find(t => t.value === p.type)?.label || p.type,
        p.type === 'discount_percent' ? `${p.discount_percent}%` : formatCurrency(p.discount_amount),
        formatCurrency(p.min_purchase),
        `${p.used_count}${p.usage_limit ? '/' + p.usage_limit : ''}`,
        p.is_active ? 'Aktif' : 'Nonaktif',
      ]));
      const csv = rows.map(r => r.join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'promosi.csv'; a.click();
    } else {
      const rows = [['Kode', 'Nama', 'Tipe', 'Diskon', 'Penggunaan', 'Status']];
      vouchers.forEach(v => rows.push([
        v.code, v.name,
        v.type === 'discount_percent' ? 'Persen' : 'Nominal',
        v.type === 'discount_percent' ? `${v.discount_percent}%` : formatCurrency(v.discount_amount),
        `${v.used_count}${v.usage_limit ? '/' + v.usage_limit : ''}`,
        v.is_active ? 'Aktif' : 'Nonaktif',
      ]));
      const csv = rows.map(r => r.join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'voucher.csv'; a.click();
    }
  };

  const filteredPromos = promos.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const filteredVouchers = vouchers.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.code.toLowerCase().includes(search.toLowerCase())
  );

  const promoTypeLabel = (type: string) => PROMO_TYPES.find(t => t.value === type)?.label || type;
  const promoIcon = (type: string) => PROMO_TYPES.find(t => t.value === type)?.icon || '🏷️';

  return (
    <POSLayout
      title="Promosi & Voucher"
      subtitle="Kelola diskon, program promo, dan kode voucher"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
            onClick={tab === 'promosi' ? openAddPromo : openAddVoucher}>
            <Plus className="h-4 w-4 mr-1" />
            {tab === 'promosi' ? 'Buat Promosi' : 'Buat Voucher'}
          </Button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Promosi', value: stats.totalPromos, icon: <Tag className="h-5 w-5 text-blue-500" />, color: 'bg-blue-50' },
          { label: 'Promosi Aktif', value: stats.activePromos, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />, color: 'bg-emerald-50' },
          { label: 'Total Voucher', value: stats.totalVouchers, icon: <Ticket className="h-5 w-5 text-purple-500" />, color: 'bg-purple-50' },
          { label: 'Voucher Aktif', value: stats.activeVouchers, icon: <Gift className="h-5 w-5 text-orange-500" />, color: 'bg-orange-50' },
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

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="promosi"><Tag className="h-3.5 w-3.5 mr-1.5" />Promosi</TabsTrigger>
            <TabsTrigger value="voucher"><Ticket className="h-3.5 w-3.5 mr-1.5" />Voucher / Kupon</TabsTrigger>
          </TabsList>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* ---- PROMOSI TAB ---- */}
        <TabsContent value="promosi">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Memuat data...</div>
              ) : filteredPromos.length === 0 ? (
                <div className="p-12 text-center">
                  <Tag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Belum ada promosi</p>
                  <p className="text-sm text-muted-foreground mt-1">Klik "Buat Promosi" untuk membuat promosi pertama Anda</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Promosi</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Nilai Diskon</TableHead>
                      <TableHead>Berlaku</TableHead>
                      <TableHead>Pemakaian</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-28">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPromos.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{promoIcon(p.type)}</span>
                            <div>
                              <div className="font-medium text-sm">{p.name}</div>
                              {p.description && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{p.description}</div>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><span className="text-xs">{promoTypeLabel(p.type)}</span></TableCell>
                        <TableCell>
                          <span className="font-medium text-sm text-emerald-600">
                            {p.type === 'discount_percent' && `${p.discount_percent}%`}
                            {p.type === 'discount_amount' && formatCurrency(p.discount_amount)}
                            {p.type === 'buy_x_get_y' && `Beli ${p.buy_qty} Gratis ${p.get_qty}`}
                            {p.type === 'bundle' && (p.bundle_price ? formatCurrency(p.bundle_price) : '-')}
                            {p.type === 'happy_hour' && `${p.discount_percent}% (${p.happy_hour_start}–${p.happy_hour_end})`}
                          </span>
                          {p.min_purchase > 0 && <div className="text-xs text-muted-foreground">Min. {formatCurrency(p.min_purchase)}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            {p.start_date ? format(parseISO(p.start_date), 'dd MMM yy', { locale: idLocale }) : '—'}
                            {' – '}
                            {p.end_date ? format(parseISO(p.end_date), 'dd MMM yy', { locale: idLocale }) : '∞'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{p.used_count}{p.usage_limit ? ` / ${p.usage_limit}` : ''}</span>
                        </TableCell>
                        <TableCell>{promoStatusBadge(p)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePromo(p)} title={p.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                              {p.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPromo(p)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ type: 'promo', id: p.id })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- VOUCHER TAB ---- */}
        <TabsContent value="voucher">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Memuat data...</div>
              ) : filteredVouchers.length === 0 ? (
                <div className="p-12 text-center">
                  <Ticket className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Belum ada voucher</p>
                  <p className="text-sm text-muted-foreground mt-1">Klik "Buat Voucher" untuk membuat kode kupon pertama</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama Voucher</TableHead>
                      <TableHead>Nilai</TableHead>
                      <TableHead>Min. Pembelian</TableHead>
                      <TableHead>Berlaku</TableHead>
                      <TableHead>Pemakaian</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-28">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVouchers.map(v => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono font-bold">{v.code}</code>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyCode(v.code)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{v.name}</div>
                          {v.description && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{v.description}</div>}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-emerald-600 text-sm">
                            {v.type === 'discount_percent' ? `${v.discount_percent}%` : formatCurrency(v.discount_amount)}
                          </span>
                          {v.max_discount && <div className="text-xs text-muted-foreground">Maks. {formatCurrency(v.max_discount)}</div>}
                        </TableCell>
                        <TableCell><span className="text-sm">{v.min_purchase > 0 ? formatCurrency(v.min_purchase) : '—'}</span></TableCell>
                        <TableCell>
                          <div className="text-xs">
                            {v.start_date ? format(parseISO(v.start_date), 'dd MMM yy', { locale: idLocale }) : '—'}
                            {' – '}
                            {v.end_date ? format(parseISO(v.end_date), 'dd MMM yy', { locale: idLocale }) : '∞'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{v.used_count}{v.usage_limit ? ` / ${v.usage_limit}` : ''}</span>
                        </TableCell>
                        <TableCell>{promoStatusBadge(v)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleVoucher(v)}>
                              {v.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditVoucher(v)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ type: 'voucher', id: v.id })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---- DIALOG PROMOSI ---- */}
      <Dialog open={promoDialog} onOpenChange={setPromoDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromo ? 'Edit Promosi' : 'Buat Promosi Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nama Promosi *</Label>
                <Input value={promoForm.name} onChange={e => setPromoForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Contoh: Diskon Lebaran 20%" />
              </div>
              <div className="col-span-2">
                <Label>Tipe Promosi</Label>
                <Select value={promoForm.type} onValueChange={v => setPromoForm((f: any) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROMO_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {promoForm.type === 'discount_percent' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Diskon (%)</Label>
                  <Input type="number" min={0} max={100} value={promoForm.discount_percent}
                    onChange={e => setPromoForm((f: any) => ({ ...f, discount_percent: e.target.value }))} />
                </div>
                <div>
                  <Label>Maks. Diskon (Rp, opsional)</Label>
                  <Input type="number" min={0} value={promoForm.max_discount}
                    onChange={e => setPromoForm((f: any) => ({ ...f, max_discount: e.target.value }))}
                    placeholder="Tidak terbatas" />
                </div>
              </div>
            )}
            {promoForm.type === 'discount_amount' && (
              <div>
                <Label>Diskon Nominal (Rp)</Label>
                <Input type="number" min={0} value={promoForm.discount_amount}
                  onChange={e => setPromoForm((f: any) => ({ ...f, discount_amount: e.target.value }))} />
              </div>
            )}
            {promoForm.type === 'buy_x_get_y' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Beli (Qty)</Label>
                  <Input type="number" min={1} value={promoForm.buy_qty}
                    onChange={e => setPromoForm((f: any) => ({ ...f, buy_qty: e.target.value }))} />
                </div>
                <div>
                  <Label>Gratis (Qty)</Label>
                  <Input type="number" min={1} value={promoForm.get_qty}
                    onChange={e => setPromoForm((f: any) => ({ ...f, get_qty: e.target.value }))} />
                </div>
              </div>
            )}
            {promoForm.type === 'bundle' && (
              <div>
                <Label>Harga Bundle (Rp)</Label>
                <Input type="number" min={0} value={promoForm.bundle_price}
                  onChange={e => setPromoForm((f: any) => ({ ...f, bundle_price: e.target.value }))}
                  placeholder="Harga spesial paket" />
              </div>
            )}
            {promoForm.type === 'happy_hour' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Diskon (%)</Label>
                    <Input type="number" min={0} max={100} value={promoForm.discount_percent}
                      onChange={e => setPromoForm((f: any) => ({ ...f, discount_percent: e.target.value }))} />
                  </div>
                  <div />
                  <div>
                    <Label>Jam Mulai</Label>
                    <Input type="time" value={promoForm.happy_hour_start}
                      onChange={e => setPromoForm((f: any) => ({ ...f, happy_hour_start: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Jam Selesai</Label>
                    <Input type="time" value={promoForm.happy_hour_end}
                      onChange={e => setPromoForm((f: any) => ({ ...f, happy_hour_end: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Hari Berlaku</Label>
                  <div className="flex gap-1.5">
                    {DAYS_LABEL.map((day, i) => (
                      <button key={i} type="button"
                        className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${promoForm.happy_hour_days.includes(i) ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}
                        onClick={() => {
                          const days: number[] = promoForm.happy_hour_days.includes(i)
                            ? promoForm.happy_hour_days.filter((d: number) => d !== i)
                            : [...promoForm.happy_hour_days, i];
                          setPromoForm((f: any) => ({ ...f, happy_hour_days: days }));
                        }}>{day}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Min. Pembelian (Rp)</Label>
              <Input type="number" min={0} value={promoForm.min_purchase}
                onChange={e => setPromoForm((f: any) => ({ ...f, min_purchase: e.target.value }))}
                placeholder="0 = tidak ada minimum" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tanggal Mulai</Label>
                <Input type="date" value={promoForm.start_date}
                  onChange={e => setPromoForm((f: any) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>Tanggal Selesai</Label>
                <Input type="date" value={promoForm.end_date}
                  onChange={e => setPromoForm((f: any) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Batas Penggunaan (opsional)</Label>
              <Input type="number" min={0} value={promoForm.usage_limit}
                onChange={e => setPromoForm((f: any) => ({ ...f, usage_limit: e.target.value }))}
                placeholder="Tidak terbatas" />
            </div>

            <div>
              <Label>Deskripsi (opsional)</Label>
              <Textarea rows={2} value={promoForm.description}
                onChange={e => setPromoForm((f: any) => ({ ...f, description: e.target.value }))}
                placeholder="Keterangan tambahan promosi" />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={promoForm.is_active} onCheckedChange={v => setPromoForm((f: any) => ({ ...f, is_active: v }))} />
              <Label>Aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoDialog(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={savePromo}>
              {editingPromo ? 'Simpan Perubahan' : 'Buat Promosi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- DIALOG VOUCHER ---- */}
      <Dialog open={voucherDialog} onOpenChange={setVoucherDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVoucher ? 'Edit Voucher' : 'Buat Voucher Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kode Voucher *</Label>
              <div className="flex gap-2">
                <Input value={voucherForm.code} onChange={e => setVoucherForm((f: any) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="font-mono font-bold uppercase" placeholder="KODE123" />
                <Button variant="outline" size="icon" onClick={() => setVoucherForm((f: any) => ({ ...f, code: generateCode() }))}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Nama Voucher *</Label>
              <Input value={voucherForm.name} onChange={e => setVoucherForm((f: any) => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Voucher Pelanggan Setia" />
            </div>
            <div>
              <Label>Tipe Diskon</Label>
              <Select value={voucherForm.type} onValueChange={v => setVoucherForm((f: any) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount_percent">💯 Diskon Persen (%)</SelectItem>
                  <SelectItem value="discount_amount">💵 Diskon Nominal (Rp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{voucherForm.type === 'discount_percent' ? 'Diskon (%)' : 'Diskon (Rp)'}</Label>
                <Input type="number" min={0} value={voucherForm.type === 'discount_percent' ? voucherForm.discount_percent : voucherForm.discount_amount}
                  onChange={e => setVoucherForm((f: any) => ({
                    ...f,
                    [voucherForm.type === 'discount_percent' ? 'discount_percent' : 'discount_amount']: e.target.value
                  }))} />
              </div>
              {voucherForm.type === 'discount_percent' && (
                <div>
                  <Label>Maks. Diskon (Rp)</Label>
                  <Input type="number" min={0} value={voucherForm.max_discount}
                    onChange={e => setVoucherForm((f: any) => ({ ...f, max_discount: e.target.value }))}
                    placeholder="Tidak terbatas" />
                </div>
              )}
            </div>
            <div>
              <Label>Min. Pembelian (Rp)</Label>
              <Input type="number" min={0} value={voucherForm.min_purchase}
                onChange={e => setVoucherForm((f: any) => ({ ...f, min_purchase: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Berlaku Mulai</Label>
                <Input type="date" value={voucherForm.start_date}
                  onChange={e => setVoucherForm((f: any) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>Berlaku Hingga</Label>
                <Input type="date" value={voucherForm.end_date}
                  onChange={e => setVoucherForm((f: any) => ({ ...f, end_date: e.target.value }))} />
              </div>
              <div>
                <Label>Maks. Penggunaan Total</Label>
                <Input type="number" min={0} value={voucherForm.usage_limit}
                  onChange={e => setVoucherForm((f: any) => ({ ...f, usage_limit: e.target.value }))}
                  placeholder="Tidak terbatas" />
              </div>
              <div>
                <Label>Maks. per Pelanggan</Label>
                <Input type="number" min={1} value={voucherForm.per_customer_limit}
                  onChange={e => setVoucherForm((f: any) => ({ ...f, per_customer_limit: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Deskripsi (opsional)</Label>
              <Textarea rows={2} value={voucherForm.description}
                onChange={e => setVoucherForm((f: any) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={voucherForm.is_active} onCheckedChange={v => setVoucherForm((f: any) => ({ ...f, is_active: v }))} />
              <Label>Aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoucherDialog(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveVoucher}>
              {editingVoucher ? 'Simpan Perubahan' : 'Buat Voucher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {deleteTarget?.type === 'promo' ? 'Promosi' : 'Voucher'}?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </POSLayout>
  );
}
