import { useState } from 'react';
import {
  Layers, Plus, Edit2, Trash2, Eye, EyeOff, ShoppingBag,
  TrendingDown, Package, Save, Users, DollarSign, CheckCircle2
} from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface WholesaleTier {
  min_qty: number;
  price: number;
  discount_percent: number;
}

interface WholesaleProduct {
  id: string;
  product_id: string;
  merchant_id: string;
  min_order_qty: number;
  tiers: WholesaleTier[];
  notes: string | null;
  is_active: boolean;
  product_name?: string;
  product_price?: number;
  product_image?: string | null;
}

interface WholesaleOrder {
  id: string;
  buyer_id: string;
  merchant_id: string;
  status: string;
  total: number;
  items: any[];
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  buyer_name?: string;
}

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Menunggu',    color: 'bg-amber-100 text-amber-700' },
  confirmed:  { label: 'Dikonfirmasi', color: 'bg-blue-100 text-blue-700' },
  processing: { label: 'Diproses',    color: 'bg-indigo-100 text-indigo-700' },
  shipped:    { label: 'Dikirim',     color: 'bg-cyan-100 text-cyan-700' },
  completed:  { label: 'Selesai',     color: 'bg-emerald-100 text-emerald-700' },
  cancelled:  { label: 'Dibatalkan',  color: 'bg-red-100 text-red-700' },
};

export default function MerchantGrosirPage() {
  const { merchantId, loading: guardLoading } = useMerchantGuard();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('produk');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<WholesaleProduct> | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');

  // Ambil produk grosir / Fetch wholesale products
  const { data: wsProducts = [], isLoading: prodLoading } = useQuery<WholesaleProduct[]>({
    queryKey: ['merchant-wholesale-products', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesale_products')
        .select('*')
        .eq('merchant_id', merchantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const productIds = (data || []).map((w: any) => w.product_id).filter(Boolean);
      let productMap: Record<string, any> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name, price, image_url')
          .in('id', productIds);
        productMap = Object.fromEntries((products || []).map(p => [p.id, p]));
      }

      return (data || []).map((w: any) => ({
        ...w,
        product_name: productMap[w.product_id]?.name || 'Produk',
        product_price: productMap[w.product_id]?.price || 0,
        product_image: productMap[w.product_id]?.image_url || null,
      }));
    },
    enabled: !!merchantId && !guardLoading,
    staleTime: 30_000,
  });

  // Ambil pesanan grosir / Fetch wholesale orders
  const { data: wsOrders = [], isLoading: orderLoading } = useQuery<WholesaleOrder[]>({
    queryKey: ['merchant-wholesale-orders', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesale_orders')
        .select('*')
        .eq('merchant_id', merchantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const buyerIds = [...new Set((data || []).map((o: any) => o.buyer_id))];
      let nameMap: Record<string, string> = {};
      if (buyerIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', buyerIds);
        nameMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name || 'Pembeli']));
      }

      return (data || []).map((o: any) => ({ ...o, buyer_name: o.contact_name || nameMap[o.buyer_id] || 'Pembeli' }));
    },
    enabled: !!merchantId && !guardLoading && activeTab === 'pesanan',
    staleTime: 30_000,
  });

  // Ambil produk merchant untuk dipilih / Fetch merchant products for selection
  const { data: availableProducts = [] } = useQuery<{ id: string; name: string; price: number }[]>({
    queryKey: ['merchant-available-products', merchantId],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, price').eq('merchant_id', merchantId!).eq('is_active', true).order('name');
      return (data || []) as { id: string; name: string; price: number }[];
    },
    enabled: !!merchantId && dialogOpen,
  });

  // Simpan produk grosir / Save wholesale product
  const saveMutation = useMutation({
    mutationFn: async (wp: Partial<WholesaleProduct>) => {
      const payload = {
        merchant_id: merchantId,
        product_id: wp.product_id,
        min_order_qty: wp.min_order_qty || 10,
        tiers: wp.tiers || [],
        notes: wp.notes || null,
        is_active: wp.is_active ?? true,
      };
      if ((wp as any).id) {
        const { error } = await supabase.from('wholesale_products').update(payload).eq('id', (wp as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('wholesale_products').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Produk grosir disimpan');
      setDialogOpen(false);
      setEditingProduct(null);
      queryClient.invalidateQueries({ queryKey: ['merchant-wholesale-products'] });
    },
    onError: (e: any) => toast.error('Gagal: ' + e.message),
  });

  // Update status pesanan / Update order status
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('wholesale_orders').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status diperbarui');
      queryClient.invalidateQueries({ queryKey: ['merchant-wholesale-orders'] });
    },
  });

  const openCreate = () => {
    setEditingProduct({
      product_id: '',
      min_order_qty: 10,
      tiers: [
        { min_qty: 10, price: 0, discount_percent: 5 },
        { min_qty: 50, price: 0, discount_percent: 10 },
        { min_qty: 100, price: 0, discount_percent: 15 },
      ],
      notes: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const updateTier = (idx: number, field: keyof WholesaleTier, value: number) => {
    setEditingProduct(prev => {
      if (!prev) return prev;
      const tiers = [...(prev.tiers || [])];
      tiers[idx] = { ...tiers[idx], [field]: value };
      return { ...prev, tiers };
    });
  };

  if (guardLoading) {
    return (
      <MerchantLayout title="Grosir & B2B" subtitle="Atur harga grosir dan kelola pesanan bisnis">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Grosir & B2B" subtitle="Atur harga grosir bertingkat dan kelola pesanan bisnis skala besar">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="produk"><Package className="h-3.5 w-3.5 mr-1.5" />Produk Grosir</TabsTrigger>
          <TabsTrigger value="pesanan"><ShoppingBag className="h-3.5 w-3.5 mr-1.5" />Pesanan B2B</TabsTrigger>
        </TabsList>

        {/* ===== PRODUK GROSIR ===== */}
        <TabsContent value="produk">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              Atur harga bertingkat (tiered pricing) — semakin banyak beli, semakin murah harga per unit.
            </p>
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Tambah Produk Grosir</Button>
          </div>

          {prodLoading ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : wsProducts.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Layers className="h-14 w-14 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Belum ada produk grosir</p>
              <p className="text-sm mb-4">Daftarkan produk Anda untuk penjualan massal B2B</p>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Daftarkan Produk Grosir</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {wsProducts.map(wp => (
                <Card key={wp.id} className={!wp.is_active ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-muted shrink-0 overflow-hidden">
                        {wp.product_image
                          ? <img src={wp.product_image} alt="" className="w-full h-full object-cover" />
                          : <Package className="h-6 w-6 m-3 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">{wp.product_name}</p>
                          <Badge className={`text-xs border-0 ${wp.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                            {wp.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Min. pesanan: {wp.min_order_qty} unit</p>
                        <div className="flex flex-wrap gap-2">
                          {(wp.tiers || []).map((tier, i) => (
                            <div key={i} className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-1">
                              ≥{tier.min_qty} unit: <span className="font-semibold">{tier.discount_percent}% off</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                        onClick={() => { setEditingProduct(wp); setDialogOpen(true); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== PESANAN B2B ===== */}
        <TabsContent value="pesanan">
          {orderLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : wsOrders.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <ShoppingBag className="h-14 w-14 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Belum ada pesanan grosir</p>
              <p className="text-sm">Pesanan B2B dari pembeli akan muncul di sini</p>
            </div>
          ) : (
            <div className="space-y-3">
              {wsOrders.map(order => {
                const st = ORDER_STATUS[order.status] || ORDER_STATUS['pending'];
                return (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{order.buyer_name}</p>
                            <Badge className={`text-xs border-0 ${st.color}`}>{st.label}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{format(new Date(order.created_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}</span>
                            <span className="font-medium text-foreground">{formatPrice(order.total)}</span>
                            {order.contact_phone && <span>📱 {order.contact_phone}</span>}
                          </div>
                          {order.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{order.notes}"</p>}
                        </div>
                        {order.status === 'pending' && (
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-700"
                              onClick={() => updateOrderMutation.mutate({ id: order.id, status: 'confirmed' })}>
                              Konfirmasi
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600"
                              onClick={() => updateOrderMutation.mutate({ id: order.id, status: 'cancelled' })}>
                              Tolak
                            </Button>
                          </div>
                        )}
                        {order.status === 'confirmed' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                            onClick={() => updateOrderMutation.mutate({ id: order.id, status: 'processing' })}>
                            Proses
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Tambah/Edit Produk Grosir */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); setEditingProduct(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{(editingProduct as any)?.id ? 'Edit Produk Grosir' : 'Tambah Produk Grosir'}</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4 mt-2">
              {!(editingProduct as any).id && (
                <div className="space-y-1">
                  <Label className="text-sm">Pilih Produk *</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={editingProduct.product_id || ''}
                    onChange={e => setEditingProduct(p => ({ ...p, product_id: e.target.value }))}
                  >
                    <option value="">-- Pilih produk --</option>
                    {availableProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({formatPrice(p.price)})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-sm">Minimum Pesanan (unit) *</Label>
                <Input
                  type="number" min={1}
                  value={editingProduct.min_order_qty || ''}
                  onChange={e => setEditingProduct(p => ({ ...p, min_order_qty: Number(e.target.value) }))}
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">Harga Bertingkat (Tiered Pricing)</Label>
                <div className="space-y-2">
                  {(editingProduct.tiers || []).map((tier, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
                      <span className="text-xs text-muted-foreground w-4">#{i + 1}</span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground">Min. Qty</p>
                          <Input
                            type="number" min={1} className="h-7 text-xs"
                            value={tier.min_qty}
                            onChange={e => updateTier(i, 'min_qty', Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground">Diskon (%)</p>
                          <Input
                            type="number" min={0} max={90} className="h-7 text-xs"
                            value={tier.discount_percent}
                            onChange={e => updateTier(i, 'discount_percent', Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => setEditingProduct(p => ({ ...p, tiers: (p?.tiers || []).filter((_, j) => j !== i) }))}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="w-full text-xs"
                    onClick={() => setEditingProduct(p => ({
                      ...p,
                      tiers: [...(p?.tiers || []), { min_qty: 100, price: 0, discount_percent: 20 }]
                    }))}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Tier
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Catatan (opsional)</Label>
                <Textarea
                  placeholder="Ketentuan khusus, minimum pembelian, syarat pembayaran..."
                  value={editingProduct.notes || ''}
                  onChange={e => setEditingProduct(p => ({ ...p, notes: e.target.value }))}
                  rows={2} className="resize-none text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={editingProduct.is_active ?? true} onCheckedChange={v => setEditingProduct(p => ({ ...p, is_active: v }))} />
                <Label className="text-sm">Produk grosir aktif dan bisa dipesan</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingProduct(null); }}>Batal</Button>
            <Button
              onClick={() => saveMutation.mutate(editingProduct!)}
              disabled={(!editingProduct?.product_id && !(editingProduct as any)?.id) || saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" /> {saveMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
