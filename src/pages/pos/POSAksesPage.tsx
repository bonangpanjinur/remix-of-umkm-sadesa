import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  UserCog, Plus, RefreshCw, AlertCircle, Store, Shield,
  Users, Key, CheckCircle, XCircle, Edit2, Trash2, Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface POSUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
  outlet_id: string | null;
  is_active: boolean;
  pin: string | null;
  created_at: string;
}

interface OutletAccess {
  id: string;
  pos_user_id: string;
  outlet_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  pos_users?: { name: string; email: string | null };
  pos_outlets?: { name: string };
}

const ROLES = [
  { value: 'owner', label: 'Pemilik', color: 'bg-purple-100 text-purple-700', desc: 'Akses penuh ke semua fitur' },
  { value: 'manager', label: 'Manajer', color: 'bg-blue-100 text-blue-700', desc: 'Kelola operasional & laporan' },
  { value: 'kasir', label: 'Kasir', color: 'bg-emerald-100 text-emerald-700', desc: 'Hanya kasir & transaksi' },
  { value: 'staff_gudang', label: 'Staff Gudang', color: 'bg-teal-100 text-teal-700', desc: 'Manajemen stok & produk' },
  { value: 'purchasing', label: 'Purchasing', color: 'bg-orange-100 text-orange-700', desc: 'Pembelian & supplier' },
  { value: 'finance', label: 'Finance', color: 'bg-yellow-100 text-yellow-700', desc: 'Laporan & kas keuangan' },
  { value: 'auditor', label: 'Auditor', color: 'bg-gray-100 text-gray-700', desc: 'Hanya lihat (read-only)' },
];

export default function POSAksesPage() {
  const { tenant, outlets, activeOutlet } = usePOS();
  const { user } = useAuth();

  const [posUsers, setPosUsers] = useState<POSUser[]>([]);
  const [outletAccess, setOutletAccess] = useState<OutletAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userDialog, setUserDialog] = useState(false);
  const [accessDialog, setAccessDialog] = useState(false);
  const [pinDialog, setPinDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<POSUser | null>(null);

  const [userForm, setUserForm] = useState({
    name: '', email: '', role: 'kasir', outlet_id: '', is_active: true,
  });
  const [accessForm, setAccessForm] = useState({
    pos_user_id: '', outlet_id: '', role: 'kasir',
  });
  const [pinForm, setPinForm] = useState({ pos_user_id: '', new_pin: '', confirm_pin: '' });
  const [filterOutlet, setFilterOutlet] = useState('all');

  const fetchAll = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [usersRes, accessRes] = await Promise.all([
        supabase.from('pos_users' as any)
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('name'),
        supabase.from('pos_user_outlet_access' as any)
          .select('*, pos_users(name, email), pos_outlets(name)')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false }),
      ]);
      setPosUsers((usersRes.data || []) as unknown as POSUser[]);
      setOutletAccess((accessRes.data || []) as unknown as OutletAccess[]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({ name: '', email: '', role: 'kasir', outlet_id: activeOutlet?.id || '', is_active: true });
    setUserDialog(true);
  };

  const openEditUser = (u: POSUser) => {
    setEditingUser(u);
    setUserForm({ name: u.name, email: u.email || '', role: u.role, outlet_id: u.outlet_id || '', is_active: u.is_active });
    setUserDialog(true);
  };

  const saveUser = async () => {
    if (!tenant || !userForm.name.trim()) { toast.error('Nama wajib diisi'); return; }
    setSaving(true);
    try {
      if (editingUser) {
        const { error } = await supabase.from('pos_users' as any)
          .update({
            name: userForm.name, email: userForm.email || null,
            role: userForm.role, outlet_id: userForm.outlet_id || null,
            is_active: userForm.is_active, updated_at: new Date().toISOString(),
          }).eq('id', editingUser.id);
        if (error) throw error;
        toast.success('Pengguna diperbarui');
      } else {
        const { error } = await supabase.from('pos_users' as any).insert({
          tenant_id: tenant.id, name: userForm.name,
          email: userForm.email || null, role: userForm.role,
          outlet_id: userForm.outlet_id || null, is_active: true,
        });
        if (error) throw error;
        toast.success('Pengguna ditambahkan');
      }
      setUserDialog(false);
      fetchAll();
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + err.message);
    } finally { setSaving(false); }
  };

  const toggleUserActive = async (u: POSUser) => {
    await supabase.from('pos_users' as any)
      .update({ is_active: !u.is_active }).eq('id', u.id);
    toast.success(`Pengguna ${u.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
    fetchAll();
  };

  const deleteUser = async (u: POSUser) => {
    if (!confirm(`Hapus pengguna "${u.name}"? Aksi ini tidak bisa dibatalkan.`)) return;
    const { error } = await supabase.from('pos_users' as any).delete().eq('id', u.id);
    if (error) { toast.error('Gagal hapus: ' + error.message); return; }
    toast.success('Pengguna dihapus');
    fetchAll();
  };

  const saveAccess = async () => {
    if (!tenant || !accessForm.pos_user_id || !accessForm.outlet_id) {
      toast.error('Pilih pengguna dan outlet'); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('pos_user_outlet_access' as any).upsert({
        tenant_id: tenant.id, pos_user_id: accessForm.pos_user_id,
        outlet_id: accessForm.outlet_id, role: accessForm.role,
        is_active: true, granted_by: user?.id,
      }, { onConflict: 'pos_user_id,outlet_id' });
      if (error) throw error;
      toast.success('Akses outlet diberikan');
      setAccessDialog(false);
      fetchAll();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally { setSaving(false); }
  };

  const revokeAccess = async (acc: OutletAccess) => {
    await supabase.from('pos_user_outlet_access' as any)
      .update({ is_active: false }).eq('id', acc.id);
    toast.success('Akses dicabut');
    fetchAll();
  };

  const openSetPin = (u: POSUser) => {
    setPinForm({ pos_user_id: u.id, new_pin: '', confirm_pin: '' });
    setPinDialog(true);
  };

  const savePin = async () => {
    if (!pinForm.new_pin || pinForm.new_pin.length < 4) { toast.error('PIN minimal 4 digit'); return; }
    if (pinForm.new_pin !== pinForm.confirm_pin) { toast.error('Konfirmasi PIN tidak cocok'); return; }
    if (!/^\d+$/.test(pinForm.new_pin)) { toast.error('PIN hanya boleh berisi angka'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('pos_users' as any)
        .update({ pin: pinForm.new_pin }).eq('id', pinForm.pos_user_id);
      if (error) throw error;
      toast.success('PIN kasir berhasil diperbarui');
      setPinDialog(false);
      fetchAll();
    } catch (err: any) {
      toast.error('Gagal set PIN: ' + err.message);
    } finally { setSaving(false); }
  };

  const getRoleCfg = (role: string) => ROLES.find(r => r.value === role) || ROLES[2];

  const filteredAccess = outletAccess.filter(a =>
    filterOutlet === 'all' || a.outlet_id === filterOutlet
  );

  const activeUsersCount = posUsers.filter(u => u.is_active).length;
  const withPinCount = posUsers.filter(u => u.pin).length;

  if (!tenant) return (
    <POSLayout><div className="flex items-center justify-center h-64"><AlertCircle className="h-8 w-8 text-muted-foreground" /></div></POSLayout>
  );

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Manajemen Akses & Pengguna</h1>
            <p className="text-muted-foreground text-sm">Kelola pengguna POS dan hak akses per outlet</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-blue-600" /><span className="text-xs text-muted-foreground">Total Pengguna</span></div>
              <p className="font-bold text-2xl">{posUsers.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-emerald-600" /><span className="text-xs text-muted-foreground">Pengguna Aktif</span></div>
              <p className="font-bold text-2xl text-emerald-600">{activeUsersCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Key className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Ada PIN Kasir</span></div>
              <p className="font-bold text-2xl">{withPinCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Store className="h-4 w-4 text-purple-600" /><span className="text-xs text-muted-foreground">Akses Outlet</span></div>
              <p className="font-bold text-2xl">{outletAccess.filter(a => a.is_active).length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Pengguna POS</TabsTrigger>
            <TabsTrigger value="access">Akses Per Outlet</TabsTrigger>
            <TabsTrigger value="roles">Panduan Role</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Daftar Pengguna POS</CardTitle>
                  <Button onClick={openCreateUser} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-1" /> Tambah Pengguna
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Memuat...</div>
                ) : posUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Belum ada pengguna POS</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Outlet Utama</TableHead>
                        <TableHead>PIN</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posUsers.map(u => {
                        const roleCfg = getRoleCfg(u.role);
                        const outletName = outlets.find(o => o.id === u.outlet_id)?.name || '-';
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{u.email || '-'}</TableCell>
                            <TableCell>
                              <Badge className={`text-xs border-0 ${roleCfg.color}`}>{roleCfg.label}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{outletName}</TableCell>
                            <TableCell>
                              {u.pin ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                                  <Lock className="h-3 w-3 mr-1" />••••
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">Belum Set</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch checked={u.is_active} onCheckedChange={() => toggleUserActive(u)} />
                                <span className="text-xs text-muted-foreground">{u.is_active ? 'Aktif' : 'Nonaktif'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openSetPin(u)} title="Set PIN">
                                  <Key className="h-3.5 w-3.5 text-amber-500" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUser(u)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteUser(u)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Outlet Access Tab */}
          <TabsContent value="access">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">Akses Per Outlet</CardTitle>
                  <div className="flex gap-2">
                    {outlets.length > 1 && (
                      <Select value={filterOutlet} onValueChange={setFilterOutlet}>
                        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Outlet</SelectItem>
                          {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Button onClick={() => { setAccessForm({ pos_user_id: '', outlet_id: activeOutlet?.id || '', role: 'kasir' }); setAccessDialog(true); }}
                      size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8">
                      <Plus className="h-4 w-4 mr-1" /> Beri Akses
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {outlets.length < 2 && (
                  <Alert className="mb-4 border-blue-200 bg-blue-50">
                    <Store className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Fitur akses per outlet berguna saat Anda memiliki lebih dari 1 outlet. Tambahkan outlet di Pengaturan.
                    </AlertDescription>
                  </Alert>
                )}
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Memuat...</div>
                ) : filteredAccess.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Belum ada konfigurasi akses per outlet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pengguna</TableHead>
                        <TableHead>Outlet</TableHead>
                        <TableHead>Role di Outlet</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Diberikan</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAccess.map(acc => {
                        const roleCfg = getRoleCfg(acc.role);
                        return (
                          <TableRow key={acc.id} className={!acc.is_active ? 'opacity-50' : ''}>
                            <TableCell className="font-medium">
                              {(acc.pos_users as any)?.name || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Store className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{(acc.pos_outlets as any)?.name || '-'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs border-0 ${roleCfg.color}`}>{roleCfg.label}</Badge>
                            </TableCell>
                            <TableCell>
                              {acc.is_active ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Aktif</Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">Dicabut</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(acc.created_at), 'dd/MM/yyyy', { locale: idLocale })}
                            </TableCell>
                            <TableCell className="text-right">
                              {acc.is_active && (
                                <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs"
                                  onClick={() => revokeAccess(acc)}>
                                  <XCircle className="h-3.5 w-3.5 mr-1" />Cabut
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Role Guide Tab */}
          <TabsContent value="roles">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ROLES.map(role => (
                <Card key={role.value}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={`text-sm border-0 ${role.color}`}>{role.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{role.desc}</p>
                    <div className="mt-3 space-y-1">
                      {role.value === 'owner' && (
                        ['Semua fitur POS', 'Kelola pengguna & akses', 'Semua laporan keuangan', 'Pengaturan sistem'].map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs"><CheckCircle className="h-3 w-3 text-emerald-500" />{f}</div>
                        ))
                      )}
                      {role.value === 'manager' && (
                        ['Kasir & transaksi', 'Kelola produk & stok', 'Laporan penjualan', 'Transfer stok', 'Kas harian'].map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs"><CheckCircle className="h-3 w-3 text-emerald-500" />{f}</div>
                        ))
                      )}
                      {role.value === 'kasir' && (
                        ['Kasir & transaksi', 'Lihat produk & stok', 'Kas harian'].map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs"><CheckCircle className="h-3 w-3 text-emerald-500" />{f}</div>
                        ))
                      )}
                      {role.value === 'staff_gudang' && (
                        ['Manajemen stok', 'Transfer stok', 'Terima pembelian', 'Lihat produk'].map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs"><CheckCircle className="h-3 w-3 text-emerald-500" />{f}</div>
                        ))
                      )}
                      {role.value === 'purchasing' && (
                        ['Purchase Order', 'Supplier management', 'Terima barang', 'Laporan pembelian'].map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs"><CheckCircle className="h-3 w-3 text-emerald-500" />{f}</div>
                        ))
                      )}
                      {role.value === 'finance' && (
                        ['Kas harian', 'Laporan keuangan', 'Laporan laba rugi', 'Lihat transaksi'].map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs"><CheckCircle className="h-3 w-3 text-emerald-500" />{f}</div>
                        ))
                      )}
                      {role.value === 'auditor' && (
                        ['Lihat semua laporan', 'Audit trail', 'Tidak bisa edit data', 'Hanya read-only'].map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs"><CheckCircle className="h-3 w-3 text-gray-400" />{f}</div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Create/Edit User Dialog */}
        <Dialog open={userDialog} onOpenChange={setUserDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingUser ? `Edit Pengguna: ${editingUser.name}` : 'Tambah Pengguna POS'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Lengkap *</Label>
                <Input placeholder="Nama pengguna..." value={userForm.name}
                  onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email (opsional)</Label>
                <Input type="email" placeholder="email@contoh.com" value={userForm.email}
                  onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={userForm.role} onValueChange={v => setUserForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label} — {r.desc}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Outlet Utama</Label>
                <Select value={userForm.outlet_id} onValueChange={v => setUserForm(f => ({ ...f, outlet_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih outlet..." /></SelectTrigger>
                  <SelectContent>
                    {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUserDialog(false)}>Batal</Button>
              <Button onClick={saveUser} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Menyimpan...' : editingUser ? 'Perbarui' : 'Tambah'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Grant Access Dialog */}
        <Dialog open={accessDialog} onOpenChange={setAccessDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Beri Akses Outlet</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pengguna *</Label>
                <Select value={accessForm.pos_user_id} onValueChange={v => setAccessForm(f => ({ ...f, pos_user_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih pengguna..." /></SelectTrigger>
                  <SelectContent>
                    {posUsers.filter(u => u.is_active).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({getRoleCfg(u.role).label})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Outlet *</Label>
                <Select value={accessForm.outlet_id} onValueChange={v => setAccessForm(f => ({ ...f, outlet_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih outlet..." /></SelectTrigger>
                  <SelectContent>
                    {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role di Outlet Ini *</Label>
                <Select value={accessForm.role} onValueChange={v => setAccessForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAccessDialog(false)}>Batal</Button>
              <Button onClick={saveAccess} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Menyimpan...' : 'Beri Akses'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Set PIN Dialog */}
        <Dialog open={pinDialog} onOpenChange={setPinDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Set PIN Kasir</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">PIN digunakan kasir untuk masuk ke mode kasir tanpa email/password.</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>PIN Baru (4–6 digit angka)</Label>
                <Input type="password" inputMode="numeric" maxLength={6} placeholder="••••"
                  value={pinForm.new_pin} onChange={e => setPinForm(f => ({ ...f, new_pin: e.target.value.replace(/\D/g, '') }))} />
              </div>
              <div className="space-y-2">
                <Label>Konfirmasi PIN</Label>
                <Input type="password" inputMode="numeric" maxLength={6} placeholder="••••"
                  value={pinForm.confirm_pin} onChange={e => setPinForm(f => ({ ...f, confirm_pin: e.target.value.replace(/\D/g, '') }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPinDialog(false)}>Batal</Button>
              <Button onClick={savePin} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Menyimpan...' : 'Set PIN'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </POSLayout>
  );
}
