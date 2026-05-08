import { useState, useEffect } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Package, AlertTriangle, X, Download } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  brand_id: string | null;
  unit: string;
  price: number;
  cost_price: number;
  tax_rate: number;
  is_stock_tracked: boolean;
  has_variants: boolean;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  pos_categories?: { name: string } | null;
  pos_brands?: { name: string } | null;
}

interface Variant {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  price: number | '';
  cost_price: number | '';
  is_active: boolean;
}

interface Category { id: string; name: string; }
interface Brand { id: string; name: string; }

export default function POSProdukPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [form, setForm] = useState({
    name: '', sku: '', barcode: '', category_id: '', brand_id: '', unit: 'pcs',
    price: '', cost_price: '', tax_rate: '0', description: '',
    is_stock_tracked: true, has_variants: false, is_active: true,
  });

  useEffect(() => {
    if (tenant) {
      fetchProducts();
      fetchMeta();
    }
  }, [tenant]);

  const fetchProducts = async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('pos_products' as any)
      .select('*, pos_categories(name), pos_brands(name)')
      .eq('tenant_id', tenant.id)
      .order('name');
    setProducts((data || []) as unknown as Product[]);
    setLoading(false);
  };

  const fetchMeta = async () => {
    if (!tenant) return;
    const [catRes, brandRes] = await Promise.all([
      supabase.from('pos_categories' as any).select('id, name').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
      supabase.from('pos_brands' as any).select('id, name').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
    ]);
    setCategories((catRes.data || []) as unknown as Category[]);
    setBrands((brandRes.data || []) as unknown as Brand[]);
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.includes(search));
    const matchCat = filterCat === 'all' || p.category_id === filterCat;
    return matchSearch && matchCat;
  });

  const openAdd = () => {
    setEditing(null);
    setVariants([]);
    setForm({ name: '', sku: '', barcode: '', category_id: '', brand_id: '', unit: 'pcs', price: '', cost_price: '', tax_rate: '0', description: '', is_stock_tracked: true, has_variants: false, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = async (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku || '', barcode: p.barcode || '',
      category_id: p.category_id || '', brand_id: p.brand_id || '',
      unit: p.unit, price: String(p.price), cost_price: String(p.cost_price),
      tax_rate: String(p.tax_rate), description: p.description || '',
      is_stock_tracked: p.is_stock_tracked, has_variants: p.has_variants, is_active: p.is_active,
    });
    if (p.has_variants) {
      const { data } = await supabase.from('pos_product_variants' as any).select('*').eq('product_id', p.id);
      setVariants((data || []).map((v: any) => ({ id: v.id, name: v.name, sku: v.sku || '', barcode: v.barcode || '', price: v.price ?? '', cost_price: v.cost_price ?? '', is_active: v.is_active })));
    } else {
      setVariants([]);
    }
    setDialogOpen(true);
  };

  const generateSKU = () => {
    const prefix = form.name.substring(0, 3).toUpperCase().replace(/\s/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    setForm(p => ({ ...p, sku: `${prefix}-${rand}` }));
  };

  const addVariant = () => setVariants(v => [...v, { name: '', sku: '', barcode: '', price: '', cost_price: '', is_active: true }]);
  const removeVariant = (i: number) => setVariants(v => v.filter((_, idx) => idx !== i));
  const updateVariant = (i: number, field: keyof Variant, val: any) => setVariants(v => v.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const handleSave = async () => {
    if (!tenant) return;
    if (!form.name.trim()) { toast.error('Nama produk wajib diisi'); return; }
    if (!form.price || isNaN(Number(form.price))) { toast.error('Harga jual wajib diisi'); return; }

    const payload: any = {
      name: form.name.trim(),
      sku: form.sku || null,
      barcode: form.barcode || null,
      category_id: form.category_id || null,
      brand_id: form.brand_id || null,
      unit: form.unit,
      price: Number(form.price),
      cost_price: Number(form.cost_price) || 0,
      tax_rate: Number(form.tax_rate) || 0,
      description: form.description || null,
      is_stock_tracked: form.is_stock_tracked,
      has_variants: form.has_variants,
      is_active: form.is_active,
      tenant_id: tenant.id,
    };

    try {
      let productId = editing?.id;
      if (editing) {
        await supabase.from('pos_products' as any).update(payload).eq('id', editing.id);
      } else {
        const { data } = await supabase.from('pos_products' as any).insert(payload).select().single();
        productId = (data as any)?.id;

        // Create initial stock entry for active outlet
        if (activeOutlet && productId && !form.has_variants) {
          await supabase.from('pos_stock' as any).insert({
            tenant_id: tenant.id, product_id: productId, outlet_id: activeOutlet.id,
            quantity: 0, min_stock: 5,
          });
        }
      }

      // Handle variants
      if (form.has_variants && productId) {
        for (const v of variants) {
          if (!v.name.trim()) continue;
          const vPayload = {
            product_id: productId, tenant_id: tenant.id, name: v.name,
            sku: v.sku || null, barcode: v.barcode || null,
            price: v.price !== '' ? Number(v.price) : null,
            cost_price: v.cost_price !== '' ? Number(v.cost_price) : null,
            is_active: v.is_active,
          };
          if (v.id) {
            await supabase.from('pos_product_variants' as any).update(vPayload).eq('id', v.id);
          } else {
            await supabase.from('pos_product_variants' as any).insert(vPayload);
          }
        }
      }

      toast.success(editing ? 'Produk diperbarui' : 'Produk berhasil ditambahkan');
      setDialogOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('pos_products' as any).update({ is_active: false }).eq('id', deleteId);
    toast.success('Produk dinonaktifkan');
    setDeleteId(null);
    fetchProducts();
  };

  const exportCSV = () => {
    const rows = [['Nama', 'SKU', 'Barcode', 'Kategori', 'Satuan', 'Harga Jual', 'Harga Modal', 'Pajak %', 'Status']];
    filtered.forEach(p => {
      rows.push([p.name, p.sku || '', p.barcode || '', (p.pos_categories as any)?.name || '', p.unit, String(p.price), String(p.cost_price), String(p.tax_rate), p.is_active ? 'Aktif' : 'Nonaktif']);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'produk.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const activeCount = products.filter(p => p.is_active).length;
  const inactiveCount = products.length - activeCount;

  return (
    <POSLayout title="Manajemen Produk" subtitle={`${products.length} produk terdaftar`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Tambah Produk</Button>
        </div>
      }>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Produk</p><p className="text-xl font-bold mt-1">{products.length}</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Aktif</p><p className="text-xl font-bold mt-1 text-emerald-600">{activeCount}</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Nonaktif</p><p className="text-xl font-bold mt-1 text-muted-foreground">{inactiveCount}</p></CardContent></Card>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari nama, SKU, atau barcode..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">{search || filterCat !== 'all' ? 'Produk Tidak Ditemukan' : 'Belum Ada Produk'}</h3>
            <p className="text-sm text-muted-foreground mb-4">Tambahkan produk untuk mulai berjualan.</p>
            {!search && filterCat === 'all' && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Tambah Produk Pertama</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(p => (
              <Card key={p.id} className={`border shadow-sm hover:shadow-md transition-shadow ${!p.is_active ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {p.sku && <Badge variant="outline" className="text-xs">{p.sku}</Badge>}
                        {(p.pos_categories as any)?.name && <Badge variant="secondary" className="text-xs">{(p.pos_categories as any).name}</Badge>}
                        {p.has_variants && <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">Varian</Badge>}
                        {!p.is_active && <Badge variant="destructive" className="text-xs">Nonaktif</Badge>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="font-bold text-emerald-600">{formatCurrency(p.price)}</p>
                      {p.cost_price > 0 && <p className="text-xs text-muted-foreground">Modal: {formatCurrency(p.cost_price)}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{p.unit}</p>
                      {p.tax_rate > 0 && <p className="text-xs text-muted-foreground">PPN {p.tax_rate}%</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Info Dasar</TabsTrigger>
              <TabsTrigger value="harga" className="flex-1">Harga & Stok</TabsTrigger>
              {form.has_variants && <TabsTrigger value="varian" className="flex-1">Varian</TabsTrigger>}
            </TabsList>

            <TabsContent value="info" className="space-y-3 mt-4">
              <div>
                <Label>Nama Produk *</Label>
                <Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nama produk" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SKU</Label>
                  <div className="flex gap-1 mt-1">
                    <Input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} placeholder="SKU-001" />
                    <Button type="button" variant="outline" size="sm" onClick={generateSKU} className="flex-shrink-0 text-xs px-2">Auto</Button>
                  </div>
                </div>
                <div>
                  <Label>Barcode</Label>
                  <Input className="mt-1" value={form.barcode} onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))} placeholder="8990000000000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kategori</Label>
                  <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Tanpa Kategori —</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Brand</Label>
                  <Select value={form.brand_id} onValueChange={v => setForm(p => ({ ...p, brand_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih brand" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Tanpa Brand —</SelectItem>
                      {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Satuan</Label>
                <Select value={form.unit} onValueChange={v => setForm(p => ({ ...p, unit: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pcs', 'kg', 'gram', 'liter', 'ml', 'box', 'pack', 'lusin', 'karton', 'botol', 'buah', 'lembar', 'meter', 'cm', 'porsi'].map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Deskripsi</Label>
                <Textarea className="mt-1" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Deskripsi produk (opsional)" />
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <Label>Produk Aktif</Label>
                  <p className="text-xs text-muted-foreground">Produk nonaktif tidak muncul di kasir</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
              </div>
            </TabsContent>

            <TabsContent value="harga" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Harga Jual *</Label>
                  <Input className="mt-1" type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <Label>Harga Modal (HPP)</Label>
                  <Input className="mt-1" type="number" value={form.cost_price} onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))} placeholder="0" />
                </div>
              </div>
              {form.price && form.cost_price && Number(form.cost_price) > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs text-emerald-700">
                    Margin: {formatCurrency(Number(form.price) - Number(form.cost_price))} ({Math.round(((Number(form.price) - Number(form.cost_price)) / Number(form.price)) * 100)}%)
                  </p>
                </div>
              )}
              <div>
                <Label>Tarif Pajak (%)</Label>
                <Select value={form.tax_rate} onValueChange={v => setForm(p => ({ ...p, tax_rate: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Tidak ada pajak</SelectItem>
                    <SelectItem value="11">PPN 11%</SelectItem>
                    <SelectItem value="12">PPN 12%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <Label>Lacak Stok</Label>
                  <p className="text-xs text-muted-foreground">Stok akan dikurangi saat transaksi</p>
                </div>
                <Switch checked={form.is_stock_tracked} onCheckedChange={v => setForm(p => ({ ...p, is_stock_tracked: v }))} />
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <Label>Punya Varian</Label>
                  <p className="text-xs text-muted-foreground">Misal: ukuran, warna, rasa</p>
                </div>
                <Switch checked={form.has_variants} onCheckedChange={v => setForm(p => ({ ...p, has_variants: v }))} />
              </div>
            </TabsContent>

            {form.has_variants && (
              <TabsContent value="varian" className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Tambahkan varian produk (ukuran, warna, rasa, dll)</p>
                  <Button type="button" size="sm" variant="outline" onClick={addVariant}><Plus className="h-4 w-4 mr-1" />Varian</Button>
                </div>
                {variants.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground">Belum ada varian. Klik tombol + untuk menambah.</p>
                  </div>
                )}
                {variants.map((v, i) => (
                  <Card key={i} className="border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Varian {i + 1}</Label>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeVariant(i)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input placeholder="Nama varian (misal: Merah L)" value={v.name} onChange={e => updateVariant(i, 'name', e.target.value)} className="h-8 text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Harga jual" type="number" value={v.price} onChange={e => updateVariant(i, 'price', e.target.value)} className="h-8 text-sm" />
                        <Input placeholder="Harga modal" type="number" value={v.cost_price} onChange={e => updateVariant(i, 'cost_price', e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="SKU varian" value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value)} className="h-8 text-sm" />
                        <Input placeholder="Barcode" value={v.barcode} onChange={e => updateVariant(i, 'barcode', e.target.value)} className="h-8 text-sm" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            )}
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>Simpan Produk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan Produk?</AlertDialogTitle>
            <AlertDialogDescription>Produk tidak akan muncul di kasir, tetapi data transaksi lama tetap tersimpan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Nonaktifkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </POSLayout>
  );
}
