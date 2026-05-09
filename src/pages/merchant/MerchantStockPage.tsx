import { useState } from 'react';
import { Package, AlertTriangle, History, Download, Plus, Minus, Edit2, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Product {
  id: string;
  name: string;
  stock: number;
  low_stock_threshold: number;
  min_stock_alert: number;
  image_url: string | null;
  is_active: boolean;
}

interface StockHistoryItem {
  id: string;
  product_id: string;
  type: string;
  qty_change: number;
  stock_before: number;
  stock_after: number;
  note: string | null;
  created_at: string;
  product_name?: string;
}

export default function MerchantStockPage() {
  const { merchantId, merchantName, loading: guardLoading } = useMerchantGuard();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [adjustDialog, setAdjustDialog] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'set'>('in');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [thresholdDialog, setThresholdDialog] = useState<Product | null>(null);
  const [thresholdValue, setThresholdValue] = useState('');

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['merchant-stock-products', merchantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, stock, low_stock_threshold, min_stock_alert, image_url, is_active')
        .eq('merchant_id', merchantId!)
        .order('name');
      return (data || []) as Product[];
    },
    enabled: !!merchantId && !guardLoading,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<StockHistoryItem[]>({
    queryKey: ['merchant-stock-history', merchantId],
    queryFn: async () => {
      const { data: histData } = await supabase
        .from('stock_history')
        .select('id, product_id, type, qty_change, stock_before, stock_after, note, created_at')
        .eq('merchant_id', merchantId!)
        .order('created_at', { ascending: false })
        .limit(100);

      const productIds = [...new Set((histData || []).map(h => h.product_id))];
      if (productIds.length > 0) {
        const { data: prods } = await supabase.from('products').select('id, name').in('id', productIds);
        const prodMap = Object.fromEntries((prods || []).map(p => [p.id, p.name]));
        return (histData || []).map(h => ({ ...h, product_name: prodMap[h.product_id] || 'Produk' })) as StockHistoryItem[];
      }
      return (histData || []) as StockHistoryItem[];
    },
    enabled: !!merchantId && !guardLoading,
  });

  const lowStockProducts = products.filter(p => {
    const threshold = p.low_stock_threshold || p.min_stock_alert || 5;
    return p.stock <= threshold && p.is_active;
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!adjustDialog || !merchantId || !user) throw new Error('Data tidak valid');
      const qty = parseInt(adjustQty);
      if (isNaN(qty) || qty < 0) throw new Error('Jumlah tidak valid');

      let stockBefore = adjustDialog.stock;
      let stockAfter: number;
      let qtyChange: number;
      let note = adjustNote.trim() || null;

      if (adjustType === 'in') {
        qtyChange = qty;
        stockAfter = stockBefore + qty;
      } else if (adjustType === 'out') {
        qtyChange = -qty;
        stockAfter = Math.max(0, stockBefore - qty);
      } else {
        qtyChange = qty - stockBefore;
        stockAfter = qty;
      }

      const { error: updateErr } = await supabase
        .from('products')
        .update({ stock: stockAfter })
        .eq('id', adjustDialog.id);
      if (updateErr) throw updateErr;

      await supabase.from('stock_history').insert({
        product_id: adjustDialog.id,
        merchant_id: merchantId,
        type: adjustType === 'in' ? 'masuk' : adjustType === 'out' ? 'keluar' : 'penyesuaian',
        qty_change: qtyChange,
        stock_before: stockBefore,
        stock_after: stockAfter,
        note,
        created_by: user.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-stock-products', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant-stock-history', merchantId] });
      toast.success('Stok berhasil diperbarui');
      setAdjustDialog(null);
      setAdjustQty('');
      setAdjustNote('');
    },
    onError: (err: any) => toast.error(err.message || 'Gagal memperbarui stok'),
  });

  const thresholdMutation = useMutation({
    mutationFn: async () => {
      if (!thresholdDialog) return;
      const val = parseInt(thresholdValue);
      if (isNaN(val) || val < 0) throw new Error('Nilai tidak valid');
      const { error } = await supabase
        .from('products')
        .update({ low_stock_threshold: val, min_stock_alert: val })
        .eq('id', thresholdDialog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-stock-products', merchantId] });
      toast.success('Ambang batas stok disimpan');
      setThresholdDialog(null);
      setThresholdValue('');
    },
    onError: () => toast.error('Gagal menyimpan ambang batas'),
  });

  const handleExportCSV = () => {
    const headers = ['Produk', 'Stok Saat Ini', 'Ambang Batas', 'Status'];
    const rows = products.map(p => {
      const threshold = p.low_stock_threshold || p.min_stock_alert || 5;
      const status = p.stock <= threshold ? 'Menipis' : 'Aman';
      return [p.name, p.stock, threshold, status];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-stok-${merchantName || 'toko'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (guardLoading) {
    return (
      <MerchantLayout title="Manajemen Stok" subtitle="Kelola dan pantau stok produk Anda">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout
      title="Manajemen Stok"
      subtitle="Pantau, sesuaikan, dan ekspor laporan stok produk"
      actions={
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      }
    >
      <div className="space-y-6 max-w-4xl">
        {/* Low stock alert banner */}
        {lowStockProducts.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">
                  {lowStockProducts.length} produk stok menipis!
                </p>
                <p className="text-sm text-orange-600 mt-0.5">
                  {lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}
                  {lowStockProducts.length > 3 && `, +${lowStockProducts.length - 3} lainnya`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Semua Produk
              {lowStockProducts.length > 0 && (
                <Badge variant="destructive" className="ml-1">{lowStockProducts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Riwayat
            </TabsTrigger>
          </TabsList>

          {/* Products tab */}
          <TabsContent value="products" className="mt-4">
            {productsLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {products.map(product => {
                  const threshold = product.low_stock_threshold || product.min_stock_alert || 5;
                  const isLow = product.stock <= threshold;
                  return (
                    <Card key={product.id} className={isLow ? 'border-orange-200' : ''}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{product.name}</p>
                            {isLow && (
                              <Badge variant="destructive" className="text-xs flex-shrink-0">Menipis</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`text-sm font-bold ${isLow ? 'text-orange-600' : 'text-foreground'}`}>
                              {product.stock} unit
                            </span>
                            <button
                              onClick={() => { setThresholdDialog(product); setThresholdValue(String(threshold)); }}
                              className="text-xs text-muted-foreground hover:text-primary transition-colors"
                            >
                              Batas: {threshold} unit
                            </button>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isLow ? 'default' : 'outline'}
                          onClick={() => { setAdjustDialog(product); setAdjustType('in'); setAdjustQty(''); setAdjustNote(''); }}
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Atur
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
                {products.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Belum ada produk</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* History tab */}
          <TabsContent value="history" className="mt-4">
            {historyLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Belum ada riwayat pergerakan stok</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(item => (
                  <Card key={item.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.qty_change > 0 ? 'bg-emerald-100' : item.qty_change < 0 ? 'bg-red-100' : 'bg-gray-100'
                      }`}>
                        {item.qty_change > 0 ? (
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                        ) : item.qty_change < 0 ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <RefreshCw className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{item.product_name}</p>
                          <span className={`text-sm font-bold flex-shrink-0 ${
                            item.qty_change > 0 ? 'text-emerald-600' : 'text-red-500'
                          }`}>
                            {item.qty_change > 0 ? '+' : ''}{item.qty_change}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-xs capitalize">{item.type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {item.stock_before} → {item.stock_after}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(item.created_at), 'dd MMM HH:mm', { locale: idLocale })}
                          </span>
                        </div>
                        {item.note && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.note}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Adjust stock dialog */}
      <Dialog open={!!adjustDialog} onOpenChange={() => setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sesuaikan Stok — {adjustDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground">Stok saat ini</p>
              <p className="text-3xl font-bold">{adjustDialog?.stock}</p>
            </div>

            <div className="space-y-2">
              <Label>Jenis Perubahan</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">+ Stok Masuk (restok)</SelectItem>
                  <SelectItem value="out">- Stok Keluar (rusak/hilang)</SelectItem>
                  <SelectItem value="set">= Set Stok Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {adjustType === 'set' ? 'Stok Baru' : 'Jumlah'}
              </Label>
              <Input
                type="number"
                min={0}
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                placeholder="Masukkan jumlah..."
              />
              {adjustQty && !isNaN(parseInt(adjustQty)) && (
                <p className="text-xs text-muted-foreground">
                  Stok setelah:{' '}
                  <span className="font-medium">
                    {adjustType === 'in'
                      ? (adjustDialog?.stock || 0) + parseInt(adjustQty)
                      : adjustType === 'out'
                      ? Math.max(0, (adjustDialog?.stock || 0) - parseInt(adjustQty))
                      : parseInt(adjustQty)}{' '}
                    unit
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Textarea
                value={adjustNote}
                onChange={e => setAdjustNote(e.target.value)}
                placeholder="Contoh: Restok dari supplier, produk rusak saat pengiriman..."
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAdjustDialog(null)}>Batal</Button>
              <Button
                className="flex-1"
                onClick={() => adjustMutation.mutate()}
                disabled={adjustMutation.isPending || !adjustQty}
              >
                Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Threshold dialog */}
      <Dialog open={!!thresholdDialog} onOpenChange={() => setThresholdDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ambang Batas Stok — {thresholdDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Anda akan mendapat peringatan ketika stok produk ini mencapai atau di bawah ambang batas yang ditentukan.
            </p>
            <div className="space-y-2">
              <Label>Ambang Batas (unit)</Label>
              <Input
                type="number"
                min={0}
                value={thresholdValue}
                onChange={e => setThresholdValue(e.target.value)}
                placeholder="Contoh: 5"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setThresholdDialog(null)}>Batal</Button>
              <Button
                className="flex-1"
                onClick={() => thresholdMutation.mutate()}
                disabled={thresholdMutation.isPending}
              >
                Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
