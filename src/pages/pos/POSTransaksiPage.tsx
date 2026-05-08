import { useState, useEffect } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Receipt, Eye, Download, Calendar, CreditCard, Banknote, QrCode, Printer } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Sale {
  id: string;
  sale_number: string;
  cashier_name: string | null;
  customer_name: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  payment_method: string;
  payment_amount: number;
  change_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  pos_sale_items?: SaleItem[];
}

interface SaleItem {
  id: string;
  product_name: string;
  variant_name: string | null;
  qty: number;
  price: number;
  discount: number;
  subtotal: number;
}

const paymentIcon = (method: string) => {
  if (method === 'cash') return <Banknote className="h-3.5 w-3.5" />;
  if (method === 'qris') return <QrCode className="h-3.5 w-3.5" />;
  return <CreditCard className="h-3.5 w-3.5" />;
};

const paymentLabel: Record<string, string> = {
  cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer',
  debit: 'Debit', credit: 'Kredit', split: 'Split',
};

export default function POSTransaksiPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [selected, setSelected] = useState<Sale | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (tenant && activeOutlet) fetchSales();
  }, [tenant, activeOutlet, dateFilter]);

  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday': return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
      case 'week': return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      default: return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const fetchSales = async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    const { start, end } = getDateRange();
    const { data } = await supabase
      .from('pos_sales' as any)
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('outlet_id', activeOutlet.id)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });
    setSales((data || []) as unknown as Sale[]);
    setLoading(false);
  };

  const openDetail = async (sale: Sale) => {
    const { data } = await supabase
      .from('pos_sale_items' as any)
      .select('*')
      .eq('sale_id', sale.id);
    setSelected({ ...sale, pos_sale_items: (data || []) as unknown as SaleItem[] });
    setDetailOpen(true);
  };

  const filtered = sales.filter(s =>
    s.sale_number.toLowerCase().includes(search.toLowerCase()) ||
    (s.customer_name && s.customer_name.toLowerCase().includes(search.toLowerCase()))
  );

  const totalOmzet = filtered.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.total, 0);
  const totalTrx = filtered.filter(s => s.status === 'completed').length;

  const exportCSV = () => {
    const rows = [['No Transaksi', 'Waktu', 'Customer', 'Kasir', 'Subtotal', 'Diskon', 'Pajak', 'Total', 'Bayar', 'Kembalian', 'Metode', 'Status']];
    filtered.forEach(s => rows.push([s.sale_number, format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'), s.customer_name || '-', s.cashier_name || '-', String(s.subtotal), String(s.discount_amount), String(s.tax_amount), String(s.total), String(s.payment_amount), String(s.change_amount), paymentLabel[s.payment_method] || s.payment_method, s.status]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `transaksi-${dateFilter}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <POSLayout title="Riwayat Transaksi" subtitle={`${activeOutlet?.name || ''}`}
      actions={<Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>}>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-4">
              <p className="text-emerald-100 text-xs">Omzet Periode</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalOmzet)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">Jumlah Transaksi</p>
              <p className="text-xl font-bold mt-1">{totalTrx}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari no transaksi / customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-40">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="yesterday">Kemarin</SelectItem>
              <SelectItem value="week">7 Hari Terakhir</SelectItem>
              <SelectItem value="month">Bulan Ini</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold">Belum Ada Transaksi</p>
            <p className="text-sm text-muted-foreground">Tidak ada transaksi pada periode yang dipilih.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => (
              <Card key={s.id} className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(s)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.status === 'void' ? 'bg-red-100' : 'bg-emerald-100'}`}>
                    <Receipt className={`h-4 w-4 ${s.status === 'void' ? 'text-red-600' : 'text-emerald-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{s.sale_number}</span>
                      {s.status === 'void' && <Badge variant="destructive" className="text-xs">Void</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{format(new Date(s.created_at), 'HH:mm', { locale: idLocale })}</span>
                      {s.customer_name && <span>• {s.customer_name}</span>}
                      {s.cashier_name && <span>• {s.cashier_name}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm">{formatCurrency(s.total)}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5 text-xs text-muted-foreground">
                      {paymentIcon(s.payment_method)}
                      <span>{paymentLabel[s.payment_method] || s.payment_method}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={e => { e.stopPropagation(); openDetail(s); }}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Transaksi — {selected?.sale_number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waktu</span>
                  <span>{format(new Date(selected.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}</span>
                </div>
                {selected.customer_name && <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{selected.customer_name}</span></div>}
                {selected.cashier_name && <div className="flex justify-between"><span className="text-muted-foreground">Kasir</span><span>{selected.cashier_name}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Metode</span><span>{paymentLabel[selected.payment_method]}</span></div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Item</p>
                <div className="space-y-1.5">
                  {(selected.pos_sale_items || []).map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="flex-1 min-w-0 truncate">
                        {item.product_name}{item.variant_name ? ` (${item.variant_name})` : ''} x{item.qty}
                        {item.discount > 0 && <span className="text-xs text-muted-foreground ml-1">-{formatCurrency(item.discount)}</span>}
                      </span>
                      <span className="font-medium ml-3">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(selected.subtotal)}</span></div>
                {selected.discount_amount > 0 && <div className="flex justify-between text-red-600"><span>Diskon</span><span>-{formatCurrency(selected.discount_amount)}</span></div>}
                {selected.tax_amount > 0 && <div className="flex justify-between text-muted-foreground"><span>Pajak</span><span>{formatCurrency(selected.tax_amount)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>{formatCurrency(selected.total)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Bayar</span><span>{formatCurrency(selected.payment_amount)}</span></div>
                {selected.change_amount > 0 && <div className="flex justify-between text-muted-foreground"><span>Kembalian</span><span>{formatCurrency(selected.change_amount)}</span></div>}
              </div>

              <Button variant="outline" className="w-full" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />Cetak Ulang Struk
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
