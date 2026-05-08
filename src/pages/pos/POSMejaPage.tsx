import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, RefreshCw, Users, Table2,
  CheckCircle, Clock, Wrench, Calendar, ChefHat, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';

interface TableItem {
  id: string;
  name: string;
  section: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  notes: string | null;
  is_active: boolean;
}

interface TableOrder {
  id: string;
  table_id: string | null;
  table_name: string | null;
  order_number: string;
  status: string;
  items: any[];
  notes: string | null;
  customer_name: string | null;
  created_at: string;
}

const STATUS_CONFIG = {
  available: { label: 'Tersedia',   color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', icon: CheckCircle },
  occupied:  { label: 'Terisi',     color: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50 border-red-300',         icon: Users },
  reserved:  { label: 'Reservasi',  color: 'bg-yellow-500',  text: 'text-yellow-700',  bg: 'bg-yellow-50 border-yellow-300',   icon: Calendar },
  cleaning:  { label: 'Dibersihkan',color: 'bg-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50 border-blue-300',       icon: Wrench },
};

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Menunggu',  color: 'bg-yellow-100 text-yellow-700' },
  cooking:   { label: 'Dimasak',   color: 'bg-orange-100 text-orange-700' },
  ready:     { label: 'Siap Saji', color: 'bg-emerald-100 text-emerald-700' },
  served:    { label: 'Disajikan', color: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Lunas',     color: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'Batal',     color: 'bg-red-100 text-red-500' },
};

const emptyForm = { name: '', section: 'Utama', capacity: '4', notes: '' };

const SECTIONS = ['Utama', 'VIP', 'Outdoor', 'Smoking Area', 'Private Room', 'Teras', 'Lantai 2'];

export default function POSMejaPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('semua');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<TableItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [statusDialog, setStatusDialog] = useState(false);
  const [statusTarget, setStatusTarget] = useState<TableItem | null>(null);
  const [newStatus, setNewStatus] = useState<string>('available');

  const [orderDialog, setOrderDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([]);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TableItem | null>(null);

  const [addOrderDialog, setAddOrderDialog] = useState(false);
  const [orderForm, setOrderForm] = useState({ customer_name: '', notes: '' });
  const [orderSaving, setOrderSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      let tq = supabase
        .from('pos_tables' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('section')
        .order('name');
      if (activeOutlet) tq = tq.eq('outlet_id', activeOutlet.id);

      let oq = supabase
        .from('pos_table_orders' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .not('status', 'in', '(paid,cancelled)')
        .order('created_at', { ascending: false });
      if (activeOutlet) oq = oq.eq('outlet_id', activeOutlet.id);

      const [tRes, oRes] = await Promise.all([tq, oq]);
      setTables((tRes.data || []) as unknown as TableItem[]);
      setOrders((oRes.data || []) as unknown as TableOrder[]);
    } catch (err: any) {
      toast.error('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeOutlet]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime
  useEffect(() => {
    if (!tenant) return;
    const channel = supabase
      .channel('meja-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_tables' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_table_orders' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant, fetchAll]);

  const sections = ['semua', ...Array.from(new Set(tables.map(t => t.section))).sort()];

  const filteredTables = tables.filter(t =>
    activeSection === 'semua' ? true : t.section === activeSection
  );

  const getTableOrders = (tableId: string) =>
    orders.filter(o => o.table_id === tableId);

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (t: TableItem) => {
    setEditItem(t);
    setForm({ name: t.name, section: t.section, capacity: t.capacity.toString(), notes: t.notes || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tenant || !form.name.trim()) { toast.error('Nama meja wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenant.id,
        outlet_id: activeOutlet?.id || null,
        name: form.name.trim(),
        section: form.section,
        capacity: parseInt(form.capacity) || 4,
        notes: form.notes || null,
      };
      if (editItem) {
        await supabase.from('pos_tables' as any).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id);
        toast.success('Meja berhasil diperbarui');
      } else {
        await supabase.from('pos_tables' as any).insert(payload);
        toast.success('Meja berhasil ditambahkan');
      }
      setDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusTarget) return;
    try {
      await supabase.from('pos_tables' as any)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', statusTarget.id);
      toast.success(`Status meja ${statusTarget.name} diubah ke ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label}`);
      setStatusDialog(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supabase.from('pos_tables' as any).update({ is_active: false }).eq('id', deleteTarget.id);
      toast.success('Meja dihapus');
      setDeleteDialog(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openTableOrders = (table: TableItem) => {
    setSelectedTable(table);
    setTableOrders(getTableOrders(table.id));
    setOrderDialog(true);
  };

  const handleAddOrder = async () => {
    if (!tenant || !selectedTable) return;
    setOrderSaving(true);
    try {
      const orderNumber = `ORD-${Date.now()}`;
      await supabase.from('pos_table_orders' as any).insert({
        tenant_id: tenant.id,
        outlet_id: activeOutlet?.id || null,
        table_id: selectedTable.id,
        table_name: selectedTable.name,
        order_number: orderNumber,
        status: 'pending',
        items: [],
        customer_name: orderForm.customer_name || null,
        notes: orderForm.notes || null,
      });
      await supabase.from('pos_tables' as any)
        .update({ status: 'occupied', updated_at: new Date().toISOString() })
        .eq('id', selectedTable.id);
      toast.success(`Pesanan ${orderNumber} dibuat untuk ${selectedTable.name}`);
      setAddOrderDialog(false);
      setOrderDialog(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setOrderSaving(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'cooking') updates.cooking_started_at = new Date().toISOString();
      if (status === 'ready') updates.ready_at = new Date().toISOString();
      if (status === 'served') updates.served_at = new Date().toISOString();
      await supabase.from('pos_table_orders' as any).update(updates).eq('id', orderId);
      toast.success('Status pesanan diperbarui');
      fetchAll();
      if (selectedTable) setTableOrders(getTableOrders(selectedTable.id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
    cleaning: tables.filter(t => t.status === 'cleaning').length,
  };

  return (
    <POSLayout title="Manajemen Meja" subtitle="Layout dan status meja restoran">
      <div className="p-6 space-y-6">

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Meja', value: stats.total, color: 'text-gray-700' },
            { label: 'Tersedia', value: stats.available, color: 'text-emerald-600' },
            { label: 'Terisi', value: stats.occupied, color: 'text-red-600' },
            { label: 'Reservasi', value: stats.reserved, color: 'text-yellow-600' },
            { label: 'Dibersihkan', value: stats.cleaning, color: 'text-blue-600' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate('/pos/kds')} className="border-orange-400 text-orange-600 hover:bg-orange-50">
              <ChefHat className="h-4 w-4 mr-1" /> Buka KDS (Dapur)
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
          <Button size="sm" onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1" /> Tambah Meja
          </Button>
        </div>

        {/* Section Filter */}
        {sections.length > 2 && (
          <div className="flex gap-2 flex-wrap">
            {sections.map(s => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  activeSection === s
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-600'
                }`}
              >
                {s === 'semua' ? 'Semua Area' : s}
              </button>
            ))}
          </div>
        )}

        {/* Table Grid */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Memuat denah meja...</div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-12">
            <Table2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Belum ada meja. Klik "Tambah Meja" untuk mulai.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredTables.map(table => {
              const cfg = STATUS_CONFIG[table.status];
              const tOrders = getTableOrders(table.id);
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={table.id}
                  onClick={() => openTableOrders(table)}
                  className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${cfg.bg}`}
                >
                  {/* Status dot */}
                  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${cfg.color}`} />

                  {/* Table icon */}
                  <div className="flex justify-center mb-2">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${cfg.color} bg-opacity-20`}>
                      <Table2 className="h-8 w-8 text-white drop-shadow" />
                    </div>
                  </div>

                  <p className="font-bold text-center text-sm">{table.name}</p>
                  <p className="text-xs text-center text-muted-foreground">{table.section}</p>

                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{table.capacity} org</span>
                  </div>

                  <div className={`mt-2 text-center text-xs font-medium ${cfg.text}`}>
                    {cfg.label}
                  </div>

                  {tOrders.length > 0 && (
                    <div className="mt-1 text-center">
                      <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200">
                        {tOrders.length} pesanan aktif
                      </Badge>
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="flex gap-1 mt-2 justify-center" onClick={e => e.stopPropagation()}>
                    <button
                      className="text-xs px-2 py-0.5 rounded bg-white/80 border text-muted-foreground hover:bg-white"
                      onClick={() => { setStatusTarget(table); setNewStatus(table.status); setStatusDialog(true); }}
                    >
                      Status
                    </button>
                    <button
                      className="text-xs px-2 py-0.5 rounded bg-white/80 border text-muted-foreground hover:bg-white"
                      onClick={() => openEdit(table)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog Tambah/Edit Meja */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Meja' : 'Tambah Meja'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Nama Meja <span className="text-red-500">*</span></Label>
                <Input placeholder="cth: Meja 1, VIP A..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Kapasitas</Label>
                <Input type="number" min="1" max="50" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Area / Seksi</Label>
              <Select value={form.section} onValueChange={v => setForm(f => ({ ...f, section: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Catatan (opsional)</Label>
              <Textarea placeholder="cth: dekat jendela, khusus keluarga..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Menyimpan...' : (editItem ? 'Simpan' : 'Tambah Meja')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ubah Status */}
      <Dialog open={statusDialog} onOpenChange={setStatusDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ubah Status — {statusTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setNewStatus(key)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                  newStatus === key ? 'border-emerald-500 bg-emerald-50' : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className={`w-4 h-4 rounded-full ${cfg.color}`} />
                <span className="font-medium text-sm">{cfg.label}</span>
                {statusTarget?.status === key && <Badge className="ml-auto text-xs">Saat ini</Badge>}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(false)}>Batal</Button>
            <Button onClick={handleStatusChange} className="bg-emerald-600 hover:bg-emerald-700">Ubah Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detail Pesanan Meja */}
      <Dialog open={orderDialog} onOpenChange={setOrderDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5" />
              {selectedTable?.name} — {selectedTable?.section}
              <Badge className={STATUS_CONFIG[selectedTable?.status as keyof typeof STATUS_CONFIG]?.bg + ' ' + STATUS_CONFIG[selectedTable?.status as keyof typeof STATUS_CONFIG]?.text + ' text-xs border ml-2'}>
                {STATUS_CONFIG[selectedTable?.status as keyof typeof STATUS_CONFIG]?.label}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setOrderDialog(false); setAddOrderDialog(true); }} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-1" /> Buat Pesanan
              </Button>
              {selectedTable?.status === 'occupied' && (
                <Button size="sm" variant="outline" onClick={() => {
                  setStatusTarget(selectedTable!);
                  setNewStatus('available');
                  setStatusDialog(true);
                  setOrderDialog(false);
                }}>
                  Tandai Tersedia
                </Button>
              )}
            </div>

            {tableOrders.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">Tidak ada pesanan aktif di meja ini</p>
            ) : (
              <div className="space-y-3">
                {tableOrders.map(o => {
                  const osCfg = ORDER_STATUS_CONFIG[o.status] || { label: o.status, color: 'bg-gray-100 text-gray-500' };
                  return (
                    <div key={o.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-semibold">{o.order_number}</span>
                        <Badge className={osCfg.color + ' text-xs'}>{osCfg.label}</Badge>
                      </div>
                      {o.customer_name && <p className="text-xs text-muted-foreground mb-1">Pelanggan: {o.customer_name}</p>}
                      {o.notes && <p className="text-xs text-muted-foreground mb-2 italic">"{o.notes}"</p>}
                      <p className="text-xs text-muted-foreground mb-2">
                        {format(new Date(o.created_at), 'HH:mm', { locale: idLocale })} · {o.items.length} item
                      </p>
                      {o.status !== 'served' && o.status !== 'paid' && o.status !== 'cancelled' && (
                        <div className="flex gap-1 flex-wrap">
                          {o.status === 'pending' && (
                            <Button size="sm" className="h-7 text-xs bg-orange-500 hover:bg-orange-600" onClick={() => updateOrderStatus(o.id, 'cooking')}>
                              Mulai Masak
                            </Button>
                          )}
                          {o.status === 'cooking' && (
                            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => updateOrderStatus(o.id, 'ready')}>
                              Siap Saji
                            </Button>
                          )}
                          {o.status === 'ready' && (
                            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => updateOrderStatus(o.id, 'served')}>
                              Sudah Disajikan
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 hover:bg-red-50" onClick={() => updateOrderStatus(o.id, 'cancelled')}>
                            Batalkan
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Buat Pesanan Baru */}
      <Dialog open={addOrderDialog} onOpenChange={setAddOrderDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Buat Pesanan — {selectedTable?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Nama Pelanggan (opsional)</Label>
              <Input placeholder="cth: Pak Budi, Meja 3..." value={orderForm.customer_name} onChange={e => setOrderForm(f => ({ ...f, customer_name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Catatan Pesanan</Label>
              <Textarea placeholder="cth: tidak pakai pedas, extra nasi..." value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOrderDialog(false)}>Batal</Button>
            <Button onClick={handleAddOrder} disabled={orderSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {orderSaving ? 'Membuat...' : 'Buat Pesanan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Meja?</AlertDialogTitle>
            <AlertDialogDescription>
              Meja "<strong>{deleteTarget?.name}</strong>" akan dihapus dari sistem.
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
