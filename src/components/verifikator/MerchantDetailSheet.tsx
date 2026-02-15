import { useState, useEffect } from 'react';
import { Store, Package, Receipt, CreditCard, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';

interface MerchantDetailSheetProps {
  merchantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MerchantDetail {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  district: string | null;
  business_category: string | null;
  registration_status: string;
  is_open: boolean;
  created_at: string;
}

interface KasRecord {
  id: string;
  amount: number;
  payment_month: number;
  payment_year: number;
  status: string;
  payment_date: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function MerchantDetailSheet({ merchantId, open, onOpenChange }: MerchantDetailSheetProps) {
  const [merchant, setMerchant] = useState<MerchantDetail | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number; stock: number }>>([]);
  const [orderStats, setOrderStats] = useState({ total: 0, revenue: 0 });
  const [kasHistory, setKasHistory] = useState<KasRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (merchantId && open) fetchAll(merchantId);
  }, [merchantId, open]);

  const fetchAll = async (id: string) => {
    setLoading(true);
    try {
      const [{ data: mData }, { data: pData }, { data: oData }, { data: kData }] = await Promise.all([
        supabase.from('merchants').select('id, name, phone, city, district, business_category, registration_status, is_open, created_at').eq('id', id).maybeSingle(),
        supabase.from('products').select('id, name, price, stock').eq('merchant_id', id).order('name').limit(20),
        supabase.from('orders').select('total, status').eq('merchant_id', id).in('status', ['DONE', 'DELIVERED']),
        supabase.from('kas_payments').select('id, amount, payment_month, payment_year, status, payment_date').eq('merchant_id', id).order('payment_year', { ascending: false }).order('payment_month', { ascending: false }).limit(12),
      ]);

      setMerchant(mData);
      setProducts(pData || []);
      setOrderStats({
        total: oData?.length || 0,
        revenue: oData?.reduce((s, o) => s + o.total, 0) || 0,
      });
      setKasHistory(kData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Merchant</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : merchant ? (
          <div className="space-y-4">
            {/* Info */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{merchant.name}</h3>
                <p className="text-sm text-muted-foreground">{merchant.business_category || '-'}</p>
                <p className="text-xs text-muted-foreground">{merchant.district}, {merchant.city}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant={merchant.registration_status === 'APPROVED' ? 'default' : 'outline'}>
                    {merchant.registration_status}
                  </Badge>
                  <Badge variant={merchant.is_open ? 'default' : 'secondary'}>
                    {merchant.is_open ? 'Buka' : 'Tutup'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted rounded-lg p-3 text-center">
                <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{products.length}</p>
                <p className="text-xs text-muted-foreground">Produk</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <Receipt className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{orderStats.total}</p>
                <p className="text-xs text-muted-foreground">Pesanan</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <CreditCard className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{formatPrice(orderStats.revenue)}</p>
                <p className="text-xs text-muted-foreground">Omzet</p>
              </div>
            </div>

            <Separator />

            <Tabs defaultValue="products">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="products">Produk</TabsTrigger>
                <TabsTrigger value="kas">Riwayat Iuran</TabsTrigger>
              </TabsList>

              <TabsContent value="products" className="mt-3">
                {products.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">Belum ada produk</p>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {products.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">Stok: {p.stock}</p>
                        </div>
                        <p className="text-sm font-medium text-primary">{formatPrice(p.price)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="kas" className="mt-3">
                {kasHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">Belum ada data iuran</p>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {kasHistory.map(k => (
                      <div key={k.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{MONTHS[k.payment_month - 1]} {k.payment_year}</p>
                          {k.payment_date && (
                            <p className="text-xs text-muted-foreground">
                              Bayar: {new Date(k.payment_date).toLocaleDateString('id-ID')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{formatPrice(k.amount)}</span>
                          <Badge variant={k.status === 'PAID' ? 'default' : 'destructive'} className="text-[10px]">
                            {k.status === 'PAID' ? 'Lunas' : 'Belum'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Merchant tidak ditemukan</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
