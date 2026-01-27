import { useState, useEffect } from 'react';
import { Zap, Plus, Clock, Trash2, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';

interface FlashSale {
  id: string;
  product_id: string;
  product_name?: string;
  original_price: number;
  flash_price: number;
  stock_available: number;
  stock_sold: number;
  reason: string | null;
  start_time: string;
  end_time: string;
  status: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
}

interface FlashSaleManagerProps {
  merchantId: string;
}

const flashSaleReasons = [
  'Stok berlebih',
  'Mendekati expired',
  'Pesanan batal',
  'Promo spesial',
  'Cuci gudang',
];

export function FlashSaleManager({ merchantId }: FlashSaleManagerProps) {
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    product_id: '',
    flash_price: '',
    stock_available: '',
    reason: '',
    duration_hours: '2',
  });

  useEffect(() => {
    fetchData();
  }, [merchantId]);

  const fetchData = async () => {
    try {
      // Fetch flash sales from raw query due to new table not in types yet
      const { data: sales, error: salesError } = await supabase
        .rpc('get_flash_sales_for_merchant' as any, { p_merchant_id: merchantId })
        .select('*');

      // Alternative: direct query with type assertion
      const { data: salesData } = await supabase
        .from('flash_sales' as any)
        .select('*, products(name)')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      const mappedSales = ((salesData || []) as any[]).map(s => ({
        id: s.id,
        product_id: s.product_id,
        product_name: s.products?.name || 'Unknown',
        original_price: s.original_price,
        flash_price: s.flash_price,
        stock_available: s.stock_available,
        stock_sold: s.stock_sold,
        reason: s.reason,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status,
      })) as FlashSale[];
      setFlashSales(mappedSales);

      // Fetch products for dropdown
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, price, stock, image_url')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .gt('stock', 0);

      setProducts(prods || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.product_id || !form.flash_price || !form.stock_available) {
      toast.error('Lengkapi semua data');
      return;
    }

    const product = products.find(p => p.id === form.product_id);
    if (!product) return;

    const flashPrice = parseInt(form.flash_price);
    if (flashPrice >= product.price) {
      toast.error('Harga flash sale harus lebih rendah dari harga normal');
      return;
    }

    setSaving(true);

    try {
      const endTime = new Date();
      endTime.setHours(endTime.getHours() + parseInt(form.duration_hours));

      const { error } = await supabase.from('flash_sales' as any).insert({
        product_id: form.product_id,
        merchant_id: merchantId,
        original_price: product.price,
        flash_price: flashPrice,
        stock_available: parseInt(form.stock_available),
        reason: form.reason || null,
        end_time: endTime.toISOString(),
        status: 'ACTIVE',
      });

      if (error) throw error;

      toast.success('Flash sale berhasil dibuat!');
      setDialogOpen(false);
      setForm({
        product_id: '',
        flash_price: '',
        stock_available: '',
        reason: '',
        duration_hours: '2',
      });
      fetchData();
    } catch (error) {
      toast.error('Gagal membuat flash sale');
    } finally {
      setSaving(false);
    }
  };

  const handleEnd = async (id: string) => {
    try {
      const { error } = await supabase
        .from('flash_sales' as any)
        .update({ status: 'ENDED' })
        .eq('id', id);

      if (error) throw error;
      toast.success('Flash sale diakhiri');
      fetchData();
    } catch (error) {
      toast.error('Gagal mengakhiri flash sale');
    }
  };

  const selectedProduct = products.find(p => p.id === form.product_id);
  const discountPercent = selectedProduct && form.flash_price
    ? Math.round((1 - parseInt(form.flash_price) / selectedProduct.price) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          <h3 className="font-bold">Flash Sale</h3>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Buat Flash Sale
        </Button>
      </div>

      {/* Active Flash Sales */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : flashSales.length === 0 ? (
        <div className="text-center py-8 bg-muted/50 rounded-xl">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Belum ada flash sale aktif</p>
          <p className="text-sm text-muted-foreground">Buat flash sale untuk menjual produk dengan cepat</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flashSales.map((sale) => {
            const isActive = sale.status === 'ACTIVE' && new Date(sale.end_time) > new Date();
            const remaining = sale.stock_available - sale.stock_sold;

            return (
              <motion.div
                key={sale.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">{sale.product_name}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground line-through">
                        {formatPrice(sale.original_price)}
                      </span>
                      <span className="text-primary font-bold">
                        {formatPrice(sale.flash_price)}
                      </span>
                      <Badge variant="destructive">
                        -{Math.round((1 - sale.flash_price / sale.original_price) * 100)}%
                      </Badge>
                    </div>
                  </div>
                  <Badge className={isActive ? 'bg-green-100 text-green-700' : 'bg-muted'}>
                    {isActive ? 'Aktif' : sale.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {sale.stock_sold}/{sale.stock_available} terjual
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {isActive
                      ? `Berakhir ${new Date(sale.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Berakhir'}
                  </span>
                </div>

                {sale.reason && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Alasan: {sale.reason}
                  </p>
                )}

                {isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => handleEnd(sale.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Akhiri
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Buat Flash Sale
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pilih Produk *</Label>
              <Select
                value={form.product_id}
                onValueChange={(v) => setForm(prev => ({ ...prev, product_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih produk" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - {formatPrice(p.price)} (stok: {p.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProduct && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p>Harga normal: <span className="font-medium">{formatPrice(selectedProduct.price)}</span></p>
                <p>Stok tersedia: <span className="font-medium">{selectedProduct.stock}</span></p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Harga Flash Sale *</Label>
                <Input
                  type="number"
                  value={form.flash_price}
                  onChange={(e) => setForm(prev => ({ ...prev, flash_price: e.target.value }))}
                  placeholder="0"
                />
                {discountPercent > 0 && (
                  <p className="text-xs text-green-600">Diskon {discountPercent}%</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Jumlah Stok *</Label>
                <Input
                  type="number"
                  value={form.stock_available}
                  onChange={(e) => setForm(prev => ({ ...prev, stock_available: e.target.value }))}
                  placeholder="0"
                  max={selectedProduct?.stock}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Durasi</Label>
              <Select
                value={form.duration_hours}
                onValueChange={(v) => setForm(prev => ({ ...prev, duration_hours: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Jam</SelectItem>
                  <SelectItem value="2">2 Jam</SelectItem>
                  <SelectItem value="4">4 Jam</SelectItem>
                  <SelectItem value="6">6 Jam</SelectItem>
                  <SelectItem value="12">12 Jam</SelectItem>
                  <SelectItem value="24">24 Jam</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Alasan (opsional)</Label>
              <Select
                value={form.reason}
                onValueChange={(v) => setForm(prev => ({ ...prev, reason: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih alasan" />
                </SelectTrigger>
                <SelectContent>
                  {flashSaleReasons.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={saving}>
              {saving ? 'Membuat...' : 'Buat Flash Sale'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
