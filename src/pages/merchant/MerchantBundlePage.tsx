import { useState } from 'react';
import {
  Package, Plus, Edit2, Trash2, Eye, EyeOff, Tag, Percent,
  ShoppingBag, Save, X, ChevronDown, ChevronUp, Search
} from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock: number;
}

interface BundleItem {
  product_id: string;
  quantity: number;
  product?: Product;
}

interface Bundle {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  original_price: number;
  bundle_price: number;
  discount_percent: number;
  is_active: boolean;
  stock_limit: number | null;
  valid_until: string | null;
  items: BundleItem[];
  created_at: string;
}

const emptyBundle = (): Partial<Bundle> => ({
  name: '',
  description: '',
  bundle_price: 0,
  original_price: 0,
  discount_percent: 0,
  is_active: true,
  stock_limit: null,
  valid_until: null,
  items: [],
});

export default function MerchantBundlePage() {
  const { merchantId, loading: guardLoading } = useMerchantGuard();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Partial<Bundle> | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Ambil semua bundle / Fetch all bundles
  const { data: bundles = [], isLoading } = useQuery<Bundle[]>({
    queryKey: ['merchant-bundles', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_bundles')
        .select('*')
        .eq('merchant_id', merchantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Enrich items dengan data produk / Enrich items with product data
      const enriched = await Promise.all((data || []).map(async (b: any) => {
        const items: BundleItem[] = b.items || [];
        const productIds = items.map(i => i.product_id).filter(Boolean);
        let products: Product[] = [];
        if (productIds.length > 0) {
          const { data: pData } = await supabase
            .from('products')
            .select('id, name, price, image_url, stock')
            .in('id', productIds);
          products = (pData || []) as Product[];
        }
        const productMap = Object.fromEntries(products.map(p => [p.id, p]));
        return {
          ...b,
          items: items.map(i => ({ ...i, product: productMap[i.product_id] })),
        };
      }));
      return enriched as Bundle[];
    },
    enabled: !!merchantId && !guardLoading,
    staleTime: 30_000,
  });

  // Ambil produk untuk pilihan / Fetch products for selection
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['merchant-products-for-bundle', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, stock')
        .eq('merchant_id', merchantId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as Product[];
    },
    enabled: !!merchantId && dialogOpen,
    staleTime: 60_000,
  });

  // Kalkulasi harga otomatis / Auto-calculate price
  const recalcPrice = (items: BundleItem[], allProducts: Product[]): { original: number; bundle: number; discount: number } => {
    const pMap = Object.fromEntries(allProducts.map(p => [p.id, p]));
    const original = items.reduce((sum, i) => {
      const p = pMap[i.product_id];
      return sum + (p ? p.price * i.quantity : 0);
    }, 0);
    const bundle = editingBundle?.bundle_price || Math.round(original * 0.85);
    const discount = original > 0 ? Math.round(((original - bundle) / original) * 100) : 0;
    return { original, bundle, discount };
  };

  // Simpan bundle / Save bundle
  const saveMutation = useMutation({
    mutationFn: async (b: Partial<Bundle>) => {
      const payload = {
        merchant_id: merchantId,
        name: b.name,
        description: b.description || null,
        bundle_price: b.bundle_price,
        original_price: b.original_price,
        discount_percent: b.discount_percent,
        is_active: b.is_active ?? true,
        stock_limit: b.stock_limit || null,
        valid_until: b.valid_until || null,
        items: (b.items || []).map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      };
      if ((b as any).id) {
        const { error } = await supabase.from('product_bundles').update(payload).eq('id', (b as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_bundles').insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Bundle berhasil disimpan');
      setDialogOpen(false);
      setEditingBundle(null);
      queryClient.invalidateQueries({ queryKey: ['merchant-bundles', merchantId] });
    },
    onError: (e: any) => toast.error('Gagal menyimpan bundle: ' + e.message),
  });

  // Toggle aktif / Toggle active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('product_bundles').update({ is_active: !is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['merchant-bundles', merchantId] }),
  });

  // Hapus bundle / Delete bundle
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_bundles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Bundle dihapus');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['merchant-bundles', merchantId] });
    },
  });

  const openCreate = () => {
    setEditingBundle(emptyBundle());
    setDialogOpen(true);
  };

  const openEdit = (b: Bundle) => {
    setEditingBundle({ ...b });
    setDialogOpen(true);
  };

  const addProductToBundle = (product: Product) => {
    setEditingBundle(prev => {
      if (!prev) return prev;
      const items = prev.items || [];
      const existing = items.find(i => i.product_id === product.id);
      let newItems: BundleItem[];
      if (existing) {
        newItems = items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      } else {
        newItems = [...items, { product_id: product.id, quantity: 1, product }];
      }
      const { original, bundle, discount } = recalcPrice(newItems, products);
      return { ...prev, items: newItems, original_price: original, bundle_price: bundle, discount_percent: discount };
    });
  };

  const removeProductFromBundle = (productId: string) => {
    setEditingBundle(prev => {
      if (!prev) return prev;
      const newItems = (prev.items || []).filter(i => i.product_id !== productId);
      const { original, bundle, discount } = recalcPrice(newItems, products);
      return { ...prev, items: newItems, original_price: original, bundle_price: bundle, discount_percent: discount };
    });
  };

  const updateBundlePrice = (price: number) => {
    setEditingBundle(prev => {
      if (!prev) return prev;
      const original = prev.original_price || 0;
      const discount = original > 0 ? Math.round(((original - price) / original) * 100) : 0;
      return { ...prev, bundle_price: price, discount_percent: Math.max(0, discount) };
    });
  };

  const filteredProducts = products.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  if (guardLoading) {
    return (
      <MerchantLayout title="Bundle Produk" subtitle="Buat paket produk dengan harga spesial">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Bundle Produk" subtitle="Buat paket produk dengan harga spesial untuk meningkatkan penjualan">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">
            Buat paket 2-5 produk dengan harga lebih hemat. Bundle terbukti meningkatkan average order value hingga 40%.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Buat Bundle
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Bundle', value: bundles.length, color: 'text-blue-600' },
          { label: 'Bundle Aktif', value: bundles.filter(b => b.is_active).length, color: 'text-emerald-600' },
          { label: 'Rata-rata Diskon', value: bundles.length > 0 ? Math.round(bundles.reduce((s, b) => s + b.discount_percent, 0) / bundles.length) + '%' : '0%', color: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label} className="text-center">
            <CardContent className="p-3">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daftar Bundle / Bundle List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : bundles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-16 w-16 mx-auto mb-3 opacity-20" />
          <h3 className="font-semibold text-base text-foreground mb-1">Belum ada bundle produk</h3>
          <p className="text-sm mb-4">Buat paket hemat untuk menarik lebih banyak pembeli</p>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Buat Bundle Pertama</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bundles.map(bundle => (
            <Card key={bundle.id} className={`overflow-hidden transition-all ${!bundle.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm truncate">{bundle.name}</h3>
                      {bundle.discount_percent > 0 && (
                        <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                          -{bundle.discount_percent}%
                        </Badge>
                      )}
                      <Badge className={`text-xs border-0 ${bundle.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {bundle.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                    {bundle.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{bundle.description}</p>
                    )}
                  </div>
                </div>

                {/* Produk dalam bundle / Products in bundle */}
                <div className="space-y-1 mb-3">
                  {(bundle.items || []).slice(0, 3).map(item => (
                    <div key={item.product_id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-5 h-5 rounded bg-muted shrink-0 overflow-hidden">
                        {item.product?.image_url ? (
                          <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                        ) : <Package className="h-3 w-3 m-1" />}
                      </div>
                      <span className="truncate">{item.product?.name || 'Produk'}</span>
                      <span className="shrink-0">×{item.quantity}</span>
                    </div>
                  ))}
                  {bundle.items.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{bundle.items.length - 3} produk lagi</p>
                  )}
                </div>

                <Separator className="mb-3" />

                <div className="flex items-end justify-between">
                  <div>
                    {bundle.original_price > 0 && (
                      <p className="text-xs line-through text-muted-foreground">{formatPrice(bundle.original_price)}</p>
                    )}
                    <p className="text-base font-bold text-primary">{formatPrice(bundle.bundle_price)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => toggleMutation.mutate({ id: bundle.id, is_active: bundle.is_active })}>
                      {bundle.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(bundle)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => setDeleteId(bundle.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Buat/Edit Bundle */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); setEditingBundle(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{(editingBundle as any)?.id ? 'Edit Bundle' : 'Buat Bundle Baru'}</DialogTitle>
          </DialogHeader>

          {editingBundle && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-sm">Nama Bundle *</Label>
                  <Input
                    placeholder="Contoh: Paket Sarapan Hemat"
                    value={editingBundle.name || ''}
                    onChange={e => setEditingBundle(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-sm">Deskripsi</Label>
                  <Textarea
                    placeholder="Deskripsikan keuntungan bundle ini..."
                    value={editingBundle.description || ''}
                    onChange={e => setEditingBundle(p => ({ ...p, description: e.target.value }))}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>

              <Separator />

              {/* Pilih produk / Select products */}
              <div>
                <Label className="text-sm mb-2 block">Produk dalam Bundle *</Label>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari produk..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="border rounded-lg max-h-36 overflow-y-auto divide-y">
                  {filteredProducts.slice(0, 20).map(p => {
                    const inBundle = (editingBundle.items || []).find(i => i.product_id === p.id);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 ${inBundle ? 'bg-primary/5' : ''}`}
                        onClick={() => addProductToBundle(p)}
                      >
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="text-muted-foreground ml-2">{formatPrice(p.price)}</span>
                        {inBundle && <Badge className="ml-2 text-[10px] bg-primary text-primary-foreground border-0">×{inBundle.quantity}</Badge>}
                      </div>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <p className="text-center py-4 text-muted-foreground text-xs">Tidak ada produk ditemukan</p>
                  )}
                </div>

                {/* Produk yang dipilih / Selected products */}
                {(editingBundle.items || []).length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Produk dipilih:</p>
                    {(editingBundle.items || []).map(item => (
                      <div key={item.product_id} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 truncate">{item.product?.name || item.product_id.slice(0, 8)}</span>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-5 w-5 text-xs"
                            onClick={() => setEditingBundle(prev => {
                              if (!prev) return prev;
                              const newItems = (prev.items || []).map(i =>
                                i.product_id === item.product_id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i
                              );
                              const { original, bundle, discount } = recalcPrice(newItems, products);
                              return { ...prev, items: newItems, original_price: original, bundle_price: bundle, discount_percent: discount };
                            })}>-</Button>
                          <span className="w-6 text-center">{item.quantity}</span>
                          <Button size="icon" variant="outline" className="h-5 w-5 text-xs"
                            onClick={() => addProductToBundle(item.product || { id: item.product_id, name: '', price: 0, image_url: null, stock: 0 })}>+</Button>
                          <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive"
                            onClick={() => removeProductFromBundle(item.product_id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Harga / Pricing */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Harga Normal (auto)</Label>
                  <Input
                    value={formatPrice(editingBundle.original_price || 0)}
                    disabled
                    className="bg-muted text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Harga Bundle *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editingBundle.bundle_price || ''}
                    onChange={e => updateBundlePrice(Number(e.target.value))}
                    className="text-xs"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Diskon (%)</Label>
                  <Input
                    value={`${editingBundle.discount_percent || 0}%`}
                    disabled
                    className="bg-muted text-xs text-emerald-700 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Batas Stok Bundle (opsional)</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Kosongkan = tidak terbatas"
                    value={editingBundle.stock_limit || ''}
                    onChange={e => setEditingBundle(p => ({ ...p, stock_limit: Number(e.target.value) || null }))}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Berlaku Hingga (opsional)</Label>
                  <Input
                    type="date"
                    value={editingBundle.valid_until || ''}
                    onChange={e => setEditingBundle(p => ({ ...p, valid_until: e.target.value || null }))}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingBundle.is_active ?? true}
                  onCheckedChange={v => setEditingBundle(p => ({ ...p, is_active: v }))}
                />
                <Label className="text-sm">Tampilkan bundle di toko</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingBundle(null); }}>Batal</Button>
            <Button
              onClick={() => saveMutation.mutate(editingBundle!)}
              disabled={
                !editingBundle?.name || !editingBundle?.bundle_price ||
                (editingBundle?.items || []).length < 2 || saveMutation.isPending
              }
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Bundle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Hapus / Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteId(null)}>
          <Card className="m-4 max-w-sm" onClick={e => e.stopPropagation()}>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-2">Hapus Bundle?</h3>
              <p className="text-sm text-muted-foreground mb-4">Bundle ini akan dihapus permanen. Tindakan tidak dapat dibatalkan.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Batal</Button>
                <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(deleteId!)}>Hapus</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </MerchantLayout>
  );
}
