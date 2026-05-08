import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Search, Plus, Trash2, FlaskConical, Package, RefreshCw,
  ChefHat, AlertCircle, DollarSign
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
  cost_price: number;
}

interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  current_stock: number;
}

interface RecipeItem {
  id: string;
  product_id: string;
  raw_material_id: string;
  qty_needed: number;
  unit: string;
  notes: string | null;
  pos_raw_materials?: { name: string; unit: string; cost_per_unit: number; current_stock: number } | null;
}

interface RecipeGroup {
  product: Product;
  items: RecipeItem[];
  totalCost: number;
}

const UNITS = ['gram', 'kg', 'ml', 'liter', 'pcs', 'butir', 'lembar', 'sdm', 'sdt', 'sachet', 'bungkus', 'botol', 'kaleng', 'porsi'];

export default function POSResepPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newIngredient, setNewIngredient] = useState({
    raw_material_id: '', qty_needed: '', unit: 'gram', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecipeItem | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [prodRes, matRes, recipeRes] = await Promise.all([
        supabase
          .from('pos_products' as any)
          .select('id, name, unit, price, cost_price')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('pos_raw_materials' as any)
          .select('id, name, unit, cost_per_unit, current_stock')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('pos_recipes' as any)
          .select('*, pos_raw_materials(name, unit, cost_per_unit, current_stock)')
          .eq('tenant_id', tenant.id)
          .order('product_id'),
      ]);

      setProducts((prodRes.data || []) as unknown as Product[]);
      setMaterials((matRes.data || []) as unknown as RawMaterial[]);
      setRecipes((recipeRes.data || []) as unknown as RecipeItem[]);
    } catch (err: any) {
      toast.error('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDialog = (productId?: string) => {
    setSelectedProductId(productId || '');
    setNewIngredient({ raw_material_id: '', qty_needed: '', unit: 'gram', notes: '' });
    setDialogOpen(true);
  };

  const handleAddIngredient = async () => {
    if (!tenant || !selectedProductId || !newIngredient.raw_material_id || !newIngredient.qty_needed) {
      toast.error('Lengkapi semua field');
      return;
    }
    const qty = parseFloat(newIngredient.qty_needed);
    if (isNaN(qty) || qty <= 0) { toast.error('Jumlah harus lebih dari 0'); return; }

    const existing = recipes.find(
      r => r.product_id === selectedProductId && r.raw_material_id === newIngredient.raw_material_id
    );
    if (existing) { toast.error('Bahan ini sudah ada di resep produk tersebut'); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from('pos_recipes' as any).insert({
        tenant_id: tenant.id,
        product_id: selectedProductId,
        raw_material_id: newIngredient.raw_material_id,
        qty_needed: qty,
        unit: newIngredient.unit,
        notes: newIngredient.notes || null,
      });
      if (error) throw error;
      toast.success('Bahan berhasil ditambahkan ke resep');
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('pos_recipes' as any)
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Bahan dihapus dari resep');
      setDeleteDialog(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Group recipes by product
  const recipeGroups: RecipeGroup[] = products
    .filter(p => {
      const hasRecipe = recipes.some(r => r.product_id === p.id);
      if (!hasRecipe) return false;
      if (!search) return true;
      return p.name.toLowerCase().includes(search.toLowerCase());
    })
    .map(p => {
      const items = recipes.filter(r => r.product_id === p.id);
      const totalCost = items.reduce((sum, r) => {
        const mat = r.pos_raw_materials as any;
        return sum + (mat?.cost_per_unit || 0) * r.qty_needed;
      }, 0);
      return { product: p, items, totalCost };
    });

  const productsWithoutRecipe = products.filter(p => !recipes.some(r => r.product_id === p.id));

  const getMaterialById = (id: string) => materials.find(m => m.id === id);

  const canMakeProduct = (group: RecipeGroup) => {
    return group.items.every(item => {
      const mat = item.pos_raw_materials as any;
      return (mat?.current_stock || 0) >= item.qty_needed;
    });
  };

  return (
    <POSLayout title="Resep Produk" subtitle="Kelola bahan baku per produk (Bill of Materials)">
      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Produk punya Resep</p>
              <p className="text-2xl font-bold text-emerald-700">{recipeGroups.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Produk Belum Ada Resep</p>
              <p className="text-2xl font-bold text-orange-500">{productsWithoutRecipe.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Bahan Baku</p>
              <p className="text-2xl font-bold">{materials.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Bisa Dibuat</p>
              <p className="text-2xl font-bold text-emerald-600">
                {recipeGroups.filter(g => canMakeProduct(g)).length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk..."
              className="pl-9 h-9 w-56"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={() => openDialog()} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> Tambah Resep
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Memuat data resep...</div>
        ) : (
          <div className="space-y-4">
            {/* Produk belum punya resep */}
            {productsWithoutRecipe.length > 0 && !search && (
              <Card className="border-dashed border-orange-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-orange-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {productsWithoutRecipe.length} produk belum memiliki resep
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {productsWithoutRecipe.map(p => (
                      <button
                        key={p.id}
                        onClick={() => openDialog(p.id)}
                        className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-3 py-1 transition-colors flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> {p.name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resep per Produk */}
            {recipeGroups.length === 0 ? (
              <div className="text-center py-12">
                <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {search ? 'Tidak ditemukan' : 'Belum ada resep. Klik "Tambah Resep" untuk mulai.'}
                </p>
                {materials.length === 0 && (
                  <p className="text-sm text-orange-500 mt-2">
                    Tambahkan bahan baku di halaman Bahan Baku terlebih dahulu.
                  </p>
                )}
              </div>
            ) : (
              recipeGroups.map(group => {
                const canMake = canMakeProduct(group);
                const margin = group.product.price > 0
                  ? ((group.product.price - group.totalCost) / group.product.price * 100)
                  : 0;
                return (
                  <Card key={group.product.id} className={`transition-shadow hover:shadow-md ${!canMake ? 'border-red-200' : 'border-emerald-200'}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <ChefHat className="h-5 w-5 text-emerald-600" />
                          <CardTitle className="text-base">{group.product.name}</CardTitle>
                          <Badge variant={canMake ? 'default' : 'destructive'} className="text-xs">
                            {canMake ? 'Bisa Dibuat' : 'Stok Kurang'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            HPP Resep: <strong className="text-red-600">{formatCurrency(group.totalCost)}</strong>
                          </span>
                          <span className="text-muted-foreground">
                            Harga: <strong>{formatCurrency(group.product.price)}</strong>
                          </span>
                          <Badge
                            className={`text-xs ${margin >= 40 ? 'bg-emerald-100 text-emerald-700' : margin >= 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}
                          >
                            Margin {margin.toFixed(1)}%
                          </Badge>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => openDialog(group.product.id)}
                            className="h-7 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" /> Tambah Bahan
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {group.items.map(item => {
                          const mat = item.pos_raw_materials as any;
                          const hasStock = (mat?.current_stock || 0) >= item.qty_needed;
                          const itemCost = (mat?.cost_per_unit || 0) * item.qty_needed;
                          return (
                            <div key={item.id} className="flex items-center justify-between py-1.5 border-b last:border-0 gap-2 flex-wrap">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${hasStock ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <span className="text-sm font-medium">{mat?.name || '—'}</span>
                                <span className="text-xs text-muted-foreground">
                                  {item.qty_needed.toLocaleString('id-ID')} {item.unit}
                                </span>
                                {!hasStock && (
                                  <Badge variant="destructive" className="text-xs">
                                    Stok: {(mat?.current_stock || 0).toLocaleString('id-ID')} {mat?.unit}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(mat?.cost_per_unit || 0)}/{mat?.unit} = <strong>{formatCurrency(itemCost)}</strong>
                                </span>
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => { setDeleteTarget(item); setDeleteDialog(true); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Dialog Tambah Bahan ke Resep */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Bahan ke Resep</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Produk <span className="text-red-500">*</span></Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih produk..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Bahan Baku <span className="text-red-500">*</span></Label>
              <Select
                value={newIngredient.raw_material_id}
                onValueChange={v => {
                  const mat = getMaterialById(v);
                  setNewIngredient(f => ({ ...f, raw_material_id: v, unit: mat?.unit || 'gram' }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih bahan baku..." />
                </SelectTrigger>
                <SelectContent>
                  {materials.length === 0 ? (
                    <SelectItem value="_" disabled>Belum ada bahan baku</SelectItem>
                  ) : (
                    materials.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} (stok: {m.current_stock.toLocaleString('id-ID')} {m.unit})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Jumlah dibutuhkan <span className="text-red-500">*</span></Label>
                <Input
                  type="number" min="0.001" step="0.001" placeholder="0"
                  value={newIngredient.qty_needed}
                  onChange={e => setNewIngredient(f => ({ ...f, qty_needed: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Satuan</Label>
                <Select
                  value={newIngredient.unit}
                  onValueChange={v => setNewIngredient(f => ({ ...f, unit: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Catatan (opsional)</Label>
              <Input
                placeholder="cth: ayam fillet tanpa tulang..."
                value={newIngredient.notes}
                onChange={e => setNewIngredient(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {newIngredient.raw_material_id && newIngredient.qty_needed && (
              <div className="bg-emerald-50 rounded-lg px-3 py-2 text-sm border border-emerald-200">
                <p className="text-emerald-700">
                  Estimasi biaya:{' '}
                  <strong>
                    {formatCurrency(
                      (getMaterialById(newIngredient.raw_material_id)?.cost_per_unit || 0) *
                      (parseFloat(newIngredient.qty_needed) || 0)
                    )}
                  </strong>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleAddIngredient} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Menyimpan...' : 'Tambah ke Resep'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Bahan dari Resep?</AlertDialogTitle>
            <AlertDialogDescription>
              Bahan ini akan dihapus dari resep produk. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecipe} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </POSLayout>
  );
}
