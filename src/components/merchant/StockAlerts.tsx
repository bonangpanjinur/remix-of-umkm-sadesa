import { useState, useEffect } from 'react';
import { AlertTriangle, Package, Plus, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  min_stock_alert: number;
  image_url: string | null;
}

interface StockAlertsProps {
  merchantId: string;
}

export function StockAlerts({ merchantId }: StockAlertsProps) {
  const [products, setProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchLowStockProducts();
  }, [merchantId]);

  const fetchLowStockProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock, min_stock_alert, image_url')
        .eq('merchant_id', merchantId)
        .eq('is_active', true);

      if (error) throw error;

      // Filter products where stock <= min_stock_alert
      const lowStock = (data || []).filter(p => p.stock <= (p.min_stock_alert || 5));
      setProducts(lowStock);
    } catch (error) {
      console.error('Error fetching low stock products:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStock = async (productId: string, newStock: number) => {
    if (newStock < 0) return;
    setUpdating(productId);

    try {
      const { error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);

      if (error) throw error;

      setProducts(prev => 
        prev.map(p => p.id === productId ? { ...p, stock: newStock } : p)
          .filter(p => p.stock <= (p.min_stock_alert || 5))
      );
      toast.success('Stok berhasil diperbarui');
    } catch (error) {
      toast.error('Gagal memperbarui stok');
    } finally {
      setUpdating(null);
    }
  };

  const quickRestock = async (productId: string, currentStock: number) => {
    const product = products.find(p => p.id === productId);
    const minAlert = product?.min_stock_alert || 5;
    const newStock = currentStock + (minAlert * 2); // Restock to 2x minimum
    await updateStock(productId, newStock);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Stok Menipis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Stok Aman
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Semua produk memiliki stok yang cukup.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-5 w-5" />
          Stok Menipis
          <Badge variant="destructive" className="ml-auto">
            {products.length} Produk
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {products.map((product) => (
          <div 
            key={product.id} 
            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
          >
            <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
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
              <p className="font-medium text-sm truncate">{product.name}</p>
              <p className="text-xs text-muted-foreground">
                Min: {product.min_stock_alert || 5} unit
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => updateStock(product.id, product.stock - 1)}
                disabled={updating === product.id || product.stock <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              
              <Input
                type="number"
                value={product.stock}
                onChange={(e) => updateStock(product.id, parseInt(e.target.value) || 0)}
                className="w-16 h-8 text-center"
                disabled={updating === product.id}
              />
              
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => updateStock(product.id, product.stock + 1)}
                disabled={updating === product.id}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              size="sm"
              variant="default"
              onClick={() => quickRestock(product.id, product.stock)}
              disabled={updating === product.id}
            >
              Restock
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
