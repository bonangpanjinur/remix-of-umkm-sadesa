import { useState, useEffect } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { RotateCcw, Search, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface Return {
  id: string;
  return_number: string;
  reason: string | null;
  refund_method: string;
  total_refund: number;
  restock: boolean;
  created_at: string;
  pos_sales?: { sale_number: string; customer_name: string | null };
}

interface Sale { id: string; sale_number: string; total: number; customer_name: string | null; pos_sale_items: SaleItem[]; }
interface SaleItem { id: string; product_name: string; qty: number; price: number; subtotal: number; }

export default function POSReturPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const { user } = useAuth();
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [saleSearch, setSaleSearch] = useState('');
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [returnItems, setReturnItems] = useState<{ item: SaleItem; qty: number; selected: boolean }[]>([]);
  const [form, setForm] = useState({ reason: '', refund_method: 'cash', restock: true });

  useEffect(() => { if (tenant && activeOutlet) fetchReturns(); }, [tenant, activeOutlet]);

  const fetchReturns = async () => {
    if (!tenant || !activeOutlet) return;
    const { data } = await supabase
      .from('pos_sale_returns' as any)
      .select('*, pos_sales(sale_number, customer_name)')
      .eq('tenant_id', tenant.id)
      .eq('outlet_id', activeOutlet.id)
      .order('created_at', { ascending: false });
    setReturns((data || []) as unknown as Return[]);
    setLoading(false);
  };

  const searchSale = async () => {
    if (!tenant || !saleSearch.trim()) return;
    const { data } = await supabase
      .from('pos_sales' as any)
      .select('*, pos_sale_items(*)')
      .eq('tenant_id', tenant.id)
      .ilike('sale_number', `%${saleSearch}%`)
      .eq('status', 'completed')
      .limit(1)
      .single();
    if (data) {
      const sale = data as unknown as Sale;
      setFoundSale(sale);
      setReturnItems(sale.pos_sale_items.map(item => ({ item, qty: item.qty, selected: false })));
      setDialogOpen(true);
    } else {
      toast.error('Transaksi tidak ditemukan');
    }
  };

  const totalRefund = returnItems.filter(ri => ri.selected).reduce((sum, ri) => sum + (ri.item.price * ri.qty), 0);

  const handleReturn = async () => {
    if (!tenant || !activeOutlet || !foundSale || !user) return;
    const selected = returnItems.filter(ri => ri.selected && ri.qty > 0);
    if (selected.length === 0) { toast.error('Pilih minimal 1 item untuk diretur'); return; }

    try {
      const returnNumber = `RTN-${Date.now()}`;
      const { data: ret, error } = await supabase.from('pos_sale_returns' as any).insert({
        tenant_id: tenant.id, sale_id: foundSale.id, outlet_id: activeOutlet.id,
        return_number: returnNumber, reason: form.reason || null,
        refund_method: form.refund_method, total_refund: totalRefund,
        restock: form.restock, created_by: user.id,
      }).select().single();
      if (error) throw error;

      await supabase.from('pos_sale_return_items' as any).insert(
        selected.map(ri => ({
          return_id: (ret as any).id, sale_item_id: ri.item.id, product_id: null,
          product_name: ri.item.product_name, qty: ri.qty, price: ri.item.price, subtotal: ri.item.price * ri.qty,
        }))
      );

      if (form.restock) {
        for (const ri of selected) {
          const { data: stockData } = await supabase.from('pos_stock' as any).select('id, quantity').eq('outlet_id', activeOutlet.id).limit(1).single();
          if (stockData) {
            await supabase.from('pos_stock' as any).update({ quantity: (stockData as any).quantity + ri.qty }).eq('id', (stockData as any).id);
          }
        }
      }

      toast.success(`Retur ${returnNumber} berhasil. Refund: ${formatCurrency(totalRefund)}`);
      setDialogOpen(false);
      setFoundSale(null);
      setSaleSearch('');
      fetchReturns();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <POSLayout title="Retur Penjualan" subtitle="Proses pengembalian barang dari pelanggan">
      <div className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3">Cari Transaksi untuk Diretur</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Cari nomor transaksi (misal: TRX-001)" value={saleSearch}
                  onChange={e => setSaleSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchSale()} />
              </div>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={searchSale}>Cari</Button>
            </div>
          </CardContent>
        </Card>

        <div>
          <h3 className="font-semibold text-sm mb-3">Riwayat Retur</h3>
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : returns.length === 0 ? (
            <div className="text-center py-10">
              <RotateCcw className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada retur penjualan</p>
            </div>
          ) : (
            <div className="space-y-2">
              {returns.map(r => (
                <Card key={r.id} className="border shadow-sm">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <RotateCcw className="h-4 w-4 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">{r.return_number}</span>
                        <Badge variant="outline" className="text-xs">{r.refund_method === 'cash' ? 'Tunai' : 'Kredit Toko'}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Dari: {(r.pos_sales as any)?.sale_number} • {r.reason || 'Tanpa keterangan'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm text-orange-600">-{formatCurrency(r.total_refund)}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'dd/MM HH:mm')}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Proses Retur — {foundSale?.sale_number}</DialogTitle>
          </DialogHeader>
          {foundSale && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p>Customer: <strong>{foundSale.customer_name || 'Umum'}</strong></p>
                <p>Total transaksi: <strong>{formatCurrency(foundSale.total)}</strong></p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Pilih Item yang Diretur</p>
                <div className="space-y-2">
                  {returnItems.map((ri, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${ri.selected ? 'border-emerald-400 bg-emerald-50' : 'border-border'}`}>
                      <input type="checkbox" checked={ri.selected} onChange={e => {
                        const newItems = [...returnItems];
                        newItems[i].selected = e.target.checked;
                        setReturnItems(newItems);
                      }} className="rounded" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ri.item.product_name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(ri.item.price)} / pcs</p>
                      </div>
                      {ri.selected && (
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => {
                            const newItems = [...returnItems];
                            if (newItems[i].qty > 1) newItems[i].qty--;
                            setReturnItems(newItems);
                          }}><Minus className="h-3 w-3" /></Button>
                          <span className="text-sm font-medium w-6 text-center">{ri.qty}</span>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => {
                            const newItems = [...returnItems];
                            if (newItems[i].qty < ri.item.qty) newItems[i].qty++;
                            setReturnItems(newItems);
                          }}><Plus className="h-3 w-3" /></Button>
                          <span className="text-xs text-muted-foreground">/ {ri.item.qty}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Alasan Retur</Label>
                <Textarea className="mt-1" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={2} placeholder="Contoh: Produk rusak, salah produk, dll" />
              </div>
              <div>
                <Label>Metode Refund</Label>
                <Select value={form.refund_method} onValueChange={v => setForm(p => ({ ...p, refund_method: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tunai</SelectItem>
                    <SelectItem value="store_credit">Kredit Toko</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Restock Barang</Label>
                  <p className="text-xs text-muted-foreground">Barang dikembalikan ke stok</p>
                </div>
                <Switch checked={form.restock} onCheckedChange={v => setForm(p => ({ ...p, restock: v }))} />
              </div>
              {totalRefund > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-orange-800">Total Refund: {formatCurrency(totalRefund)}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleReturn}>Proses Retur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
