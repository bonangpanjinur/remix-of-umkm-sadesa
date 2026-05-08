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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  ArrowRightLeft, Plus, Package, Search, Download, RefreshCw,
  CheckCircle, XCircle, Clock, Send, Truck, ChevronDown,
  ChevronRight, AlertCircle, Trash2, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Outlet { id: string; name: string; address: string | null; }
interface Product { id: string; name: string; sku: string | null; unit: string; }
interface StockInfo { product_id: string; quantity: number; outlet_id: string; }

interface TransferItem {
  product_id: string;
  product_name: string;
  sku: string;
  unit: string;
  qty_requested: number;
  available_stock: number;
}

interface Transfer {
  id: string;
  transfer_number: string;
  status: string;
  notes: string | null;
  rejection_reason: string | null;
  requested_at: string;
  approved_at: string | null;
  completed_at: string | null;
  from_outlet_id: string;
  to_outlet_id: string;
  from_outlet?: { name: string };
  to_outlet?: { name: string };
  pos_stock_transfer_items?: TransferItemDB[];
}

interface TransferItemDB {
  id: string;
  product_id?: string;
  product_name: string;
  sku: string | null;
  unit: string;
  qty_requested: number;
  qty_sent: number;
  qty_received: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-700',    icon: <Clock className="h-3 w-3" /> },
  pending:   { label: 'Menunggu',  color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-3 w-3" /> },
  approved:  { label: 'Disetujui', color: 'bg-blue-100 text-blue-700',    icon: <CheckCircle className="h-3 w-3" /> },
  completed: { label: 'Selesai',   color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="h-3 w-3" /> },
  rejected:  { label: 'Ditolak',   color: 'bg-red-100 text-red-700',      icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: 'Dibatalkan',color: 'bg-red-100 text-red-700',      icon: <XCircle className="h-3 w-3" /> },
};

function genTransferNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `TRF-${y}${m}${d}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export default function POSTransferStokPage() {
  const { tenant, activeOutlet, outlets } = usePOS();
  const { user } = useAuth();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});

  const [form, setForm] = useState({
    from_outlet_id: activeOutlet?.id || '',
    to_outlet_id: '',
    transfer_number: genTransferNumber(),
    notes: '',
  });
  const [items, setItems] = useState<TransferItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOutlet, setFilterOutlet] = useState('all');

  const fetchAll = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [trfRes, prodRes] = await Promise.all([
        supabase.from('pos_stock_transfers' as any)
          .select(`*, 
            from_outlet:pos_outlets!pos_stock_transfers_from_outlet_id_fkey(name),
            to_outlet:pos_outlets!pos_stock_transfers_to_outlet_id_fkey(name),
            pos_stock_transfer_items(*)`)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false }),
        supabase.from('pos_products' as any)
          .select('id, name, sku, unit')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .order('name'),
      ]);
      setTransfers((trfRes.data || []) as unknown as Transfer[]);
      setProducts((prodRes.data || []) as unknown as Product[]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  const fetchStock = useCallback(async (outletId: string) => {
    if (!tenant || !outletId) return;
    const { data } = await supabase.from('pos_stock' as any)
      .select('product_id, quantity')
      .eq('tenant_id', tenant.id)
      .eq('outlet_id', outletId);
    const map: Record<string, number> = {};
    (data || []).forEach((s: any) => { map[s.product_id] = Number(s.quantity); });
    setStockMap(map);
  }, [tenant]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (form.from_outlet_id) fetchStock(form.from_outlet_id); }, [form.from_outlet_id, fetchStock]);
  useEffect(() => { if (activeOutlet) setForm(f => ({ ...f, from_outlet_id: activeOutlet.id })); }, [activeOutlet]);

  const addItem = (productId: string) => {
    if (items.find(i => i.product_id === productId)) return;
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    setItems(prev => [...prev, {
      product_id: prod.id, product_name: prod.name,
      sku: prod.sku || '', unit: prod.unit,
      qty_requested: 1, available_stock: stockMap[prod.id] || 0,
    }]);
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateQty = (idx: number, qty: number) => setItems(prev => {
    const next = [...prev];
    next[idx] = { ...next[idx], qty_requested: Math.max(0.001, qty) };
    return next;
  });

  const createTransfer = async () => {
    if (!tenant || !user) return;
    if (!form.to_outlet_id || form.from_outlet_id === form.to_outlet_id) {
      toast.error('Pilih outlet tujuan yang berbeda dari outlet asal'); return;
    }
    if (items.length === 0) { toast.error('Minimal satu item produk'); return; }
    const overStock = items.filter(i => i.qty_requested > i.available_stock);
    if (overStock.length > 0) {
      toast.error(`Stok ${overStock[0].product_name} tidak mencukupi (tersedia: ${overStock[0].available_stock})`); return;
    }
    setSaving(true);
    try {
      const { data: trf, error: trfErr } = await supabase.from('pos_stock_transfers' as any).insert({
        tenant_id: tenant.id,
        transfer_number: form.transfer_number,
        from_outlet_id: form.from_outlet_id,
        to_outlet_id: form.to_outlet_id,
        status: 'pending',
        notes: form.notes || null,
        requested_by: user.id,
      }).select().single();
      if (trfErr) throw trfErr;

      const itemsPayload = items.map(i => ({
        transfer_id: (trf as any).id,
        product_id: i.product_id,
        product_name: i.product_name,
        sku: i.sku || null,
        unit: i.unit,
        qty_requested: i.qty_requested,
        qty_sent: 0, qty_received: 0,
      }));
      const { error: itemErr } = await supabase.from('pos_stock_transfer_items' as any).insert(itemsPayload);
      if (itemErr) throw itemErr;

      // Log audit
      await supabase.from('pos_audit_logs' as any).insert({
        tenant_id: tenant.id, outlet_id: form.from_outlet_id,
        user_id: user.id, user_name: user.email,
        action: 'create', module: 'transfer_stok',
        entity_type: 'pos_stock_transfers', entity_id: (trf as any).id,
        description: `Buat transfer stok ${form.transfer_number} → ${outlets.find(o => o.id === form.to_outlet_id)?.name}`,
      });

      toast.success(`Transfer ${form.transfer_number} berhasil dibuat`);
      setCreateOpen(false);
      setItems([]);
      setForm(f => ({ ...f, transfer_number: genTransferNumber(), to_outlet_id: '', notes: '' }));
      fetchAll();
    } catch (err: any) {
      toast.error('Gagal membuat transfer: ' + err.message);
    } finally { setSaving(false); }
  };

  const approveTransfer = async (trf: Transfer) => {
    if (!user) return;
    await supabase.from('pos_stock_transfers' as any)
      .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
      .eq('id', trf.id);

    await supabase.from('pos_audit_logs' as any).insert({
      tenant_id: tenant!.id, outlet_id: trf.from_outlet_id,
      user_id: user.id, user_name: user.email,
      action: 'approve', module: 'transfer_stok',
      entity_type: 'pos_stock_transfers', entity_id: trf.id,
      description: `Setujui transfer stok ${trf.transfer_number}`,
    });

    toast.success('Transfer disetujui');
    fetchAll();
  };

  const openReject = (trf: Transfer) => { setSelectedTransfer(trf); setRejectReason(''); setRejectOpen(true); };

  const rejectTransfer = async () => {
    if (!selectedTransfer || !user) return;
    await supabase.from('pos_stock_transfers' as any)
      .update({ status: 'rejected', rejection_reason: rejectReason || 'Tidak ada alasan' })
      .eq('id', selectedTransfer.id);

    await supabase.from('pos_audit_logs' as any).insert({
      tenant_id: tenant!.id, outlet_id: selectedTransfer.from_outlet_id,
      user_id: user.id, user_name: user.email,
      action: 'reject', module: 'transfer_stok',
      entity_type: 'pos_stock_transfers', entity_id: selectedTransfer.id,
      description: `Tolak transfer stok ${selectedTransfer.transfer_number}: ${rejectReason}`,
    });

    toast.success('Transfer ditolak');
    setRejectOpen(false);
    fetchAll();
  };

  const openReceive = (trf: Transfer) => {
    setSelectedTransfer(trf);
    const init: Record<string, number> = {};
    (trf.pos_stock_transfer_items || []).forEach(i => { init[i.id] = i.qty_requested; });
    setReceiveQtys(init);
    setReceiveOpen(true);
  };

  const completeTransfer = async () => {
    if (!selectedTransfer || !tenant || !user) return;
    setSaving(true);
    try {
      const trfItems = selectedTransfer.pos_stock_transfer_items || [];

      for (const item of trfItems) {
        const sentQty = Number(item.qty_requested);
        const receivedQty = receiveQtys[item.id] ?? sentQty;

        // Deduct from source outlet
        const { data: srcStock } = await supabase.from('pos_stock' as any)
          .select('id, quantity').eq('product_id', item.product_id || '')
          .eq('outlet_id', selectedTransfer.from_outlet_id).maybeSingle();

        if (srcStock) {
          const newSrcQty = Math.max(0, Number((srcStock as any).quantity) - sentQty);
          await supabase.from('pos_stock' as any).update({ quantity: newSrcQty }).eq('id', (srcStock as any).id);
          await supabase.from('pos_stock_mutations' as any).insert({
            tenant_id: tenant.id, product_id: item.product_id,
            outlet_id: selectedTransfer.from_outlet_id, type: 'transfer_out',
            quantity: sentQty, quantity_before: Number((srcStock as any).quantity), quantity_after: newSrcQty,
            reference_id: selectedTransfer.id, reference_type: 'stock_transfer',
            notes: `Transfer keluar → ${selectedTransfer.to_outlet?.name} (${selectedTransfer.transfer_number})`,
            created_by: user.id,
          });
        }

        // Add to destination outlet
        const { data: dstStock } = await supabase.from('pos_stock' as any)
          .select('id, quantity').eq('product_id', item.product_id || '')
          .eq('outlet_id', selectedTransfer.to_outlet_id).maybeSingle();

        if (dstStock) {
          const newDstQty = Number((dstStock as any).quantity) + receivedQty;
          await supabase.from('pos_stock' as any).update({ quantity: newDstQty }).eq('id', (dstStock as any).id);
          await supabase.from('pos_stock_mutations' as any).insert({
            tenant_id: tenant.id, product_id: item.product_id,
            outlet_id: selectedTransfer.to_outlet_id, type: 'transfer_in',
            quantity: receivedQty, quantity_before: Number((dstStock as any).quantity), quantity_after: newDstQty,
            reference_id: selectedTransfer.id, reference_type: 'stock_transfer',
            notes: `Transfer masuk ← ${selectedTransfer.from_outlet?.name} (${selectedTransfer.transfer_number})`,
            created_by: user.id,
          });
        } else {
          await supabase.from('pos_stock' as any).insert({
            tenant_id: tenant.id, product_id: item.product_id,
            outlet_id: selectedTransfer.to_outlet_id, quantity: receivedQty, min_stock: 0,
          });
        }

        // Update item qtys
        await supabase.from('pos_stock_transfer_items' as any)
          .update({ qty_sent: sentQty, qty_received: receivedQty }).eq('id', item.id);
      }

      await supabase.from('pos_stock_transfers' as any).update({
        status: 'completed', completed_by: user.id, completed_at: new Date().toISOString(),
      }).eq('id', selectedTransfer.id);

      await supabase.from('pos_audit_logs' as any).insert({
        tenant_id: tenant.id, outlet_id: selectedTransfer.from_outlet_id,
        user_id: user.id, user_name: user.email,
        action: 'complete', module: 'transfer_stok',
        entity_type: 'pos_stock_transfers', entity_id: selectedTransfer.id,
        description: `Selesaikan transfer stok ${selectedTransfer.transfer_number} — stok diperbarui otomatis`,
      });

      toast.success('Transfer selesai — stok kedua outlet diperbarui');
      setReceiveOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error('Gagal menyelesaikan transfer: ' + err.message);
    } finally { setSaving(false); }
  };

  const exportCSV = () => {
    const rows = [
      ['No Transfer', 'Dari', 'Ke', 'Status', 'Tanggal', 'Jumlah Item'],
      ...transfers.map(t => [
        t.transfer_number,
        (t.from_outlet as any)?.name || t.from_outlet_id,
        (t.to_outlet as any)?.name || t.to_outlet_id,
        STATUS_CONFIG[t.status]?.label || t.status,
        format(new Date(t.requested_at), 'dd/MM/yyyy'),
        (t.pos_stock_transfer_items || []).length,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `transfer-stok-${format(new Date(), 'yyyyMMdd')}.csv`; a.click();
  };

  const filteredTransfers = transfers.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchOutlet = filterOutlet === 'all' ||
      t.from_outlet_id === filterOutlet || t.to_outlet_id === filterOutlet;
    return matchStatus && matchOutlet;
  });

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const statsMap = Object.fromEntries(
    Object.keys(STATUS_CONFIG).map(k => [k, transfers.filter(t => t.status === k).length])
  );

  if (!tenant) return (
    <POSLayout><div className="flex items-center justify-center h-64">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
    </div></POSLayout>
  );

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Transfer Stok Antar Outlet</h1>
            <p className="text-muted-foreground text-sm">Pindahkan stok produk antar cabang</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchAll(); fetchStock(form.from_outlet_id); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            {outlets.length >= 2 ? (
              <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-1" /> Buat Transfer
              </Button>
            ) : (
              <Button disabled title="Butuh minimal 2 outlet">
                <Plus className="h-4 w-4 mr-1" /> Buat Transfer
              </Button>
            )}
          </div>
        </div>

        {outlets.length < 2 && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Transfer stok membutuhkan minimal 2 outlet. Tambahkan outlet baru di halaman Pengaturan.
            </AlertDescription>
          </Alert>
        )}

        {/* Status Summary Cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <Card key={key} className={`cursor-pointer border-2 transition-colors ${filterStatus === key ? 'border-emerald-500' : 'border-transparent'}`}
              onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{cfg.label}</p>
                <p className="text-xl font-bold">{statsMap[key] || 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Semua Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterOutlet} onValueChange={setFilterOutlet}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Semua Outlet" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Outlet</SelectItem>
              {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Transfer List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Memuat...</div>
        ) : filteredTransfers.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Belum ada transfer stok</p>
              <p className="text-sm">Klik "Buat Transfer" untuk memindahkan stok antar outlet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTransfers.map(trf => {
              const cfg = STATUS_CONFIG[trf.status] || STATUS_CONFIG.draft;
              const isExpanded = expandedId === trf.id;
              const trfItems = trf.pos_stock_transfer_items || [];
              return (
                <Card key={trf.id} className="overflow-hidden">
                  <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30"
                    onClick={() => setExpandedId(isExpanded ? null : trf.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm">{trf.transfer_number}</span>
                        <Badge className={`text-xs border-0 ${cfg.color}`}>
                          <span className="mr-1">{cfg.icon}</span>{cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium">{(trf.from_outlet as any)?.name || '?'}</span>
                        <ArrowRightLeft className="h-3 w-3" />
                        <span className="font-medium">{(trf.to_outlet as any)?.name || '?'}</span>
                        <span>• {trfItems.length} produk</span>
                        <span>• {format(new Date(trf.requested_at), 'dd MMM yyyy', { locale: idLocale })}</span>
                      </div>
                      {trf.rejection_reason && (
                        <p className="text-xs text-red-500 mt-1">Alasan: {trf.rejection_reason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {trf.status === 'pending' && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
                            onClick={e => { e.stopPropagation(); approveTransfer(trf); }}>
                            <CheckCircle className="h-3 w-3 mr-1" />Setujui
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-200 text-red-600 h-7 text-xs"
                            onClick={e => { e.stopPropagation(); openReject(trf); }}>
                            <XCircle className="h-3 w-3 mr-1" />Tolak
                          </Button>
                        </>
                      )}
                      {trf.status === 'approved' && (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs"
                          onClick={e => { e.stopPropagation(); openReceive(trf); }}>
                          <Truck className="h-3 w-3 mr-1" />Selesaikan
                        </Button>
                      )}
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && trfItems.length > 0 && (
                    <div className="border-t px-4 pb-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produk</TableHead>
                            <TableHead className="text-right">Diminta</TableHead>
                            <TableHead className="text-right">Dikirim</TableHead>
                            <TableHead className="text-right">Diterima</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trfItems.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <p className="text-sm font-medium">{item.product_name}</p>
                                {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                              </TableCell>
                              <TableCell className="text-right">{item.qty_requested} {item.unit}</TableCell>
                              <TableCell className="text-right">{item.qty_sent || '-'}</TableCell>
                              <TableCell className="text-right">
                                <span className={item.qty_received > 0 ? 'text-emerald-600 font-medium' : ''}>
                                  {item.qty_received || '-'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {trf.notes && <p className="text-xs text-muted-foreground mt-2 italic">Catatan: {trf.notes}</p>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Transfer Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Buat Transfer Stok Baru</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Outlet Asal *</Label>
                  <Select value={form.from_outlet_id} onValueChange={v => setForm(f => ({ ...f, from_outlet_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pilih outlet asal..." /></SelectTrigger>
                    <SelectContent>
                      {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Outlet Tujuan *</Label>
                  <Select value={form.to_outlet_id} onValueChange={v => setForm(f => ({ ...f, to_outlet_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pilih outlet tujuan..." /></SelectTrigger>
                    <SelectContent>
                      {outlets.filter(o => o.id !== form.from_outlet_id).map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>No. Transfer</Label>
                  <Input value={form.transfer_number} onChange={e => setForm(f => ({ ...f, transfer_number: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Input placeholder="Alasan transfer..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              {/* Product Search */}
              <div>
                <Label className="text-base font-semibold">Produk yang Ditransfer</Label>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Cari produk untuk ditambahkan..." value={productSearch}
                      onChange={e => setProductSearch(e.target.value)} className="pl-9" />
                  </div>
                </div>
                {productSearch && (
                  <div className="border rounded-lg mt-2 max-h-40 overflow-y-auto">
                    {filteredProducts.slice(0, 10).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                        onClick={() => { addItem(p.id); setProductSearch(''); }}>
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Stok: {stockMap[p.id] || 0} {p.unit}</p>
                          <Button size="sm" variant="outline" className="h-6 text-xs">+ Tambah</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-right">Stok Ada</TableHead>
                      <TableHead className="w-28">Qty Transfer</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <p className="font-medium text-sm">{item.product_name}</p>
                          {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                        </TableCell>
                        <TableCell className={`text-right text-sm ${item.available_stock < item.qty_requested ? 'text-red-500 font-bold' : ''}`}>
                          {item.available_stock} {item.unit}
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0.001" step="0.001"
                            max={item.available_stock} value={item.qty_requested} className="h-7 text-sm"
                            onChange={e => updateQty(idx, Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button>
              <Button onClick={createTransfer} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Menyimpan...' : 'Buat Transfer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Tolak Transfer — {selectedTransfer?.transfer_number}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Label>Alasan Penolakan</Label>
              <Textarea rows={3} placeholder="Masukkan alasan penolakan..." value={rejectReason}
                onChange={e => setRejectReason(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Batal</Button>
              <Button variant="destructive" onClick={rejectTransfer}>Tolak Transfer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Complete/Receive Dialog */}
        <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
          <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Selesaikan Transfer — {selectedTransfer?.transfer_number}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Konfirmasi jumlah barang yang diterima di <strong>{(selectedTransfer?.to_outlet as any)?.name}</strong>. Stok akan diperbarui otomatis.
            </p>
            {selectedTransfer && (selectedTransfer.pos_stock_transfer_items || []).map(item => (
              <div key={item.id} className="border rounded-lg p-3">
                <p className="font-medium text-sm">{item.product_name}</p>
                <p className="text-xs text-muted-foreground mb-2">Diminta: {item.qty_requested} {item.unit}</p>
                <div className="flex items-center gap-2">
                  <Label className="text-sm shrink-0">Diterima:</Label>
                  <Input type="number" min="0" max={item.qty_requested} value={receiveQtys[item.id] ?? item.qty_requested}
                    onChange={e => setReceiveQtys(p => ({ ...p, [item.id]: Number(e.target.value) }))}
                    className="h-8 w-24" />
                  <span className="text-sm text-muted-foreground">{item.unit}</span>
                </div>
              </div>
            ))}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReceiveOpen(false)}>Batal</Button>
              <Button onClick={completeTransfer} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Memproses...' : 'Konfirmasi & Update Stok'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </POSLayout>
  );
}
