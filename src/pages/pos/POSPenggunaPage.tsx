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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, UserCog, Shield, Eye, EyeOff } from 'lucide-react';

interface POSUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  outlet_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Outlet { id: string; name: string; }

const ROLES = [
  { value: 'owner', label: 'Owner', desc: 'Akses penuh ke semua fitur', color: 'bg-purple-100 text-purple-700' },
  { value: 'manager', label: 'Manager', desc: 'Kelola outlet, laporan, approval', color: 'bg-blue-100 text-blue-700' },
  { value: 'kasir', label: 'Kasir', desc: 'Transaksi POS dan customer dasar', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'staff_gudang', label: 'Staff Gudang', desc: 'Manajemen stok dan mutasi', color: 'bg-orange-100 text-orange-700' },
  { value: 'purchasing', label: 'Purchasing', desc: 'Purchase order dan penerimaan', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'finance', label: 'Finance', desc: 'Pembukuan, biaya, hutang piutang', color: 'bg-pink-100 text-pink-700' },
  { value: 'auditor', label: 'Auditor', desc: 'Akses baca audit log dan laporan', color: 'bg-gray-100 text-gray-700' },
];

export default function POSPenggunaPage() {
  const { tenant, outlets } = usePOS();
  const [users, setUsers] = useState<POSUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<POSUser | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'kasir', outlet_id: '', pin: '', is_active: true });

  useEffect(() => { if (tenant) fetchUsers(); }, [tenant]);

  const fetchUsers = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('pos_users' as any).select('*').eq('tenant_id', tenant.id).order('name');
    setUsers((data || []) as unknown as POSUser[]);
    setLoading(false);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', role: 'kasir', outlet_id: '', pin: '', is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (u: POSUser) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email || '', phone: u.phone || '', role: u.role, outlet_id: u.outlet_id || '', pin: '', is_active: u.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tenant) return;
    if (!form.name.trim()) { toast.error('Nama pengguna wajib diisi'); return; }
    const payload: any = {
      name: form.name.trim(), email: form.email || null, phone: form.phone || null,
      role: form.role, outlet_id: form.outlet_id || null, is_active: form.is_active, tenant_id: tenant.id,
    };
    if (form.pin) payload.pin = form.pin;
    try {
      if (editing) {
        await supabase.from('pos_users' as any).update(payload).eq('id', editing.id);
        toast.success('Data pengguna diperbarui');
      } else {
        await supabase.from('pos_users' as any).insert(payload);
        toast.success('Pengguna berhasil ditambahkan');
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getRoleInfo = (role: string) => ROLES.find(r => r.value === role) || { label: role, color: 'bg-gray-100 text-gray-700', desc: '' };
  const getOutletName = (outletId: string | null) => outlets.find(o => o.id === outletId)?.name || 'Semua Outlet';

  return (
    <POSLayout title="Manajemen Pengguna" subtitle={`${users.length} pengguna terdaftar`}
      actions={<Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Tambah Pengguna</Button>}>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map(r => (
            <div key={r.value} className="flex items-start gap-2 p-3 rounded-lg border bg-card">
              <div className={`px-2 py-0.5 rounded text-xs font-medium ${r.color} flex-shrink-0`}>{r.label}</div>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <UserCog className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">Belum Ada Pengguna</h3>
            <p className="text-sm text-muted-foreground mb-4">Tambahkan kasir, manager, atau staff untuk menggunakan sistem.</p>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Tambah Pengguna Pertama</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map(u => {
              const roleInfo = getRoleInfo(u.role);
              return (
                <Card key={u.id} className={`border shadow-sm ${!u.is_active ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${roleInfo.color}`}>
                      {u.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{u.name}</span>
                        <Badge className={`${roleInfo.color} border-0 text-xs`}>{roleInfo.label}</Badge>
                        {!u.is_active && <Badge variant="outline" className="text-xs">Nonaktif</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {u.email && <span>{u.email}</span>}
                        {u.phone && <span>{u.phone}</span>}
                        <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{getOutletName(u.outlet_id)}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pengguna' : 'Tambah Pengguna'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nama Lengkap *</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nama pengguna" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input className="mt-1" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@contoh.com" />
              </div>
              <div>
                <Label>Nomor HP</Label>
                <Input className="mt-1" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
              </div>
            </div>
            <div>
              <Label>Role / Jabatan *</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label} — {r.desc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outlet</Label>
              <Select value={form.outlet_id} onValueChange={v => setForm(p => ({ ...p, outlet_id: v === 'all' ? '' : v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Semua outlet" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Outlet</SelectItem>
                  {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>PIN Kasir {editing ? '(kosongkan jika tidak ingin ubah)' : ''}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type={showPin ? 'text' : 'password'}
                  value={form.pin}
                  onChange={e => setForm(p => ({ ...p, pin: e.target.value }))}
                  placeholder="4-6 digit PIN"
                  maxLength={6}
                  className="flex-1"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPin(!showPin)}>
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Status Aktif</Label>
                <p className="text-xs text-muted-foreground">Pengguna nonaktif tidak bisa login</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
