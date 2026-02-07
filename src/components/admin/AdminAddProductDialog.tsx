import { useState, useEffect } from 'react';
import { Plus, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminAddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId: string;
  merchantName: string;
  onSuccess: () => void;
}

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

export function AdminAddProductDialog({
  open,
  onOpenChange,
  merchantId,
  merchantName,
  onSuccess,
}: AdminAddProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    category: '',
    image_url: null as string | null,
    is_active: true,
    min_stock_alert: '5',
  });

  useEffect(() => {
    if (open) {
      fetchCategories();
      resetForm();
    }
  }, [open]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    setCategories(data || []);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      stock: '',
      category: '',
      image_url: null,
      is_active: true,
      min_stock_alert: '5',
    });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Nama produk wajib diisi');
      return;
    }
    if (!formData.price || Number(formData.price) <= 0) {
      toast.error('Harga harus lebih dari 0');
      return;
    }
    if (!formData.category) {
      toast.error('Kategori wajib dipilih');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('products').insert({
        merchant_id: merchantId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: Number(formData.price),
        stock: Number(formData.stock) || 0,
        category: formData.category,
        image_url: formData.image_url,
        is_active: formData.is_active,
        min_stock_alert: Number(formData.min_stock_alert) || 5,
      });

      if (error) throw error;

      toast.success('Produk berhasil ditambahkan');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Gagal menambahkan produk');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Tambah Produk
          </DialogTitle>
          <DialogDescription>
            Tambahkan produk baru untuk <strong>{merchantName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Product Image */}
          <div className="space-y-2">
            <Label>Gambar Produk</Label>
            <ImageUpload
              bucket="product-images"
              path={`admin/${merchantId}`}
              value={formData.image_url}
              onChange={(url) => setFormData({ ...formData, image_url: url })}
              aspectRatio="square"
              placeholder="Upload gambar produk"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Nama Produk *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nama produk"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Harga (Rp) *</Label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="10000"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Stok</Label>
              <Input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="100"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kategori *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Peringatan Stok Min.</Label>
              <Input
                type="number"
                value={formData.min_stock_alert}
                onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                placeholder="5"
                min="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Deskripsi</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Deskripsi produk"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
            />
            <Label>Produk Aktif</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Menyimpan...' : 'Simpan Produk'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
