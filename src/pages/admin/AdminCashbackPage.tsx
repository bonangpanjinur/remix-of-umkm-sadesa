import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, Plus, Edit2, TrendingUp, Users, Gift } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { formatPrice } from '@/lib/utils';

interface CashbackRule {
  id: string;
  name: string;
  cashback_percent: number;
  min_order_amount: number;
  max_cashback: number | null;
  category: string | null;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
}

const EMPTY: Partial<CashbackRule> = {
  name: '', cashback_percent: 2, min_order_amount: 50000, max_cashback: null, category: null, is_active: true,
  valid_from: new Date().toISOString().split('T')[0], valid_until: null,
};

export default function AdminCashbackPage() {
  const [rules, setRules] = useState<CashbackRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CashbackRule | null>(null);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [rulesRes, txRes] = await Promise.all([
      (supabase as any).from('cashback_rules').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('cashback_transactions').select('amount, user_id').eq('status', 'confirmed'),
    ]);
    setRules((rulesRes.data || []) as CashbackRule[]);
    const txs = (txRes.data || []) as any[];
    setTotalPaid(txs.reduce((s: number, t: any) => s + t.amount, 0));
    setTotalUsers(new Set(txs.map((t: any) => t.user_id)).size);
    setLoading(false);
  };

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY }); setDialogOpen(true); };
  const openEdit = (r: CashbackRule) => { setEditing(r); setForm({ ...r, valid_from: r.valid_from?.split('T')[0] || '', valid_until: r.valid_until?.split('T')[0] || '' }); setDialogOpen(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Nama wajib diisi'); return; }
    const payload = {
      name: form.name,
      cashback_percent: Number(form.cashback_percent) || 2,
      min_order_amount: Number(form.min_order_amount) || 0,
      max_cashback: form.max_cashback ? Number(form.max_cashback) : null,
      category: form.category || null,
      is_active: form.is_active ?? true,
      valid_from: form.valid_from ? new Date(form.valid_from as string).toISOString() : new Date().toISOString(),
      valid_until: form.valid_until ? new Date(form.valid_until as string).toISOString() : null,
    };
    if (editing) {
      const { error } = await (supabase as any).from('cashback_rules').update(payload).eq('id', editing.id);
      if (!error) { toast.success('Aturan cashback diperbarui'); fetchData(); setDialogOpen(false); }
      else toast.error('Gagal memperbarui');
    } else {
      const { error } = await (supabase as any).from('cashback_rules').insert(payload);
      if (!error) { toast.success('Aturan cashback ditambahkan'); fetchData(); setDialogOpen(false); }
      else toast.error('Gagal menambahkan');
    }
  };

  const toggleActive = async (r: CashbackRule) => {
    await (supabase as any).from('cashback_rules').update({ is_active: !r.is_active }).eq('id', r.id);
    setRules(prev => prev.map(x => x.id === r.id ? { ...x, is_active: !x.is_active } : x));
    toast.success(r.is_active ? 'Aturan dinonaktifkan' : 'Aturan diaktifkan');
  };

  return (
    <AdminLayout title="Manajemen Cashback" subtitle="Atur program cashback untuk pembeli marketplace">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-emerald-500" />
            <div><p className="text-2xl font-bold">{rules.filter(r => r.is_active).length}</p><p className="text-xs text-muted-foreground">Program Aktif</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Wallet className="h-8 w-8 text-blue-500" />
            <div><p className="text-2xl font-bold">{formatPrice(totalPaid)}</p><p className="text-xs text-muted-foreground">Total Cashback Dibayar</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Users className="h-8 w-8 text-violet-500" />
            <div><p className="text-2xl font-bold">{totalUsers}</p><p className="text-xs text-muted-foreground">Penerima Cashback</p></div>
          </CardContent></Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Tambah Program Cashback</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Cashback</TableHead>
                  <TableHead>Min. Order</TableHead>
                  <TableHead>Maks.</TableHead>
                  <TableHead>Berlaku</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>)}</TableRow>
                )) : rules.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Belum ada program cashback. <Button variant="link" className="p-0 h-auto" onClick={openCreate}>Tambah sekarang</Button>
                  </TableCell></TableRow>
                ) : rules.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{r.name}</p>
                        {r.category && <Badge variant="outline" className="text-xs mt-0.5">{r.category}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell><span className="font-bold text-emerald-600">{r.cashback_percent}%</span></TableCell>
                    <TableCell className="text-sm">{formatPrice(r.min_order_amount)}</TableCell>
                    <TableCell className="text-sm">{r.max_cashback ? formatPrice(r.max_cashback) : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(r.valid_from), 'd MMM yyyy', { locale: idLocale })}
                      {r.valid_until ? ` s.d. ${format(new Date(r.valid_until), 'd MMM yyyy', { locale: idLocale })}` : ' (tidak berbatas)'}
                    </TableCell>
                    <TableCell><Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)} className="h-8 w-8">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit Program Cashback' : 'Tambah Program Cashback'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nama Program *</Label><Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Cashback Weekend 3%" className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cashback % *</Label><Input type="number" min={0.1} max={50} step={0.1} value={form.cashback_percent || 2} onChange={e => setForm(f => ({ ...f, cashback_percent: parseFloat(e.target.value) }))} className="mt-1" /></div>
                <div><Label>Min. Order (Rp)</Label><Input type="number" value={form.min_order_amount || 0} onChange={e => setForm(f => ({ ...f, min_order_amount: parseInt(e.target.value) }))} className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Maks. Cashback (Rp)</Label><Input type="number" placeholder="Kosongkan = tidak terbatas" value={form.max_cashback || ''} onChange={e => setForm(f => ({ ...f, max_cashback: e.target.value ? parseInt(e.target.value) : null }))} className="mt-1" /></div>
                <div><Label>Kategori (opsional)</Label><Input placeholder="Makanan, Pertanian, dll" value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value || null }))} className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Berlaku Dari</Label><Input type="date" value={form.valid_from as string || ''} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} className="mt-1" /></div>
                <div><Label>Berlaku Hingga</Label><Input type="date" value={form.valid_until as string || ''} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value || null }))} className="mt-1" /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>Aktif</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button onClick={save}><Gift className="h-4 w-4 mr-2" /> {editing ? 'Simpan' : 'Tambah'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
