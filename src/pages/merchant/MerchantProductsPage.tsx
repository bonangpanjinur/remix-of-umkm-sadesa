import { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, MoreHorizontal, ImageIcon } from 'lucide-react';
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
    } catch (error) {
      toast.error('Gagal menyimpan produk');
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
        data={products}
        columns={columns}
        searchKey="name"
        searchPlaceholder="Cari nama produk..."
        filters={filters}
        loading={loading}
        emptyMessage="Belum ada produk"
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
              <ImageUpload
                bucket="product-images"
                path={merchantId || 'temp'}
                value={form.image_url}
                onChange={(url) => setForm(prev => ({ ...prev, image_url: url }))}
                aspectRatio="square"
                maxSizeMB={5}
                placeholder="Upload gambar produk"
              />
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
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Deskripsi produk"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Harga *</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0"
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
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm(prev => ({ ...prev, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kuliner">Kuliner</SelectItem>
                  <SelectItem value="fashion">Fashion</SelectItem>
                  <SelectItem value="kriya">Kriya</SelectItem>
                  <SelectItem value="wisata">Wisata</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(c) => setForm(prev => ({ ...prev, is_active: c }))}
                />
                <Label htmlFor="is_active">Aktif</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_promo"
                  checked={form.is_promo}
                  onCheckedChange={(c) => setForm(prev => ({ ...prev, is_promo: c }))}
                />
                <Label htmlFor="is_promo">Promo</Label>
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
