import { useState } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Truck, Phone, Mail, MapPin } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  contact_person: string | null;
  notes: string | null;
  is_active: boolean;
}

export default function POSSupplierPage() {
  const { tenant } = usePOS();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', contact_person: '', notes: '' });

  const { data: suppliers = [], isLoading: loading } = useQuery<Supplier[]>({
    queryKey: ['pos-suppliers', tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pos_suppliers' as any)
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('name');
      return (data || []) as unknown as Supplier[];
    },
    enabled: !!tenant,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) return;
      if (!form.name.trim()) throw new Error('Nama supplier wajib diisi');
      const payload = {
        name: form.name.trim(), phone: form.phone || null, email: form.email || null,
        address: form.address || null, contact_person: form.contact_person || null,
        notes: form.notes || null, tenant_id: tenant.id,
      };
      if (editing) {
        await supabase.from('pos_suppliers' as any).update(payload).eq('id', editing.id);
      } else {
        await supabase.from('pos_suppliers' as any).insert(payload);
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Data supplier diperbarui' : 'Supplier berhasil ditambahkan');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pos-suppliers', tenant?.id] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('pos_suppliers' as any).update({ is_active: false }).eq('id', id);
    },
    onSuccess: () => {
      toast.success('Supplier dinonaktifkan');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['pos-suppliers', tenant?.id] });
    },
    onError: () => toast.error('Gagal menonaktifkan supplier'),
  });

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone && s.phone.includes(search))
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '', contact_person: '', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '', contact_person: s.contact_person || '', notes: s.notes || '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Nama supplier wajib diisi'); return; }
    saveMutation.mutate();
  };

  return (
    <POSLayout title="Manajemen Supplier" subtitle={`${suppliers.length} supplier terdaftar`}
      actions={<Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Tambah Supplier</Button>}>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari nama supplier..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">{search ? 'Supplier Tidak Ditemukan' : 'Belum Ada Supplier'}</h3>
            <p className="text-sm text-muted-foreground mb-4">{search ? 'Coba kata kunci lain.' : 'Tambahkan supplier untuk manajemen pembelian.'}</p>
            {!search && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Tambah Supplier</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(s => (
              <Card key={s.id} className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Truck className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{s.name}</p>
                        {s.contact_person && <p className="text-xs text-muted-foreground">{s.contact_person}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {s.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{s.phone}</p>}
                    {s.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{s.email}</p>}
                    {s.address && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3" />{s.address}</p>}
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground mt-2 italic">{s.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Supplier' : 'Tambah Supplier'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nama Supplier *</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nama perusahaan/toko supplier" />
            </div>
            <div>
              <Label>Nama Contact Person</Label>
              <Input className="mt-1" value={form.contact_person} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))} placeholder="Nama orang yang dihubungi" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nomor HP / WA</Label>
                <Input className="mt-1" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
              </div>
              <div>
                <Label>Email</Label>
                <Input className="mt-1" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@supplier.com" />
              </div>
            </div>
            <div>
              <Label>Alamat</Label>
              <Textarea className="mt-1" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} rows={2} placeholder="Alamat supplier" />
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea className="mt-1" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Catatan tambahan tentang supplier" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan Supplier?</AlertDialogTitle>
            <AlertDialogDescription>Supplier akan dinonaktifkan dan tidak muncul dalam daftar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Nonaktifkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </POSLayout>
  );
}
