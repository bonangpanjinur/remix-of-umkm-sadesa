import { useState, useEffect } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Store, Plus, Pencil, Phone, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Outlet {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
}

export default function POSPengaturanPage() {
  const { tenant, outlets, refetchTenant, refetchOutlets } = usePOS();
  const { user } = useAuth();
  const [tenantForm, setTenantForm] = useState({
    name: '', phone: '', address: '', receipt_header: '', receipt_footer: '', timezone: 'Asia/Jakarta', currency: 'IDR',
  });
  const [outletDialog, setOutletDialog] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [outletForm, setOutletForm] = useState({ name: '', address: '', phone: '' });
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [isNewTenant, setIsNewTenant] = useState(false);

  useEffect(() => {
    if (tenant) {
      setTenantForm({
        name: tenant.name || '',
        phone: (tenant as any).phone || '',
        address: (tenant as any).address || '',
        receipt_header: (tenant as any).receipt_header || '',
        receipt_footer: (tenant as any).receipt_footer || '',
        timezone: tenant.timezone || 'Asia/Jakarta',
        currency: tenant.currency || 'IDR',
      });
    } else {
      setIsNewTenant(true);
    }
    if (tenant) fetchBrands();
  }, [tenant]);

  const fetchBrands = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('pos_brands' as any).select('id, name').eq('tenant_id', tenant.id).order('name');
    setBrands((data || []) as unknown as { id: string; name: string }[]);
  };

  const saveTenant = async () => {
    if (!user) return;
    if (!tenantForm.name.trim()) { toast.error('Nama usaha wajib diisi'); return; }
    setSaving(true);
    try {
      if (tenant) {
        await supabase.from('pos_tenants' as any).update(tenantForm).eq('id', tenant.id);
        toast.success('Profil usaha berhasil disimpan');
        await refetchTenant();
      } else {
        const { data: newTenant, error } = await supabase.from('pos_tenants' as any).insert({ ...tenantForm, user_id: user.id }).select().single();
        if (error) throw error;
        await supabase.from('pos_outlets' as any).insert({ tenant_id: (newTenant as any).id, name: tenantForm.name + ' - Outlet Utama' });
        toast.success('Usaha berhasil dibuat!');
        await refetchTenant();
        window.location.reload();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openAddOutlet = () => {
    setEditingOutlet(null);
    setOutletForm({ name: '', address: '', phone: '' });
    setOutletDialog(true);
  };

  const openEditOutlet = (o: Outlet) => {
    setEditingOutlet(o);
    setOutletForm({ name: o.name, address: o.address || '', phone: o.phone || '' });
    setOutletDialog(true);
  };

  const saveOutlet = async () => {
    if (!tenant) return;
    if (!outletForm.name.trim()) { toast.error('Nama outlet wajib diisi'); return; }
    const payload = { ...outletForm, tenant_id: tenant.id, address: outletForm.address || null, phone: outletForm.phone || null };
    try {
      if (editingOutlet) {
        await supabase.from('pos_outlets' as any).update(payload).eq('id', editingOutlet.id);
        toast.success('Outlet diperbarui');
      } else {
        await supabase.from('pos_outlets' as any).insert(payload);
        toast.success('Outlet berhasil ditambahkan');
      }
      setOutletDialog(false);
      await refetchOutlets();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleOutlet = async (outlet: Outlet) => {
    await supabase.from('pos_outlets' as any).update({ is_active: !outlet.is_active }).eq('id', outlet.id);
    await refetchOutlets();
    toast.success(outlet.is_active ? 'Outlet dinonaktifkan' : 'Outlet diaktifkan');
  };

  const addBrand = async () => {
    if (!tenant || !brandName.trim()) return;
    await supabase.from('pos_brands' as any).insert({ name: brandName.trim(), tenant_id: tenant.id });
    setBrandName('');
    setBrandDialogOpen(false);
    fetchBrands();
    toast.success('Brand ditambahkan');
  };

  const deleteBrand = async (id: string) => {
    await supabase.from('pos_brands' as any).delete().eq('id', id);
    fetchBrands();
  };

  return (
    <POSLayout title="Pengaturan" subtitle="Konfigurasi usaha, outlet, dan profil sistem">
      <Tabs defaultValue="usaha">
        <TabsList className="mb-4">
          <TabsTrigger value="usaha">Profil Usaha</TabsTrigger>
          <TabsTrigger value="outlet">Outlet</TabsTrigger>
          <TabsTrigger value="master">Master Data</TabsTrigger>
          <TabsTrigger value="struk">Pengaturan Struk</TabsTrigger>
        </TabsList>

        <TabsContent value="usaha">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Informasi Usaha
              </CardTitle>
              <CardDescription>Data ini tampil di struk, laporan, dan profil sistem.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isNewTenant && !tenant && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  Anda belum memiliki usaha. Isi data di bawah untuk membuat usaha baru.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nama Usaha *</Label>
                  <Input className="mt-1" value={tenantForm.name} onChange={e => setTenantForm(p => ({ ...p, name: e.target.value }))} placeholder="Nama usaha Anda" />
                </div>
                <div>
                  <Label>Nomor Telepon</Label>
                  <Input className="mt-1" value={tenantForm.phone} onChange={e => setTenantForm(p => ({ ...p, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
                </div>
              </div>
              <div>
                <Label>Alamat Usaha</Label>
                <Textarea className="mt-1" value={tenantForm.address} onChange={e => setTenantForm(p => ({ ...p, address: e.target.value }))} rows={2} placeholder="Alamat lengkap usaha" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Zona Waktu</Label>
                  <Select value={tenantForm.timezone} onValueChange={v => setTenantForm(p => ({ ...p, timezone: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Jakarta">WIB (Asia/Jakarta)</SelectItem>
                      <SelectItem value="Asia/Makassar">WITA (Asia/Makassar)</SelectItem>
                      <SelectItem value="Asia/Jayapura">WIT (Asia/Jayapura)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mata Uang</Label>
                  <Select value={tenantForm.currency} onValueChange={v => setTenantForm(p => ({ ...p, currency: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IDR">IDR — Rupiah Indonesia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveTenant} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outlet">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Daftar Outlet</h3>
                <p className="text-sm text-muted-foreground">{outlets.length} outlet terdaftar</p>
              </div>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAddOutlet} disabled={!tenant}>
                <Plus className="h-4 w-4 mr-1" />Tambah Outlet
              </Button>
            </div>
            {outlets.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <Store className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada outlet. Simpan profil usaha terlebih dahulu.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {outlets.map(o => (
                  <Card key={o.id} className={`border shadow-sm ${!(o as any).is_active ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Store className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{o.name}</span>
                          {!(o as any).is_active && <Badge variant="outline" className="text-xs">Nonaktif</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                          {(o as any).phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{(o as any).phone}</p>}
                          {(o as any).address && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{(o as any).address}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={(o as any).is_active !== false} onCheckedChange={() => toggleOutlet(o as any)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditOutlet(o as any)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="master">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Manajemen Brand</CardTitle>
                  <CardDescription>Brand/merek produk yang dijual di toko.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setBrandDialogOpen(true)} disabled={!tenant}>
                  <Plus className="h-4 w-4 mr-1" />Tambah Brand
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {brands.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Belum ada brand. Tambahkan brand produk Anda.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {brands.map(b => (
                    <div key={b.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm">
                      <span>{b.name}</span>
                      <button onClick={() => deleteBrand(b.id)} className="text-muted-foreground hover:text-destructive ml-1">×</button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="struk">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Pengaturan Struk</CardTitle>
              <CardDescription>Header dan footer yang muncul di struk cetak.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Header Struk</Label>
                <Textarea className="mt-1" value={tenantForm.receipt_header} onChange={e => setTenantForm(p => ({ ...p, receipt_header: e.target.value }))} rows={3} placeholder="Teks header struk (opsional)&#10;Contoh: Terima kasih telah berbelanja!" />
              </div>
              <div>
                <Label>Footer Struk</Label>
                <Textarea className="mt-1" value={tenantForm.receipt_footer} onChange={e => setTenantForm(p => ({ ...p, receipt_footer: e.target.value }))} rows={3} placeholder="Teks footer struk (opsional)&#10;Contoh: Barang yang sudah dibeli tidak dapat dikembalikan" />
              </div>
              <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Preview Struk</p>
                <div className="font-mono text-xs space-y-1 text-center">
                  <p className="font-bold text-sm">{tenantForm.name || 'Nama Usaha'}</p>
                  {tenantForm.phone && <p>{tenantForm.phone}</p>}
                  {tenantForm.address && <p>{tenantForm.address}</p>}
                  <div className="border-t border-dashed my-2" />
                  {tenantForm.receipt_header && <p className="text-muted-foreground">{tenantForm.receipt_header}</p>}
                  <div className="border-t border-dashed my-2" />
                  <p className="text-left">Produk A          Rp 15.000</p>
                  <p className="text-left">Produk B x2       Rp 20.000</p>
                  <div className="border-t border-dashed my-2" />
                  <p className="font-bold">Total             Rp 35.000</p>
                  <div className="border-t border-dashed my-2" />
                  {tenantForm.receipt_footer && <p className="text-muted-foreground">{tenantForm.receipt_footer}</p>}
                </div>
              </div>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveTenant} disabled={saving || !tenant}>
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan Struk'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={outletDialog} onOpenChange={setOutletDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOutlet ? 'Edit Outlet' : 'Tambah Outlet Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nama Outlet *</Label>
              <Input className="mt-1" value={outletForm.name} onChange={e => setOutletForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Cabang Selatan" />
            </div>
            <div>
              <Label>Nomor Telepon</Label>
              <Input className="mt-1" value={outletForm.phone} onChange={e => setOutletForm(p => ({ ...p, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
            </div>
            <div>
              <Label>Alamat</Label>
              <Textarea className="mt-1" value={outletForm.address} onChange={e => setOutletForm(p => ({ ...p, address: e.target.value }))} rows={2} placeholder="Alamat outlet" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutletDialog(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveOutlet}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Tambah Brand</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Nama Brand</Label>
            <Input className="mt-1" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Contoh: Indomie, Aqua, Nestle" onKeyDown={e => e.key === 'Enter' && addBrand()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrandDialogOpen(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={addBrand}>Tambah</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
