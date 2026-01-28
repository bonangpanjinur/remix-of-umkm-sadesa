import { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';

interface TransactionPackage {
  id: string;
  name: string;
  classification_price: string;
  price_per_transaction: number;
  group_commission_percent: number;
  transaction_quota: number;
  validity_days: number;
  description: string | null;
  is_active: boolean;
}

const CLASSIFICATION_OPTIONS = [
  { value: 'UNDER_5K', label: '≤ Rp 5.000' },
  { value: 'FROM_5K_TO_10K', label: 'Rp 5.000 - 10.000' },
  { value: 'FROM_10K_TO_20K', label: 'Rp 10.000 - 20.000' },
  { value: 'ABOVE_20K', label: '> Rp 20.000' },
];

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<TransactionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<TransactionPackage | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    classification_price: 'UNDER_5K',
    price_per_transaction: 500,
    group_commission_percent: 5,
    transaction_quota: 50,
    validity_days: 30,
    description: '',
    is_active: true,
  });

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('transaction_packages')
        .select('*')
        .order('classification_price', { ascending: true });

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Gagal memuat data paket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleSubmit = async () => {
    try {
      if (editingPackage) {
        const { error } = await supabase
          .from('transaction_packages')
          .update(formData)
          .eq('id', editingPackage.id);

        if (error) throw error;
        toast.success('Paket berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('transaction_packages')
          .insert(formData);

        if (error) throw error;
        toast.success('Paket berhasil ditambahkan');
      }

      setDialogOpen(false);
      resetForm();
      fetchPackages();
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error('Gagal menyimpan paket');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus paket ini?')) return;

    try {
      const { error } = await supabase
        .from('transaction_packages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Paket berhasil dihapus');
      fetchPackages();
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error('Gagal menghapus paket. Mungkin masih digunakan.');
    }
  };

  const handleEdit = (pkg: TransactionPackage) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      classification_price: pkg.classification_price,
      price_per_transaction: pkg.price_per_transaction,
      group_commission_percent: pkg.group_commission_percent,
      transaction_quota: pkg.transaction_quota,
      validity_days: pkg.validity_days,
      description: pkg.description || '',
      is_active: pkg.is_active,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPackage(null);
    setFormData({
      name: '',
      classification_price: 'UNDER_5K',
      price_per_transaction: 500,
      group_commission_percent: 5,
      transaction_quota: 50,
      validity_days: 30,
      description: '',
      is_active: true,
    });
  };

  const getClassificationLabel = (value: string) => {
    return CLASSIFICATION_OPTIONS.find(o => o.value === value)?.label || value;
  };

  return (
    <AdminLayout title="Paket Transaksi" subtitle="Kelola paket kuota transaksi untuk pedagang">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">
            {packages.length} paket tersedia
          </span>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Paket
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {packages.map((pkg) => (
            <Card key={pkg.id} className={!pkg.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{pkg.name}</CardTitle>
                    <CardDescription>{getClassificationLabel(pkg.classification_price)}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {pkg.is_active ? (
                      <Badge variant="success">Aktif</Badge>
                    ) : (
                      <Badge variant="secondary">Nonaktif</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-muted-foreground">Biaya/Transaksi</p>
                    <p className="font-medium">{formatPrice(pkg.price_per_transaction)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Komisi Kelompok</p>
                    <p className="font-medium">{pkg.group_commission_percent}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Kuota</p>
                    <p className="font-medium">{pkg.transaction_quota} transaksi</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Masa Aktif</p>
                    <p className="font-medium">{pkg.validity_days} hari</p>
                  </div>
                </div>
                {pkg.description && (
                  <p className="text-sm text-muted-foreground mb-4">{pkg.description}</p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(pkg)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(pkg.id)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Hapus
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPackage ? 'Edit Paket' : 'Tambah Paket Baru'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nama Paket</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Paket UMKM Mikro"
              />
            </div>

            <div>
              <Label>Klasifikasi Harga Produk</Label>
              <Select
                value={formData.classification_price}
                onValueChange={(v) => setFormData({ ...formData, classification_price: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASSIFICATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Biaya per Transaksi (Rp)</Label>
                <Input
                  type="number"
                  value={formData.price_per_transaction}
                  onChange={(e) => setFormData({ ...formData, price_per_transaction: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Komisi Kelompok (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.group_commission_percent}
                  onChange={(e) => setFormData({ ...formData, group_commission_percent: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kuota Transaksi</Label>
                <Input
                  type="number"
                  value={formData.transaction_quota}
                  onChange={(e) => setFormData({ ...formData, transaction_quota: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Masa Aktif (hari)</Label>
                <Input
                  type="number"
                  value={formData.validity_days}
                  onChange={(e) => setFormData({ ...formData, validity_days: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>Deskripsi</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Deskripsi paket..."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label>Paket Aktif</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingPackage ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
