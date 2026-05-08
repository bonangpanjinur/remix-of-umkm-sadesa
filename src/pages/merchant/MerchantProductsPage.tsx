import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Edit, Trash2, MoreHorizontal, ImageIcon, Images, Eye, ShoppingCart, AlertCircle } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { ProductVariantManager } from '@/components/merchant/ProductVariantManager';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string;
  image_url: string | null;
  is_active: boolean;
  is_promo: boolean;
  view_count: number | null;
  order_count: number | null;
}

interface ProductForm {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  image_url: string | null;
  is_active: boolean;
  is_promo: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

const defaultForm: ProductForm = {
  name: '', description: '', price: '', stock: '0', category: '', image_url: null, is_active: true, is_promo: false,
};

export default function MerchantProductsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { merchantId: guardMerchantId, loading: guardLoading } = useMerchantGuard();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [form, setForm] = useState<ProductForm>(defaultForm);

  const merchantId = guardMerchantId;

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name, slug, icon').eq('is_active', true).order('sort_order');
      return (data || []) as unknown as Category[];
    },
    staleTime: 300_000,
  });

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery<ProductRow[]>({
    queryKey: ['merchant-products', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('merchant_id', merchantId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!merchantId && !guardLoading,
    staleTime: 60_000,
  });

  const loading = guardLoading || productsLoading;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!merchantId) return;
      if (!form.name.trim()) throw new Error('Nama produk wajib diisi');
      if (!form.price || parseInt(form.price) <= 0) throw new Error('Harga produk harus lebih dari 0');
      if (!form.category) throw new Error('Silakan pilih kategori produk');

      const productData = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseInt(form.price),
        stock: parseInt(form.stock) || 0,
        category: form.category,
        image_url: form.image_url,
        is_active: form.is_active,
        is_promo: form.is_promo,
        merchant_id: merchantId,
        updated_at: new Date().toISOString(),
      };

      if (editingProduct) {
        const { error } = await supabase.from('products').update(productData).eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert({ ...productData, created_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingProduct ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['merchant-products', merchantId] });
    },
    onError: (err: any) => {
      const errorMessage = err.message || 'Gagal menyimpan produk';
      if (errorMessage.includes('Bucket not found')) {
        toast.error('Error: Bucket storage "products" tidak ditemukan. Silakan jalankan migrasi SQL.');
      } else {
        toast.error(errorMessage);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm('Yakin ingin menghapus produk ini?')) throw new Error('cancelled');
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Produk dihapus');
      queryClient.invalidateQueries({ queryKey: ['merchant-products', merchantId] });
    },
    onError: (err: any) => { if (err.message !== 'cancelled') toast.error('Gagal menghapus produk'); },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, currentActive }: { id: string; currentActive: boolean }) => {
      const { error } = await supabase.from('products').update({ is_active: !currentActive }).eq('id', id);
      if (error) throw error;
      return !currentActive;
    },
    onSuccess: (newActive) => {
      toast.success(newActive ? 'Produk diaktifkan' : 'Produk dinonaktifkan');
      queryClient.invalidateQueries({ queryKey: ['merchant-products', merchantId] });
    },
    onError: () => toast.error('Gagal mengubah status'),
  });

  const openCreateDialog = () => {
    setEditingProduct(null);
    setForm({ ...defaultForm, category: categories.length > 0 ? categories[0].slug : '' });
    setDialogOpen(true);
  };

  const openEditDialog = (product: ProductRow) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category,
      image_url: product.image_url,
      is_active: product.is_active,
      is_promo: product.is_promo,
    });
    setDialogOpen(true);
  };

  const columns = [
    {
      key: 'product',
      header: 'Produk',
      render: (item: ProductRow) => (
        <div className="flex items-center gap-3">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
          </div>
        </div>
      ),
    },
    { key: 'price', header: 'Harga', render: (item: ProductRow) => `Rp ${item.price.toLocaleString('id-ID')}` },
    {
      key: 'stock',
      header: 'Stok',
      render: (item: ProductRow) => {
        const isOutOfStock = item.stock === 0;
        const isLowStock = !isOutOfStock && item.stock <= 5;
        return (
          <div className="flex items-center gap-1.5">
            <span className={isOutOfStock ? 'text-destructive font-medium' : isLowStock ? 'text-warning font-medium' : ''}>{item.stock}</span>
            {isLowStock && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-warning/50 text-warning">Rendah</Badge>}
            {isOutOfStock && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-destructive/50 text-destructive">Habis</Badge>}
          </div>
        );
      },
    },
    {
      key: 'stats',
      header: 'Statistik',
      render: (item: ProductRow) => (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{(item.view_count || 0).toLocaleString()}</span>
          <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" />{(item.order_count || 0).toLocaleString()}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: ProductRow) => (
        <div className="flex items-center gap-2">
          {item.is_active ? <Badge className="bg-primary/10 text-primary">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
          {item.is_promo && <Badge variant="secondary">Promo</Badge>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: ProductRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(item)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/merchant/products/${item.id}`)}><Images className="h-4 w-4 mr-2" />Gambar & Varian</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleActiveMutation.mutate({ id: item.id, currentActive: item.is_active })}>
              {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => deleteMutation.mutate(item.id)} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filters = [{ key: 'category', label: 'Kategori', options: categories.map(cat => ({ value: cat.slug, label: cat.name })) }];

  return (
    <MerchantLayout title="Produk" subtitle="Kelola produk toko Anda">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">{products.length} produk</span>
        </div>
        <Button onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" />Tambah Produk</Button>
      </div>

      <DataTable columns={columns} data={products} loading={loading} searchKeys={['name']} filters={filters} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
            <DialogDescription>Lengkapi informasi produk di bawah ini. Tanda (*) wajib diisi.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Gambar Produk</Label>
              <div className="space-y-2">
                <ImageUpload bucket="product-images" path={`merchants/${merchantId}/products`} value={form.image_url}
                  onChange={url => setForm(p => ({ ...p, image_url: url }))} aspectRatio="square" maxSizeMB={5} placeholder="Upload gambar produk" />
                <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-tight">Gunakan gambar berkualitas tinggi (1:1). Jika upload gagal, pastikan bucket 'products' sudah dibuat di Supabase Storage.</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <Label className="text-base font-semibold">Informasi Dasar</Label>
              <div className="space-y-2">
                <Label htmlFor="prod-name">Nama Produk *</Label>
                <Input id="prod-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Nasi Goreng Spesial" />
              </div>
              <div className="space-y-2">
                <Label>Kategori *</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => <SelectItem key={cat.id} value={cat.slug}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Harga (Rp) *</Label>
                  <Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="15000" />
                </div>
                <div className="space-y-2">
                  <Label>Stok</Label>
                  <Input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Jelaskan detail produk Anda..." rows={3} />
              </div>
            </div>
            <div className="space-y-4 pt-2 border-t">
              <Label className="text-base font-semibold">Pengaturan</Label>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch id="is_active" checked={form.is_active} onCheckedChange={c => setForm(p => ({ ...p, is_active: c }))} />
                  <Label htmlFor="is_active" className="cursor-pointer">Produk Aktif</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="is_promo" checked={form.is_promo} onCheckedChange={c => setForm(p => ({ ...p, is_promo: c }))} />
                  <Label htmlFor="is_promo" className="cursor-pointer">Sedang Promo</Label>
                </div>
              </div>
            </div>
            {editingProduct && (
              <div className="border-t pt-4">
                <ProductVariantManager productId={editingProduct.id} basePrice={parseInt(form.price) || 0} />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saveMutation.isPending}>Batal</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="min-w-[100px]">
              {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Produk'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
