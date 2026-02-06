import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Edit, Trash2, MoreHorizontal, ImageIcon, Layers, Images, Eye, ShoppingCart } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

const defaultForm: ProductForm = {
  name: '',
  description: '',
  price: '',
  stock: '0',
  category: 'kuliner',
  image_url: null,
  is_active: true,
  is_promo: false,
};

export default function MerchantProductsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchMerchantAndProducts = async () => {
      if (!user) return;

      try {
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!merchant) {
          setLoading(false);
          return;
        }

        setMerchantId(merchant.id);

        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('merchant_id', merchant.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error('Error:', error);
        toast.error('Gagal memuat produk');
      } finally {
        setLoading(false);
      }
    };

    fetchMerchantAndProducts();
  }, [user]);

  const openCreateDialog = () => {
    setEditingProduct(null);
    setForm(defaultForm);
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

  const handleSave = async () => {
    if (!merchantId || !form.name || !form.price) {
      toast.error('Nama dan harga wajib diisi');
      return;
    }

    setSaving(true);

    try {
      const productData = {
        name: form.name,
        description: form.description || null,
        price: parseInt(form.price),
        stock: parseInt(form.stock) || 0,
        category: form.category,
        image_url: form.image_url,
        is_active: form.is_active,
        is_promo: form.is_promo,
        merchant_id: merchantId,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('Produk berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData);

        if (error) throw error;
        toast.success('Produk berhasil ditambahkan');
      }

      setDialogOpen(false);
      // Refresh products
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error saving product:', error);
      const errorMessage = error.message || 'Gagal menyimpan produk';
      if (errorMessage.includes('Bucket not found')) {
        toast.error('Error: Bucket storage "products" tidak ditemukan. Silakan jalankan migrasi SQL.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Produk dihapus');
      setProducts(products.filter(p => p.id !== id));
    } catch (error) {
      toast.error('Gagal menghapus produk');
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      setProducts(products.map(p => 
        p.id === id ? { ...p, is_active: !currentActive } : p
      ));
      toast.success(currentActive ? 'Produk dinonaktifkan' : 'Produk diaktifkan');
    } catch (error) {
      toast.error('Gagal mengubah status');
    }
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
    {
      key: 'price',
      header: 'Harga',
      render: (item: ProductRow) => `Rp ${item.price.toLocaleString('id-ID')}`,
    },
    {
      key: 'stock',
      header: 'Stok',
      render: (item: ProductRow) => (
        <span className={item.stock === 0 ? 'text-destructive font-medium' : ''}>
          {item.stock}
        </span>
      ),
    },
    {
      key: 'stats',
      header: 'Statistik',
      render: (item: ProductRow) => (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {(item.view_count || 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <ShoppingCart className="h-3 w-3" />
            {(item.order_count || 0).toLocaleString()}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: ProductRow) => (
        <div className="flex items-center gap-2">
          {item.is_active ? (
            <Badge className="bg-primary/10 text-primary">Aktif</Badge>
          ) : (
            <Badge variant="outline">Nonaktif</Badge>
          )}
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
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(item)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/merchant/products/${item.id}`)}>
              <Images className="h-4 w-4 mr-2" />
              Gambar & Varian
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleActive(item.id, item.is_active)}>
              {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filters = [
    {
      key: 'category',
      label: 'Kategori',
      options: [
        { value: 'kuliner', label: 'Kuliner' },
        { value: 'fashion', label: 'Fashion' },
        { value: 'kriya', label: 'Kriya' },
        { value: 'wisata', label: 'Wisata' },
      ],
    },
  ];

  return (
    <MerchantLayout title="Produk" subtitle="Kelola produk toko Anda">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">{products.length} produk</span>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Produk
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        searchKey="name"
        filters={filters}
      />

      {/* Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Gambar Produk</Label>
              <div className="space-y-2">
                <ImageUpload
                  bucket="products"
                  path={`merchants/${merchantId}/products`}
                  value={form.image_url}
                  onChange={(url) => setForm({ ...form, image_url: url })}
                  aspectRatio="square"
                  maxSizeMB={5}
                  placeholder="Upload gambar produk"
                />
                <p className="text-[10px] text-muted-foreground">
                  Jika upload gagal, pastikan bucket 'products' sudah dibuat di Supabase Storage.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nama Produk *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nama produk"
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kuliner">Kuliner</SelectItem>
                  <SelectItem value="fashion">Fashion</SelectItem>
                  <SelectItem value="kriya">Kriya</SelectItem>
                  <SelectItem value="wisata">Wisata</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Harga (Rp) *</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="10000"
                />
              </div>
              <div className="space-y-2">
                <Label>Stok</Label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm(prev => ({ ...prev, stock: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Deskripsi produk..."
                rows={3}
              />
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>Aktif</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_promo}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_promo: checked }))}
                />
                <Label>Promo</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
