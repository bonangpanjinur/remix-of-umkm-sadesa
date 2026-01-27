import { useState, useEffect } from 'react';
import { Percent, Calendar, Package, Edit, Trash2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  discount_percent: number;
  discount_end_date: string | null;
  is_promo: boolean;
}

interface PromoManagerProps {
  merchantId: string;
}

export function PromoManager({ merchantId }: PromoManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [discountEndDate, setDiscountEndDate] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [merchantId]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, discount_percent, discount_end_date, is_promo')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .order('is_promo', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const promoProducts = products.filter(p => p.is_promo && p.discount_percent > 0);
  const regularProducts = products.filter(p => !p.is_promo || p.discount_percent === 0);

  const savePromo = async () => {
    if (!selectedProduct || discountPercent <= 0 || discountPercent > 90) {
      toast.error('Pastikan diskon antara 1-90%');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          discount_percent: discountPercent,
          discount_end_date: discountEndDate || null,
          is_promo: true,
        })
        .eq('id', selectedProduct);

      if (error) throw error;

      toast.success('Promo berhasil disimpan');
      setShowDialog(false);
      setSelectedProduct('');
      setDiscountPercent(10);
      setDiscountEndDate('');
      fetchProducts();
    } catch (error) {
      toast.error('Gagal menyimpan promo');
    } finally {
      setSaving(false);
    }
  };

  const removePromo = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          discount_percent: 0,
          discount_end_date: null,
          is_promo: false,
        })
        .eq('id', productId);

      if (error) throw error;

      toast.success('Promo dihapus');
      fetchProducts();
    } catch (error) {
      toast.error('Gagal menghapus promo');
    }
  };

  const calculateDiscountedPrice = (price: number, discount: number) => {
    return price - (price * discount / 100);
  };

  const isExpired = (endDate: string | null) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Promo & Diskon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Promo & Diskon
          </CardTitle>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Buat Promo
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Active Promos */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Promo Aktif ({promoProducts.length})
            </h4>
            
            {promoProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Belum ada promo aktif
              </p>
            ) : (
              <div className="space-y-3">
                {promoProducts.map((product) => {
                  const expired = isExpired(product.discount_end_date);
                  
                  return (
                    <div 
                      key={product.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        expired ? 'border-destructive/30 bg-destructive/5' : 'border-green-500/30 bg-green-500/5'
                      }`}
                    >
                      <div className="w-12 h-12 rounded bg-muted overflow-hidden flex-shrink-0">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm line-through text-muted-foreground">
                            {formatPrice(product.price)}
                          </span>
                          <span className="text-sm font-bold text-green-600">
                            {formatPrice(calculateDiscountedPrice(product.price, product.discount_percent))}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge 
                          variant={expired ? 'destructive' : 'default'}
                          className={!expired ? 'bg-green-500' : ''}
                        >
                          {product.discount_percent}% OFF
                        </Badge>
                        {product.discount_end_date && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {expired ? 'Expired' : format(new Date(product.discount_end_date), 'dd MMM', { locale: id })}
                          </p>
                        )}
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removePromo(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Promo Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Promo Baru</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pilih Produk</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih produk..." />
                </SelectTrigger>
                <SelectContent>
                  {regularProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center gap-2">
                        <span>{product.name}</span>
                        <span className="text-muted-foreground">
                          - {formatPrice(product.price)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Diskon (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 0)}
                  className="w-24"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Maksimal 90%
              </p>
            </div>

            <div className="space-y-2">
              <Label>Berakhir Pada (Opsional)</Label>
              <Input
                type="date"
                value={discountEndDate}
                onChange={(e) => setDiscountEndDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
              <p className="text-xs text-muted-foreground">
                Kosongkan jika promo tidak memiliki batas waktu
              </p>
            </div>

            {selectedProduct && discountPercent > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Preview:</p>
                {(() => {
                  const product = products.find(p => p.id === selectedProduct);
                  if (!product) return null;
                  return (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="line-through text-muted-foreground">
                        {formatPrice(product.price)}
                      </span>
                      <span className="font-bold text-green-600">
                        {formatPrice(calculateDiscountedPrice(product.price, discountPercent))}
                      </span>
                      <Badge className="bg-green-500">{discountPercent}% OFF</Badge>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Batal
            </Button>
            <Button onClick={savePromo} disabled={saving || !selectedProduct}>
              Simpan Promo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
