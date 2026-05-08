import { useState, useEffect } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
}

export default function POSKategoriPage() {
  const { tenant } = usePOS();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', parent_id: '', sort_order: 0 });

  useEffect(() => { if (tenant) fetchCategories(); }, [tenant]);

  const fetchCategories = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('pos_categories' as any).select('*').eq('tenant_id', tenant.id).order('sort_order').order('name');
    setCategories((data || []) as unknown as Category[]);
    setLoading(false);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', parent_id: '', sort_order: 0 });
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, parent_id: cat.parent_id || '', sort_order: cat.sort_order });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tenant) return;
    if (!form.name.trim()) { toast.error('Nama kategori wajib diisi'); return; }
    const payload = { name: form.name.trim(), parent_id: form.parent_id || null, sort_order: form.sort_order, tenant_id: tenant.id };
    try {
      if (editing) {
        await supabase.from('pos_categories' as any).update(payload).eq('id', editing.id);
        toast.success('Kategori diperbarui');
      } else {
        await supabase.from('pos_categories' as any).insert(payload);
        toast.success('Kategori ditambahkan');
      }
      setDialogOpen(false);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('pos_categories' as any).delete().eq('id', deleteId);
    toast.success('Kategori dihapus');
    setDeleteId(null);
    fetchCategories();
  };

  const parents = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  return (
    <POSLayout title="Kategori Produk" subtitle="Kelola kategori dan sub-kategori produk"
      actions={<Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Tambah Kategori</Button>}>
      
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16">
          <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Belum Ada Kategori</h3>
          <p className="text-sm text-muted-foreground mb-4">Tambahkan kategori untuk mengelompokkan produk.</p>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Tambah Kategori Pertama</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {parents.map(parent => (
            <div key={parent.id}>
              <Card className="border shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-sm">{parent.name}</span>
                    <Badge variant="outline" className="text-xs">{getChildren(parent.id).length} sub</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(parent)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(parent.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {getChildren(parent.id).map(child => (
                <div key={child.id} className="ml-6 mt-1">
                  <Card className="border border-dashed shadow-none bg-muted/30">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-px bg-muted-foreground/40 mr-1" />
                        <span className="text-sm">{child.name}</span>
                        <Badge variant="secondary" className="text-xs">Sub-kategori</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(child)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(child.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nama Kategori *</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Minuman, Snack, Sembako" />
            </div>
            <div>
              <Label>Induk Kategori (opsional)</Label>
              <Select value={form.parent_id} onValueChange={v => setForm(p => ({ ...p, parent_id: v === 'none' ? '' : v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Kategori utama" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Kategori Utama —</SelectItem>
                  {parents.filter(p => p.id !== editing?.id).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Urutan Tampil</Label>
              <Input className="mt-1" type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
            <AlertDialogDescription>Produk dalam kategori ini tidak akan terhapus, tetapi akan kehilangan kategorinya.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </POSLayout>
  );
}
