import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Search, Plus, Pencil, Trash2, AlertTriangle, Package,
  ArrowUpCircle, ArrowDownCircle, History, RefreshCw, FlaskConical
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
  description: string | null;
  is_active: boolean;
  outlet_id: string | null;
}

interface Mutation {
  id: string;
  type: string;
  qty: number;
  qty_before: number;
  qty_after: number;
  notes: string | null;
  created_at: string;
  pos_raw_materials?: { name: string } | null;
}

const UNITS = ['gram', 'kg', 'ml', 'liter', 'pcs', 'butir', 'lembar', 'sdm', 'sdt', 'sachet', 'bungkus', 'botol', 'kaleng', 'porsi'];

const MUTATION_TYPE_LABELS: Record<string, { label: string; color: string; sign: string }> = {
  initial:    { label: 'Stok Awal',   color: 'bg-blue-100 text-blue-700',     sign: '+' },
  purchase:   { label: 'Pembelian',   color: 'bg-emerald-100 text-emerald-700', sign: '+' },
  usage:      { label: 'Pemakaian',   color: 'bg-orange-100 text-orange-700',  sign: '-' },
  adjustment: { label: 'Penyesuaian', color: 'bg-purple-100 text-purple-700',  sign: '±' },
  waste:      { label: 'Terbuang',    color: 'bg-red-100 text-red-700',        sign: '-' },
  return:     { label: 'Retur',       color: 'bg-yellow-100 text-yellow-700',  sign: '+' },
};

const emptyForm = {
  name: '', unit: 'gram', current_stock: '', min_stock: '', cost_per_unit: '', description: '',
};

export default function POSBahanBakuPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'active'>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<RawMaterial | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [stockDialog, setStockDialog] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [stockForm, setStockForm] = useState({ type: 'purchase', qty: '', notes: '' });
  const [stockSaving, setStockSaving] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RawMaterial | null>(null);

  const fetchMaterials = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      let q = supabase
        .from('pos_raw_materials' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name');
      if (activeOutlet) q = q.eq('outlet_id', activeOutlet.id);
      const { data, error } = await q;
      if (error) throw error;
      setMaterials((data || []) as unknown as RawMaterial[]);
    } catch (err: any) {
      toast.error('Gagal memuat bahan baku: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeOutlet]);

  const fetchMutations = useCallback(async () => {
    if (!tenant) return;
    try {
      const { data, error } = await supabase
        .from('pos_raw_material_mutations' as any)
        .select('*, pos_raw_materials(name)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setMutations((data || []) as unknown as Mutation[]);
    } catch {
      // silent
    }
  }, [tenant]);

  useEffect(() => {
    fetchMaterials();
    fetchMutations();
  }, [fetchMaterials, fetchMutations]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (m: RawMaterial) => {
    setEditItem(m);
    setForm({
      name: m.name,
      unit: m.unit,
      current_stock: m.current_stock.toString(),
      min_stock: m.min_stock.toString(),
      cost_per_unit: m.cost_per_unit.toString(),
      description: m.description || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tenant || !form.name.trim()) { toast.error('Nama bahan baku wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenant.id,
        outlet_id: activeOutlet?.id || null,
        name: form.name.trim(),
        unit: form.unit,
        current_stock: parseFloat(form.current_stock) || 0,
        min_stock: parseFloat(form.min_stock) || 0,
        cost_per_unit: parseFloat(form.cost_per_unit) || 0,
        description: form.description || null,
      };

      if (editItem) {
        const { error } = await supabase
          .from('pos_raw_materials' as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editItem.id);
        if (error) throw error;
        toast.success('Bahan baku berhasil diperbarui');
      } else {
        const { data: newMat, error } = await supabase
          .from('pos_raw_materials' as any)
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        if (payload.current_stock > 0) {
          await supabase.from('pos_raw_material_mutations' as any).insert({
            tenant_id: tenant.id,
            outlet_id: activeOutlet?.id || null,
            raw_material_id: (newMat as any).id,
            type: 'initial',
            qty: payload.current_stock,
            qty_before: 0,
            qty_after: payload.current_stock,
            notes: 'Stok awal',
          });
        }
        toast.success('Bahan baku berhasil ditambahkan');
      }
      setDialogOpen(false);
      fetchMaterials();
      fetchMutations();
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supabase
        .from('pos_raw_materials' as any)
        .update({ is_active: false })
        .eq('id', deleteTarget.id);
      toast.success('Bahan baku dihapus');
      setDeleteDialog(false);
      fetchMaterials();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openStockDialog = (m: RawMaterial) => {
    setSelectedMaterial(m);
    setStockForm({ type: 'purchase', qty: '', notes: '' });
    setStockDialog(true);
  };

  const handleStockUpdate = async () => {
    if (!tenant || !selectedMaterial || !stockForm.qty) {
      toast.error('Isi jumlah stok');
      return;
    }
    const qty = parseFloat(stockForm.qty);
    if (isNaN(qty) || qty <= 0) { toast.error('Jumlah harus lebih dari 0'); return; }
    setStockSaving(true);
    try {
      const isDeduction = ['usage', 'waste'].includes(stockForm.type);
      const delta = isDeduction ? -qty : qty;
      const qtyBefore = selectedMaterial.current_stock;
      const qtyAfter = Math.max(0, qtyBefore + delta);

      await supabase
        .from('pos_raw_materials' as any)
        .update({ current_stock: qtyAfter, updated_at: new Date().toISOString() })
        .eq('id', selectedMaterial.id);

      await supabase.from('pos_raw_material_mutations' as any).insert({
        tenant_id: tenant.id,
        outlet_id: activeOutlet?.id || null,
        raw_material_id: selectedMaterial.id,
        type: stockForm.type,
        qty: isDeduction ? -qty : qty,
        qty_before: qtyBefore,
        qty_after: qtyAfter,
        notes: stockForm.notes || null,
      });

      toast.success('Stok berhasil diperbarui');
      setStockDialog(false);
      fetchMaterials();
      fetchMutations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setStockSaving(false);
    }
  };

  const filtered = materials.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'all' ? true :
      filterStatus === 'low' ? m.current_stock <= m.min_stock :
      m.is_active;
    return matchSearch && matchStatus;
  });

  const lowStockCount = materials.filter(m => m.current_stock <= m.min_stock).length;

  return (
    <POSLayout title="Bahan Baku" subtitle="Kelola stok bahan baku & resep produk">
      <div className="p-6 space-y-6">

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Bahan Baku</p>
              <p className="text-2xl font-bold">{materials.length}</p>
            </CardContent>
          </Card>
          <Card className={lowStockCount > 0 ? 'border-red-300' : ''}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                {lowStockCount > 0 && <AlertTriangle className="h-3 w-3 text-red-500" />}
                Stok Menipis
              </p>
              <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {lowStockCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Nilai Stok</p>
              <p className="text-2xl font-bold text-emerald-700">
                {formatCurrency(materials.reduce((s, m) => s + m.current_stock * m.cost_per_unit, 0))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Mutasi Hari Ini</p>
              <p className="text-2xl font-bold">
                {mutations.filter(mu => new Date(mu.created_at).toDateString() === new Date().toDateString()).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="materials">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <TabsList>
              <TabsTrigger value="materials">Bahan Baku</TabsTrigger>
              <TabsTrigger value="history">Riwayat Mutasi</TabsTrigger>
            </TabsList>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari bahan baku..."
                  className="pl-9 h-9 w-56"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="low">Stok Menipis</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => { fetchMaterials(); fetchMutations(); }}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
              <Button size="sm" onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-1" /> Tambah Bahan
              </Button>
            </div>
          </div>

          <TabsContent value="materials">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Memuat...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <FlaskConical className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {search ? 'Tidak ditemukan' : 'Belum ada bahan baku. Klik "Tambah Bahan" untuk mulai.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filtered.map(m => {
                  const isLow = m.current_stock <= m.min_stock;
                  return (
                    <Card key={m.id} className={`transition-shadow hover:shadow-md ${isLow ? 'border-red-300 bg-red-50/30' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{m.name}</span>
                              {isLow && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" /> Stok Menipis
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                              <span>Stok: <strong className={isLow ? 'text-red-600' : 'text-emerald-700'}>
                                {m.current_stock.toLocaleString('id-ID')} {m.unit}
                              </strong></span>
                              <span>Min: {m.min_stock.toLocaleString('id-ID')} {m.unit}</span>
                              <span>HPP: {formatCurrency(m.cost_per_unit)}/{m.unit}</span>
                              <span>Nilai: {formatCurrency(m.current_stock * m.cost_per_unit)}</span>
                            </div>
                            {m.description && (
                              <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="outline" size="sm"
                              onClick={() => openStockDialog(m)}
                              title="Update Stok"
                            >
                              <ArrowUpCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              className="text-red-500 hover:bg-red-50"
                              onClick={() => { setDeleteTarget(m); setDeleteDialog(true); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" /> Riwayat Mutasi Bahan Baku
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mutations.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground text-sm">Belum ada riwayat mutasi</p>
                ) : (
                  <div className="space-y-2">
                    {mutations.map(mu => {
                      const info = MUTATION_TYPE_LABELS[mu.type] || { label: mu.type, color: 'bg-gray-100 text-gray-700', sign: '' };
                      const isPos = mu.qty >= 0;
                      return (
                        <div key={mu.id} className="flex items-center justify-between py-2 border-b last:border-0 flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-full ${isPos ? 'bg-emerald-100' : 'bg-red-100'}`}>
                              {isPos
                                ? <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" />
                                : <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />
                              }
                            </div>
                            <div>
                              <p className="text-sm font-medium">{(mu.pos_raw_materials as any)?.name || '—'}</p>
                              <p className="text-xs text-muted-foreground">{mu.notes || '—'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <Badge className={info.color + ' text-xs'}>{info.label}</Badge>
                            <span className={isPos ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                              {info.sign}{Math.abs(mu.qty).toLocaleString('id-ID')}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {mu.qty_before?.toLocaleString('id-ID') || '0'} → {mu.qty_after?.toLocaleString('id-ID') || '0'}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {format(new Date(mu.created_at), 'dd/MM HH:mm', { locale: idLocale })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Tambah/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Nama Bahan Baku <span className="text-red-500">*</span></Label>
              <Input
                placeholder="cth: Tepung Terigu, Gula Pasir..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Satuan</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Harga per {form.unit || 'satuan'}</Label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={form.cost_per_unit}
                  onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Stok Saat Ini</Label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={form.current_stock}
                  onChange={e => setForm(f => ({ ...f, current_stock: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Stok Minimum (Alert)</Label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={form.min_stock}
                  onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Keterangan (opsional)</Label>
              <Textarea
                placeholder="Catatan tentang bahan ini..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Menyimpan...' : (editItem ? 'Simpan Perubahan' : 'Tambah Bahan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Update Stok */}
      <Dialog open={stockDialog} onOpenChange={setStockDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Stok — {selectedMaterial?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg px-4 py-3 text-sm">
              Stok saat ini: <strong>{selectedMaterial?.current_stock.toLocaleString('id-ID')} {selectedMaterial?.unit}</strong>
            </div>
            <div className="grid gap-2">
              <Label>Tipe Mutasi</Label>
              <Select value={stockForm.type} onValueChange={v => setStockForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Pembelian / Stok Masuk</SelectItem>
                  <SelectItem value="adjustment">Penyesuaian Stok</SelectItem>
                  <SelectItem value="usage">Pemakaian Manual</SelectItem>
                  <SelectItem value="waste">Terbuang / Rusak</SelectItem>
                  <SelectItem value="return">Retur ke Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Jumlah ({selectedMaterial?.unit})</Label>
              <Input
                type="number" min="0.001" step="0.001" placeholder="0"
                value={stockForm.qty}
                onChange={e => setStockForm(f => ({ ...f, qty: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Catatan</Label>
              <Input
                placeholder="Opsional..."
                value={stockForm.notes}
                onChange={e => setStockForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialog(false)}>Batal</Button>
            <Button onClick={handleStockUpdate} disabled={stockSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {stockSaving ? 'Menyimpan...' : 'Update Stok'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Bahan Baku?</AlertDialogTitle>
            <AlertDialogDescription>
              Bahan baku "<strong>{deleteTarget?.name}</strong>" akan dihapus. Resep yang menggunakan bahan ini akan terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </POSLayout>
  );
}
