import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Key, Plus, Copy, Eye, EyeOff, Trash2, Activity, AlertTriangle, Code2 } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
  expires_at: string | null;
}

const ALL_PERMISSIONS = [
  { value: 'read:products', label: 'Baca Produk' },
  { value: 'read:orders', label: 'Baca Pesanan' },
  { value: 'read:merchants', label: 'Baca Merchant' },
  { value: 'write:products', label: 'Tulis Produk' },
  { value: 'write:orders', label: 'Update Pesanan' },
  { value: 'read:analytics', label: 'Baca Analitik' },
  { value: 'webhook', label: 'Webhook' },
];

function generateKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 48; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export default function AdminApiKeysPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState('');
  const [form, setForm] = useState({ name: '', permissions: ['read:products'], expires_days: '' });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    const { data } = await (supabase as any).from('api_keys').select('*').order('created_at', { ascending: false });
    setKeys((data || []) as ApiKey[]);
    setLoading(false);
  };

  const createKey = async () => {
    if (!form.name.trim()) { toast.error('Nama API key wajib diisi'); return; }
    if (form.permissions.length === 0) { toast.error('Pilih minimal 1 permission'); return; }

    const rawKey = generateKey();
    const prefix = rawKey.substring(0, 8);
    const expires_at = form.expires_days ? new Date(Date.now() + parseInt(form.expires_days) * 86400000).toISOString() : null;

    const { data, error } = await (supabase as any).from('api_keys').insert({
      name: form.name,
      key_prefix: prefix,
      key_hash: rawKey,
      user_id: user!.id,
      permissions: form.permissions,
      is_active: true,
      expires_at,
    }).select().single();

    if (error) { toast.error('Gagal membuat API key'); return; }
    setKeys(prev => [data as ApiKey, ...prev]);
    setNewKeyVisible(`dm_${rawKey}`);
    setForm({ name: '', permissions: ['read:products'], expires_days: '' });
    toast.success('API key berhasil dibuat! Salin sekarang — tidak akan ditampilkan lagi.');
  };

  const toggleActive = async (key: ApiKey) => {
    await (supabase as any).from('api_keys').update({ is_active: !key.is_active }).eq('id', key.id);
    setKeys(prev => prev.map(k => k.id === key.id ? { ...k, is_active: !k.is_active } : k));
    toast.success(key.is_active ? 'API key dinonaktifkan' : 'API key diaktifkan');
  };

  const deleteKey = async (id: string) => {
    await (supabase as any).from('api_keys').delete().eq('id', id);
    setKeys(prev => prev.filter(k => k.id !== id));
    toast.success('API key dihapus');
  };

  const togglePermission = (perm: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key disalin!');
  };

  return (
    <AdminLayout title="Manajemen API Key" subtitle="Kelola akses API publik platform DesaMart">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Key className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{keys.filter(k => k.is_active).length}</p>
                  <p className="text-xs text-muted-foreground">API Key Aktif</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{keys.reduce((s, k) => s + k.request_count, 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Request</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{keys.filter(k => k.expires_at && new Date(k.expires_at) < new Date()).length}</p>
                  <p className="text-xs text-muted-foreground">Key Kedaluwarsa</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Docs quick info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Code2 className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Cara Penggunaan API</p>
                <p className="font-mono text-xs bg-blue-100 px-2 py-1 rounded mb-1">
                  Authorization: Bearer dm_{'<your-api-key>'}
                </p>
                <p>Base URL: <span className="font-mono">/api/public/v1</span> • Endpoint: <span className="font-mono">/products, /orders, /merchants</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* New key alert */}
        {newKeyVisible && (
          <Card className="border-emerald-400 bg-emerald-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Key className="h-4 w-4 text-emerald-700" />
                <span className="font-semibold text-emerald-800 text-sm">API Key Baru — Salin Sekarang!</span>
              </div>
              <div className="flex items-center gap-2 bg-white border border-emerald-300 rounded px-3 py-2">
                <code className="text-xs flex-1 break-all text-emerald-700">{newKeyVisible}</code>
                <Button size="icon" variant="ghost" onClick={() => copyKey(newKeyVisible)} className="shrink-0 h-7 w-7 text-emerald-700">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-emerald-600 mt-1">⚠ Key tidak akan ditampilkan lagi setelah halaman ini ditutup.</p>
              <Button variant="ghost" size="sm" onClick={() => setNewKeyVisible('')} className="mt-1 text-emerald-600">Tutup</Button>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Buat API Key Baru
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Terakhir Digunakan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Belum ada API key. Buat key pertama untuk mengakses API publik.
                    </TableCell>
                  </TableRow>
                ) : keys.map(k => {
                  const isExpired = k.expires_at && new Date(k.expires_at) < new Date();
                  return (
                    <TableRow key={k.id} className={isExpired ? 'opacity-60' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{k.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Dibuat {format(new Date(k.created_at), 'd MMM yyyy', { locale: idLocale })}
                          </p>
                          {k.expires_at && (
                            <p className={`text-xs ${isExpired ? 'text-red-500' : 'text-amber-600'}`}>
                              {isExpired ? '⚠ Kedaluwarsa' : `Exp: ${format(new Date(k.expires_at), 'd MMM yyyy', { locale: idLocale })}`}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          dm_{k.key_prefix}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {k.permissions.slice(0, 3).map(p => (
                            <Badge key={p} variant="outline" className="text-xs px-1">{p}</Badge>
                          ))}
                          {k.permissions.length > 3 && (
                            <Badge variant="outline" className="text-xs px-1">+{k.permissions.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{k.request_count.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {k.last_used_at
                          ? format(new Date(k.last_used_at), 'd MMM yyyy', { locale: idLocale })
                          : 'Belum digunakan'}
                      </TableCell>
                      <TableCell>
                        <Switch checked={k.is_active && !isExpired} onCheckedChange={() => !isExpired && toggleActive(k)} disabled={!!isExpired} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => deleteKey(k.id)} className="h-7 w-7 text-red-500 hover:text-red-700">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat API Key Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nama API Key *</Label>
                <Input placeholder="Contoh: Integrasi Akuntansi" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="mb-2 block">Permissions *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map(p => (
                    <div key={p.value} className="flex items-center gap-2">
                      <Checkbox
                        id={p.value}
                        checked={form.permissions.includes(p.value)}
                        onCheckedChange={() => togglePermission(p.value)}
                      />
                      <label htmlFor={p.value} className="text-sm cursor-pointer">{p.label}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label>Kedaluwarsa (hari, opsional)</Label>
                <Input
                  type="number"
                  placeholder="Contoh: 365 (kosongkan = tidak ada batas)"
                  value={form.expires_days}
                  onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button onClick={createKey}><Key className="h-4 w-4 mr-2" /> Buat API Key</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
