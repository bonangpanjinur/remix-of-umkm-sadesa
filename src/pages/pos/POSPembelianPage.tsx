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
import { toast } from 'sonner';
import {
  Plus, Search, Truck, FileText, CheckCircle, Clock, XCircle,
  ChevronDown, ChevronRight, PackageCheck, Download, Eye,
  Trash2, Edit2, Send, PackagePlus, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Supplier { id: string; name: string; phone: string | null; contact_person: string | null; }
interface Product { id: string; name: string; sku: string | null; unit: string; cost_price: number; price: number; }

interface POItem {
  id?: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  unit: string;
  qty_ordered: number;
  qty_received: number;
  cost_price: number;
  discount: number;
  subtotal: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_name: string;
  supplier_id: string | null;
  status: string;
  order_date: string;
  expected_date: string | null;
  received_date: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  pos_purchase_order_items?: POItem[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: <FileText className="h-3 w-3" /> },
  sent: { label: 'Dikirim', color: 'bg-blue-100 text-blue-700', icon: <Send className="h-3 w-3" /> },
  partial: { label: 'Diterima Sebagian', color: 'bg-yellow-100 text-yellow-700', icon: <PackagePlus className="h-3 w-3" /> },
  received: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3 w-3" /> },
};

const EMPTY_ITEM: POItem = { product_id: null, product_name: '', sku: '', unit: 'pcs', qty_ordered: 1, qty_received: 0, cost_price: 0, discount: 0, subtotal: 0 };

function generatePONumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `PO-${y}${m}${d}-${rand}`;
}

export default function POSPembelianPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const { user } = useAuth();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('list');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplier_id: '',
    supplier_name: '',
    po_number: generatePONumber(),
    order_date: format(new Date(), 'yyyy-MM-dd'),
    expected_date: '',
    notes: '',
    discount_amount: 0,
    tax_rate: 0,
  });
  const [items, setItems] = useState<POItem[]>([{ ...EMPTY_ITEM }]);
  const [productSearch, setProductSearch] = useState('');
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    const [poRes, supRes, prodRes] = await Promise.all([
      supabase.from('pos_purchase_orders' as any)
        .select('*, pos_purchase_order_items(*)')
        .eq('tenant_id', tenant.id)
        .eq('outlet_id', activeOutlet.id)
        .order('created_at', { ascending: false }),
      supabase.from('pos_suppliers' as any)
        .select('id,name,phone,contact_person')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
      supabase.from('pos_products' as any)
        .select('id,name,sku,unit,cost_price,price')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
    ]);
    setPurchaseOrders((poRes.data || []) as unknown as PurchaseOrder[]);
    setSuppliers((supRes.data || []) as unknown as Supplier[]);
    setProducts((prodRes.data || []) as unknown as Product[]);
    setLoading(false);
  }, [tenant, activeOutlet]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredPOs = purchaseOrders.filter(po => {
    const matchStatus = filterStatus === 'all' || po.status === filterStatus;
    const matchSearch = po.po_number.toLowerCase().includes(search.toLowerCase()) ||
      po.supplier_name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totals = filteredPOs.reduce((acc, po) => ({
    count: acc.count + 1,
    total: acc.total + Number(po.total),
    paid: acc.paid + Number(po.amount_paid),
  }), { count: 0, total: 0, paid: 0 });

  const recalcItems = (newItems: POItem[]) => newItems.map(item => ({
    ...item,
    subtotal: (item.qty_ordered * item.cost_price) - item.discount,
  }));

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof POItem, value: any) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return recalcItems(next);
    });
  };

  const selectProduct = (idx: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    setItems(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku || '',
        unit: prod.unit,
        cost_price: Number(prod.cost_price) || 0,
        subtotal: (next[idx].qty_ordered * (Number(prod.cost_price) || 0)) - next[idx].discount,
      };
      return next;
    });
  };

  const getSubtotal = () => items.reduce((s, i) => s + i.subtotal, 0);
  const getTotal = () => {
    const sub = getSubtotal();
    const taxAmt = sub * (form.tax_rate / 100);
    return sub - form.discount_amount + taxAmt;
  };

  const openCreate = () => {
    setSelectedPO(null);
    setForm({
      supplier_id: '', supplier_name: '', po_number: generatePONumber(),
      order_date: format(new Date(), 'yyyy-MM-dd'), expected_date: '', notes: '',
      discount_amount: 0, tax_rate: 0,
    });
    setItems([{ ...EMPTY_ITEM }]);
    setDialogOpen(true);
  };

  const handleSupplierChange = (supplierId: string) => {
    const sup = suppliers.find(s => s.id === supplierId);
    setForm(f => ({ ...f, supplier_id: supplierId, supplier_name: sup?.name || '' }));
  };

  const savePO = async () => {
    if (!tenant || !activeOutlet || !user) return;
    if (!form.supplier_name.trim()) { toast.error('Nama supplier wajib diisi'); return; }
    const validItems = items.filter(i => i.product_name.trim() && i.qty_ordered > 0);
    if (validItems.length === 0) { toast.error('Minimal satu item produk'); return; }

    setSaving(true);
    try {
      const sub = validItems.reduce((s, i) => s + i.subtotal, 0);
      const taxAmt = sub * (form.tax_rate / 100);
      const total = sub - form.discount_amount + taxAmt;

      const { data: poData, error: poError } = await supabase.from('pos_purchase_orders' as any).insert({
        tenant_id: tenant.id,
        outlet_id: activeOutlet.id,
        supplier_id: form.supplier_id || null,
        supplier_name: form.supplier_name,
        po_number: form.po_number,
        status: 'draft',
        order_date: form.order_date,
        expected_date: form.expected_date || null,
        subtotal: sub,
        discount_amount: form.discount_amount,
        tax_amount: taxAmt,
        total,
        amount_paid: 0,
        notes: form.notes || null,
        created_by: user.id,
      }).select().single();

      if (poError) throw poError;

      const itemsPayload = validItems.map(item => ({
        purchase_order_id: (poData as any).id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        sku: item.sku || null,
        unit: item.unit,
        qty_ordered: item.qty_ordered,
        qty_received: 0,
        cost_price: item.cost_price,
        discount: item.discount,
        subtotal: item.subtotal,
        notes: null,
      }));

      const { error: itemsError } = await supabase.from('pos_purchase_order_items' as any).insert(itemsPayload);
      if (itemsError) throw itemsError;

      toast.success(`Purchase Order ${form.po_number} berhasil dibuat`);
      setDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error('Gagal menyimpan PO: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (po: PurchaseOrder, newStatus: string) => {
    const { error } = await supabase.from('pos_purchase_orders' as any)
      .update({ status: newStatus, updated_by: user?.id })
      .eq('id', po.id);
    if (error) { toast.error('Gagal update status'); return; }
    toast.success(`Status PO diperbarui ke: ${STATUS_CONFIG[newStatus]?.label}`);
    fetchAll();
  };

  const openReceive = (po: PurchaseOrder) => {
    setSelectedPO(po);
    const initial: Record<string, number> = {};
    (po.pos_purchase_order_items || []).forEach(item => {
      initial[item.id!] = item.qty_ordered - item.qty_received;
    });
    setReceiveQtys(initial);
    setReceiveDialogOpen(true);
  };

  const saveReceive = async () => {
    if (!selectedPO || !tenant || !activeOutlet || !user) return;
    setSaving(true);
    try {
      const items = selectedPO.pos_purchase_order_items || [];
      let allReceived = true;
      let anyReceived = false;

      for (const item of items) {
        const receiveQty = receiveQtys[item.id!] || 0;
        if (receiveQty <= 0) continue;
        anyReceived = true;

        const newQtyReceived = item.qty_received + receiveQty;
        if (newQtyReceived < item.qty_ordered) allReceived = false;

        await supabase.from('pos_purchase_order_items' as any)
          .update({ qty_received: newQtyReceived })
          .eq('id', item.id);

        if (item.product_id) {
          const { data: existing } = await supabase.from('pos_stock' as any)
            .select('id, quantity')
            .eq('product_id', item.product_id)
            .eq('outlet_id', activeOutlet.id)
            .maybeSingle();

          if (existing) {
            const newQty = Number((existing as any).quantity) + receiveQty;
            await supabase.from('pos_stock' as any)
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq('id', (existing as any).id);
            await supabase.from('pos_stock_mutations' as any).insert({
              tenant_id: tenant.id,
              product_id: item.product_id,
              outlet_id: activeOutlet.id,
              type: 'purchase',
              quantity: receiveQty,
              quantity_before: Number((existing as any).quantity),
              quantity_after: newQty,
              reference_id: selectedPO.id,
              reference_type: 'purchase_order',
              notes: `Penerimaan PO ${selectedPO.po_number}`,
              created_by: user.id,
            });
          } else {
            await supabase.from('pos_stock' as any).insert({
              tenant_id: tenant.id,
              product_id: item.product_id,
              outlet_id: activeOutlet.id,
              quantity: receiveQty,
              min_stock: 0,
            });
            await supabase.from('pos_stock_mutations' as any).insert({
              tenant_id: tenant.id,
              product_id: item.product_id,
              outlet_id: activeOutlet.id,
              type: 'purchase',
              quantity: receiveQty,
              quantity_before: 0,
              quantity_after: receiveQty,
              reference_id: selectedPO.id,
              reference_type: 'purchase_order',
              notes: `Penerimaan PO ${selectedPO.po_number}`,
              created_by: user.id,
            });
          }
        }
      }

      if (!anyReceived) { toast.error('Tidak ada barang yang diterima'); setSaving(false); return; }

      const newStatus = allReceived ? 'received' : 'partial';
      await supabase.from('pos_purchase_orders' as any)
        .update({ status: newStatus, received_date: new Date().toISOString(), updated_by: user.id })
        .eq('id', selectedPO.id);

      toast.success('Penerimaan barang berhasil disimpan & stok diperbarui');
      setReceiveDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error('Gagal menyimpan penerimaan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['No PO', 'Supplier', 'Status', 'Tanggal', 'Total', 'Dibayar', 'Sisa'],
      ...filteredPOs.map(po => [
        po.po_number, po.supplier_name, STATUS_CONFIG[po.status]?.label || po.status,
        format(new Date(po.order_date), 'dd/MM/yyyy'),
        po.total, po.amount_paid, Number(po.total) - Number(po.amount_paid),
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `pembelian-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

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

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pembelian (Purchase Order)</h1>
            <p className="text-muted-foreground text-sm">Kelola pembelian barang dari supplier</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> Buat PO Baru
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = purchaseOrders.filter(p => p.status === key).length;
            return (
              <Card key={key} className={`cursor-pointer border-2 transition-colors ${filterStatus === key ? 'border-emerald-500' : 'border-transparent'}`}
                onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">{cfg.icon}<span className="text-xs font-medium text-muted-foreground">{cfg.label}</span></div>
                  <p className="text-2xl font-bold">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Totals */}
        <Card>
          <CardContent className="p-4 flex gap-6 flex-wrap">
            <div><p className="text-xs text-muted-foreground">Total PO</p><p className="font-bold">{totals.count}</p></div>
            <div><p className="text-xs text-muted-foreground">Total Nilai</p><p className="font-bold text-emerald-600">{formatCurrency(totals.total)}</p></div>
            <div><p className="text-xs text-muted-foreground">Sudah Dibayar</p><p className="font-bold">{formatCurrency(totals.paid)}</p></div>
            <div><p className="text-xs text-muted-foreground">Sisa Hutang</p><p className="font-bold text-red-500">{formatCurrency(totals.total - totals.paid)}</p></div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari No PO atau supplier..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* PO List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Memuat...</div>
        ) : filteredPOs.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Belum ada Purchase Order</p>
              <p className="text-sm">Klik "Buat PO Baru" untuk membuat pembelian ke supplier</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredPOs.map(po => {
              const cfg = STATUS_CONFIG[po.status] || STATUS_CONFIG.draft;
              const isExpanded = expandedPO === po.id;
              const items = po.pos_purchase_order_items || [];
              return (
                <Card key={po.id} className="overflow-hidden">
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm">{po.po_number}</span>
                        <Badge className={`text-xs ${cfg.color} border-0`}>
                          <span className="mr-1">{cfg.icon}</span>{cfg.label}
                        </Badge>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{po.supplier_name}</span>
                        <span>{format(new Date(po.order_date), 'dd MMM yyyy', { locale: idLocale })}</span>
                        {po.expected_date && <span>Est: {format(new Date(po.expected_date), 'dd MMM yyyy', { locale: idLocale })}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-emerald-600">{formatCurrency(Number(po.total))}</p>
                      {Number(po.amount_paid) < Number(po.total) && (
                        <p className="text-xs text-red-500">Hutang: {formatCurrency(Number(po.total) - Number(po.amount_paid))}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {po.status === 'draft' && (
                        <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 h-7 text-xs"
                          onClick={e => { e.stopPropagation(); updateStatus(po, 'sent'); }}>
                          <Send className="h-3 w-3 mr-1" />Kirim
                        </Button>
                      )}
                      {(po.status === 'sent' || po.status === 'partial') && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
                          onClick={e => { e.stopPropagation(); openReceive(po); }}>
                          <PackageCheck className="h-3 w-3 mr-1" />Terima
                        </Button>
                      )}
                      {po.status === 'draft' && (
                        <Button size="sm" variant="ghost" className="text-red-500 h-7 text-xs"
                          onClick={e => { e.stopPropagation(); updateStatus(po, 'cancelled'); }}>
                          <XCircle className="h-3 w-3" />
                        </Button>
                      )}
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-4 pb-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produk</TableHead>
                            <TableHead className="text-right">Dipesan</TableHead>
                            <TableHead className="text-right">Diterima</TableHead>
                            <TableHead className="text-right">Harga Beli</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <p className="font-medium text-sm">{item.product_name}</p>
                                {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                              </TableCell>
                              <TableCell className="text-right">{item.qty_ordered} {item.unit}</TableCell>
                              <TableCell className="text-right">
                                <span className={item.qty_received >= item.qty_ordered ? 'text-emerald-600 font-medium' : item.qty_received > 0 ? 'text-yellow-600' : ''}>
                                  {item.qty_received} {item.unit}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(Number(item.cost_price))}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(Number(item.subtotal))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {po.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">Catatan: {po.notes}</p>
                      )}
                      <div className="flex justify-end mt-2 gap-4 text-sm">
                        <span>Subtotal: <strong>{formatCurrency(Number(po.subtotal))}</strong></span>
                        {Number(po.discount_amount) > 0 && <span>Diskon: <strong>-{formatCurrency(Number(po.discount_amount))}</strong></span>}
                        {Number(po.tax_amount) > 0 && <span>Pajak: <strong>{formatCurrency(Number(po.tax_amount))}</strong></span>}
                        <span>Total: <strong className="text-emerald-600">{formatCurrency(Number(po.total))}</strong></span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Create PO Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Buat Purchase Order Baru</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  {suppliers.length > 0 ? (
                    <Select value={form.supplier_id} onValueChange={handleSupplierChange}>
                      <SelectTrigger><SelectValue placeholder="Pilih supplier..." /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input placeholder="Nama supplier" value={form.supplier_name}
                      onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} />
                  )}
                  {form.supplier_id && (
                    <Input placeholder="Nama supplier (bisa diubah)" value={form.supplier_name}
                      onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} className="mt-1" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>No. PO</Label>
                  <Input value={form.po_number} onChange={e => setForm(f => ({ ...f, po_number: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal PO *</Label>
                  <Input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Estimasi Tiba</Label>
                  <Input type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold">Item Produk</Label>
                  <div className="relative w-48">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Cari produk..." value={productSearch}
                      onChange={e => setProductSearch(e.target.value)} className="pl-7 h-7 text-xs" />
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Produk</TableHead>
                        <TableHead className="w-20">Qty</TableHead>
                        <TableHead className="w-24">Satuan</TableHead>
                        <TableHead className="w-32">Harga Beli</TableHead>
                        <TableHead className="w-28">Diskon</TableHead>
                        <TableHead className="w-28 text-right">Subtotal</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select value={item.product_id || ''} onValueChange={v => selectProduct(idx, v)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Pilih produk..." />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredProducts.map(p => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                    {p.name} {p.sku ? `(${p.sku})` : ''}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__custom__" className="text-xs italic">+ Ketik manual</SelectItem>
                              </SelectContent>
                            </Select>
                            {(item.product_id === '__custom__' || !item.product_id) && (
                              <Input placeholder="Nama produk" value={item.product_name} className="mt-1 h-7 text-xs"
                                onChange={e => updateItem(idx, 'product_name', e.target.value)} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0.001" step="0.001" value={item.qty_ordered} className="h-7 text-xs"
                              onChange={e => updateItem(idx, 'qty_ordered', Number(e.target.value))} />
                          </TableCell>
                          <TableCell>
                            <Input value={item.unit} className="h-7 text-xs"
                              onChange={e => updateItem(idx, 'unit', e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" value={item.cost_price} className="h-7 text-xs"
                              onChange={e => updateItem(idx, 'cost_price', Number(e.target.value))} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" value={item.discount} className="h-7 text-xs"
                              onChange={e => updateItem(idx, 'discount', Number(e.target.value))} />
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatCurrency(item.subtotal)}
                          </TableCell>
                          <TableCell>
                            {items.length > 1 && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                                onClick={() => removeItem(idx)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" /> Tambah Item
                </Button>
              </div>

              {/* Totals & Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Textarea rows={3} placeholder="Catatan PO..." value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(getSubtotal())}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm shrink-0">Diskon (Rp):</Label>
                    <Input type="number" min="0" value={form.discount_amount} className="h-7 text-sm"
                      onChange={e => setForm(f => ({ ...f, discount_amount: Number(e.target.value) }))} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm shrink-0">Pajak (%):</Label>
                    <Input type="number" min="0" max="100" value={form.tax_rate} className="h-7 text-sm"
                      onChange={e => setForm(f => ({ ...f, tax_rate: Number(e.target.value) }))} />
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-emerald-600 text-lg">{formatCurrency(getTotal())}</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button onClick={savePO} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Menyimpan...' : 'Simpan PO'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Receive Dialog */}
        <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Terima Barang — {selectedPO?.po_number}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Masukkan jumlah barang yang diterima. Stok akan diperbarui otomatis.</p>
            {selectedPO && (
              <div className="space-y-3">
                {(selectedPO.pos_purchase_order_items || []).map(item => {
                  const remaining = item.qty_ordered - item.qty_received;
                  return (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Dipesan: {item.qty_ordered} | Sudah diterima: {item.qty_received} | Sisa: {remaining}
                          </p>
                        </div>
                        {!item.product_id && (
                          <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                            Tanpa stok
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm w-32 shrink-0">Terima sekarang:</Label>
                        <Input type="number" min="0" max={remaining}
                          value={receiveQtys[item.id!] ?? remaining}
                          onChange={e => setReceiveQtys(prev => ({ ...prev, [item.id!]: Number(e.target.value) }))}
                          className="h-8 w-28" />
                        <span className="text-sm text-muted-foreground">{item.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>Batal</Button>
              <Button onClick={saveReceive} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Menyimpan...' : 'Konfirmasi Penerimaan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </POSLayout>
  );
}
