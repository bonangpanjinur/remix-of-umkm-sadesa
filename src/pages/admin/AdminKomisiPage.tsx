import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Percent, Edit2, Plus, Save, TrendingUp, Store } from 'lucide-react';

interface CommissionRule {
  id: string;
  name: string;
  type: 'category' | 'merchant' | 'global';
  target_id: string | null;
  target_name: string | null;
  commission_percent: number;
  min_amount: number;
  max_commission: number | null;
  is_active: boolean;
  created_at: string;
}

const EMPTY_FORM = {
  name: '', type: 'category' as 'category' | 'merchant' | 'global', target_id: '', target_name: '',
  commission_percent: '5', min_amount: '0', max_commission: '', is_active: true,
};

const CATEGORIES = ['kuliner', 'fashion', 'kriya', 'wisata', 'kerajinan', 'pertanian', 'minuman'];

export default function AdminKomisiPage() {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState({ totalRules: 0, activeRules: 0, avgCommission: 0, estimatedRevenue: 0 });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [rulesRes, merchantRes, ordersRes] = await Promise.all([
      supabase.from('commission_rules' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('merchants').select('id, name').eq('registration_status', 'APPROVED').limit(100),
      supabase.from('orders').select('total').eq('status', 'COMPLETED').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);

    const r = (rulesRes.data || []) as unknown as CommissionRule[];
    setRules(r);
    setMerchants((merchantRes.data || []) as { id: string; name: string }[]);

    const active = r.filter(x => x.is_active);
    const avgPct = active.length > 0 ? active.reduce((s, x) => s + x.commission_percent, 0) / active.length : 5;
    const totalOrders = ((ordersRes.data || []) as any[]).reduce((s, o) => s + (o.total || 0), 0);

    setStats({
      totalRules: r.length,
      activeRules: active.length,
      avgCommission: Math.round(avgPct * 10) / 10,
      estimatedRevenue: Math.round(totalOrders * (avgPct / 100)),
    });
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (rule: CommissionRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      type: rule.type,
      target_id: rule.target_id || '',
      target_name: rule.target_name || '',
      commission_percent: String(rule.commission_percent),
      min_amount: String(rule.min_amount),
      max_commission: rule.max_commission ? String(rule.max_commission) : '',
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nama aturan harus diisi'); return; }
    const pct = parseFloat(form.commission_percent);
    if (isNaN(pct) || pct < 0 || pct > 100) { toast.error('Persentase tidak valid (0–100)'); return; }

    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        type: form.type,
        target_id: form.target_id || null,
        target_name: form.target_name || null,
        commission_percent: pct,
        min_amount: parseFloat(form.min_amount) || 0,
        max_commission: form.max_commission ? parseFloat(form.max_commission) : null,
        is_active: form.is_active,
      };

      if (editing) {
        const { error } = await supabase.from('commission_rules' as any).update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Aturan komisi diperbarui');
      } else {
        const { error } = await supabase.from('commission_rules' as any).insert(payload);
        if (error) throw error;
        toast.success('Aturan komisi ditambahkan');
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: CommissionRule) => {
    await supabase.from('commission_rules' as any).update({ is_active: !rule.is_active }).eq('id', rule.id);
    fetchData();
    toast.success(`Aturan ${rule.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
  };

  const formatRp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`;

  return (
    <AdminLayout title="Manajemen Komisi & Fee" subtitle="Atur persentase komisi platform per kategori atau merchant">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Manajemen Komisi & Fee</h1>
            <p className="text-sm text-muted-foreground">Atur persentase komisi platform per kategori atau merchant</p>
          </div>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />Tambah Aturan
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Aturan', value: stats.totalRules, icon: Percent },
            { label: 'Aktif', value: stats.activeRules, icon: TrendingUp },
            { label: 'Rata-rata Komisi', value: `${stats.avgCommission}%`, icon: Percent },
            { label: 'Est. Revenue Komisi (30h)', value: formatRp(stats.estimatedRevenue), icon: Store },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold mt-1">{s.value}</p>
                  </div>
                  <s.icon className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daftar Aturan Komisi</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Aturan</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-right">Komisi %</TableHead>
                    <TableHead className="text-right">Min. Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : rules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        Belum ada aturan komisi. <Button variant="link" className="p-0 h-auto" onClick={openCreate}>Tambah aturan pertama</Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{r.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{r.type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.target_name || 'Semua'}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">{r.commission_percent}%</TableCell>
                        <TableCell className="text-right text-sm">{formatRp(r.min_amount)}</TableCell>
                        <TableCell>
                          <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button variant="ghost" size="sm" className="h-8" onClick={() => openEdit(r)}>
                              <Edit2 className="h-3.5 w-3.5 mr-1" />Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Aturan Komisi' : 'Tambah Aturan Komisi'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Aturan *</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Komisi Kuliner 5%" />
            </div>
            <div>
              <Label>Tipe</Label>
              <Select value={form.type} onValueChange={(v: any) => setForm(p => ({ ...p, type: v, target_id: '', target_name: '' }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (Semua)</SelectItem>
                  <SelectItem value="category">Per Kategori</SelectItem>
                  <SelectItem value="merchant">Per Merchant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === 'category' && (
              <div>
                <Label>Kategori</Label>
                <Select value={form.target_name} onValueChange={v => setForm(p => ({ ...p, target_name: v, target_id: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.type === 'merchant' && (
              <div>
                <Label>Merchant</Label>
                <Select value={form.target_id} onValueChange={v => {
                  const m = merchants.find(x => x.id === v);
                  setForm(p => ({ ...p, target_id: v, target_name: m?.name || '' }));
                }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Komisi % *</Label>
                <Input type="number" className="mt-1" value={form.commission_percent} onChange={e => setForm(p => ({ ...p, commission_percent: e.target.value }))} placeholder="5" min="0" max="100" step="0.5" />
              </div>
              <div>
                <Label>Min. Order (Rp)</Label>
                <Input type="number" className="mt-1" value={form.min_amount} onChange={e => setForm(p => ({ ...p, min_amount: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Maks. Komisi (Rp, kosongkan = tidak ada batas)</Label>
              <Input type="number" className="mt-1" value={form.max_commission} onChange={e => setForm(p => ({ ...p, max_commission: e.target.value }))} placeholder="Opsional" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
              <Label>Aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" />
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Aturan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
