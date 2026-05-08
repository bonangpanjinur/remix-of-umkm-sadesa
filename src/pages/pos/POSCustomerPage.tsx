import { useState, useEffect } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Search, Pencil, Users, Phone, ShoppingBag, Crown, QrCode, Download, Star } from 'lucide-react';
import { format } from 'date-fns';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_member: boolean;
  total_purchase: number;
  transaction_count: number;
  last_purchase_at: string | null;
  notes: string | null;
  is_active: boolean;
  loyalty_points?: number;
  loyalty_tier?: string;
}

const TIER_COLORS: Record<string, string> = {
  Bronze: '#92400e',
  Silver: '#6b7280',
  Gold: '#d97706',
  Platinum: '#7c3aed',
};

export default function POSCustomerPage() {
  const { tenant, formatCurrency } = usePOS();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', is_member: false, notes: '' });

  // QR card state
  const [qrDialog, setQrDialog] = useState(false);
  const [qrCustomer, setQrCustomer] = useState<Customer | null>(null);

  useEffect(() => { if (tenant) fetchCustomers(); }, [tenant]);

  const fetchCustomers = async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('pos_customers' as any)
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('name');
    setCustomers((data || []) as unknown as Customer[]);
    setLoading(false);
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search))
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '', is_member: false, notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', is_member: c.is_member, notes: c.notes || '' });
    setDialogOpen(true);
  };

  const openQR = (c: Customer) => {
    setQrCustomer(c);
    setQrDialog(true);
  };

  const handleSave = async () => {
    if (!tenant) return;
    if (!form.name.trim()) { toast.error('Nama customer wajib diisi'); return; }
    const payload = {
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      is_member: form.is_member,
      notes: form.notes || null,
      tenant_id: tenant.id,
    };
    try {
      if (editing) {
        await supabase.from('pos_customers' as any).update(payload).eq('id', editing.id);
        toast.success('Data customer diperbarui');
      } else {
        await supabase.from('pos_customers' as any).insert(payload);
        toast.success('Customer berhasil ditambahkan');
      }
      setDialogOpen(false);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const downloadQR = () => {
    if (!qrCustomer) return;
    const svg = document.getElementById('member-qr-svg');
    if (!svg) return;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    const svgData = new XMLSerializer().serializeToString(svg);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 300, 300);
      const a = document.createElement('a');
      a.download = `kartu-member-${qrCustomer.name.replace(/\s+/g, '-')}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  // QR code data encodes tenant + customer ID for kasir scanner
  const buildQRData = (c: Customer) => JSON.stringify({
    type: 'member_card',
    tenant_id: tenant?.id,
    customer_id: c.id,
    name: c.name,
    phone: c.phone || '',
  });

  const members = customers.filter(c => c.is_member).length;
  const totalPurchase = customers.reduce((s, c) => s + (c.total_purchase || 0), 0);

  return (
    <POSLayout
      title="Manajemen Customer"
      subtitle={`${customers.length} customer terdaftar`}
      actions={
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" />Tambah Customer
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Customer</p>
              <p className="text-xl font-bold mt-1">{customers.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Member</p>
              <p className="text-xl font-bold mt-1 text-emerald-600">{members}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Belanja</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalPurchase)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari nama atau nomor HP..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">{search ? 'Customer Tidak Ditemukan' : 'Belum Ada Customer'}</h3>
            <p className="text-sm text-muted-foreground mb-4">{search ? 'Coba kata kunci lain.' : 'Tambahkan customer untuk melacak riwayat belanja.'}</p>
            {!search && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Tambah Customer</Button>}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => (
              <Card key={c.id} className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${c.is_member ? 'bg-amber-100' : 'bg-muted'}`}>
                    {c.is_member ? <Crown className="h-5 w-5 text-amber-600" /> : <span className="font-bold text-sm">{c.name[0].toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{c.name}</span>
                      {c.is_member && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Member</Badge>}
                      {c.loyalty_tier && (
                        <Badge style={{ backgroundColor: TIER_COLORS[c.loyalty_tier] || '#6b7280', color: 'white' }} className="text-xs border-0">
                          {c.loyalty_tier}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {c.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingBag className="h-3 w-3" />{c.transaction_count} transaksi</span>
                      <span className="text-xs font-medium text-emerald-600">{formatCurrency(c.total_purchase || 0)}</span>
                      {(c.loyalty_points ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />{(c.loyalty_points || 0).toLocaleString('id-ID')} poin
                        </span>
                      )}
                    </div>
                    {c.last_purchase_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">Terakhir belanja: {format(new Date(c.last_purchase_at), 'dd MMM yyyy')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {c.is_member && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Lihat kartu member" onClick={() => openQR(c)}>
                        <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ---- FORM DIALOG ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Customer' : 'Tambah Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nama Lengkap *</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nama customer" />
            </div>
            <div>
              <Label>Nomor HP</Label>
              <Input className="mt-1" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
            </div>
            <div>
              <Label>Email (opsional)</Label>
              <Input className="mt-1" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@contoh.com" />
            </div>
            <div>
              <Label>Alamat</Label>
              <Textarea className="mt-1" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} rows={2} placeholder="Alamat customer" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Status Member</Label>
                <p className="text-xs text-muted-foreground">Member mendapat benefit khusus & kartu QR</p>
              </div>
              <Switch checked={form.is_member} onCheckedChange={v => setForm(p => ({ ...p, is_member: v }))} />
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea className="mt-1" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Catatan tambahan" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- KARTU MEMBER DIGITAL / QR CODE DIALOG ---- */}
      <Dialog open={qrDialog} onOpenChange={setQrDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-emerald-600" />
              Kartu Member Digital
            </DialogTitle>
          </DialogHeader>

          {qrCustomer && (
            <div className="flex flex-col items-center gap-4 py-2">
              {/* Card visual */}
              <div className="w-full rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs opacity-70 uppercase tracking-wide">DesaMart POS</p>
                    <p className="font-bold text-lg mt-0.5">{tenant?.name || 'Member Card'}</p>
                  </div>
                  <Crown className="h-8 w-8 opacity-80" />
                </div>
                <Separator className="bg-white/20 mb-4" />
                <p className="text-xl font-bold">{qrCustomer.name}</p>
                {qrCustomer.phone && <p className="text-sm opacity-80 mt-0.5">{qrCustomer.phone}</p>}
                <div className="flex items-center justify-between mt-3">
                  <div>
                    {qrCustomer.loyalty_tier ? (
                      <Badge style={{ backgroundColor: TIER_COLORS[qrCustomer.loyalty_tier] || '#ffffff33' }} className="text-white border-0 text-xs">
                        {qrCustomer.loyalty_tier} Member
                      </Badge>
                    ) : (
                      <Badge className="bg-white/20 text-white border-0 text-xs">Member</Badge>
                    )}
                  </div>
                  {(qrCustomer.loyalty_points ?? 0) > 0 && (
                    <div className="text-right">
                      <p className="text-xs opacity-70">Poin</p>
                      <p className="font-bold text-sm">{(qrCustomer.loyalty_points || 0).toLocaleString('id-ID')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* QR Code */}
              <div className="bg-white p-4 rounded-xl shadow-sm border">
                <QRCodeSVG
                  id="member-qr-svg"
                  value={buildQRData(qrCustomer)}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Tunjukkan QR ini ke kasir saat melakukan transaksi untuk mendapatkan poin loyalty.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={downloadQR} className="flex-1">
              <Download className="h-4 w-4 mr-1" />Simpan Gambar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 flex-1" onClick={() => setQrDialog(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
