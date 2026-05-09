import { useState } from 'react';
import {
  Clock, Plus, Edit2, Trash2, Eye, EyeOff, CalendarCheck,
  ChefHat, Users, AlarmClock, CheckCircle2, XCircle, Phone,
  Save, LayoutGrid, Calendar
} from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Status konfigurasi / Status config
const RESERVATION_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Menunggu',   color: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Dikonfirmasi', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
  completed: { label: 'Selesai',    color: 'bg-gray-100 text-gray-600' },
};

interface TableConfig {
  id: string;
  number: string;
  capacity: number;
  type: string;
  is_available: boolean;
}

interface Reservation {
  id: string;
  table_id: string | null;
  buyer_id: string;
  date: string;
  time_slot: string;
  persons: number;
  status: string;
  notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  special_request: string | null;
  created_at: string;
  table?: TableConfig;
  buyer_name?: string;
}

interface PreOrderItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  min_lead_days: number;
  max_quantity: number | null;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
}

const emptyPreOrder = (): Partial<PreOrderItem> => ({
  name: '', description: '', price: 0, min_lead_days: 1, max_quantity: null, is_active: true,
});

export default function MerchantPreOrderPage() {
  const { merchantId, loading: guardLoading } = useMerchantGuard();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('reservasi');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<PreOrderItem> | null>(null);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Partial<TableConfig> | null>(null);
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Ambil reservasi / Fetch reservations
  const { data: reservations = [], isLoading: resLoading } = useQuery<Reservation[]>({
    queryKey: ['merchant-reservations', merchantId, dateFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table_reservations')
        .select('*')
        .eq('merchant_id', merchantId!)
        .eq('date', dateFilter)
        .order('time_slot');
      if (error) throw error;

      // Enrich dengan nama buyer / Enrich with buyer name
      const buyerIds = [...new Set((data || []).map((r: any) => r.buyer_id))];
      let buyerMap: Record<string, string> = {};
      if (buyerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', buyerIds);
        buyerMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name || 'Pelanggan']));
      }

      return (data || []).map((r: any) => ({
        ...r,
        buyer_name: r.contact_name || buyerMap[r.buyer_id] || 'Pelanggan',
      }));
    },
    enabled: !!merchantId && !guardLoading && activeTab === 'reservasi',
    staleTime: 15_000,
  });

  // Ambil meja / Fetch tables
  const { data: tables = [] } = useQuery<TableConfig[]>({
    queryKey: ['merchant-tables', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_tables')
        .select('*')
        .eq('merchant_id', merchantId!)
        .order('number');
      if (error) throw error;
      return (data || []) as TableConfig[];
    },
    enabled: !!merchantId && !guardLoading,
    staleTime: 60_000,
  });

  // Ambil item pre-order / Fetch pre-order items
  const { data: preOrders = [], isLoading: poLoading } = useQuery<PreOrderItem[]>({
    queryKey: ['merchant-preorders', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preorder_items')
        .select('*')
        .eq('merchant_id', merchantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PreOrderItem[];
    },
    enabled: !!merchantId && !guardLoading && activeTab === 'preorder',
    staleTime: 30_000,
  });

  // Update status reservasi / Update reservation status
  const updateResMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('table_reservations').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status reservasi diperbarui');
      queryClient.invalidateQueries({ queryKey: ['merchant-reservations'] });
    },
  });

  // Simpan pre-order item / Save pre-order item
  const savePoMutation = useMutation({
    mutationFn: async (item: Partial<PreOrderItem>) => {
      const payload = { merchant_id: merchantId, ...item };
      if ((item as any).id) {
        const { error } = await supabase.from('preorder_items').update(payload).eq('id', (item as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('preorder_items').insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Item pre-order disimpan');
      setDialogOpen(false);
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ['merchant-preorders'] });
    },
    onError: (e: any) => toast.error('Gagal: ' + e.message),
  });

  // Simpan meja / Save table
  const saveTableMutation = useMutation({
    mutationFn: async (table: Partial<TableConfig>) => {
      const payload = { merchant_id: merchantId, ...table };
      if ((table as any).id) {
        const { error } = await supabase.from('merchant_tables').update(payload).eq('id', (table as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('merchant_tables').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Meja disimpan');
      setTableDialogOpen(false);
      setEditingTable(null);
      queryClient.invalidateQueries({ queryKey: ['merchant-tables'] });
    },
  });

  if (guardLoading) {
    return (
      <MerchantLayout title="Pre-order & Reservasi" subtitle="Kelola pesanan di muka dan reservasi meja">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Pre-order & Reservasi" subtitle="Kelola pesanan di muka dan reservasi meja restoran">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="reservasi"><CalendarCheck className="h-3.5 w-3.5 mr-1.5" />Reservasi Meja</TabsTrigger>
          <TabsTrigger value="preorder"><Clock className="h-3.5 w-3.5 mr-1.5" />Item Pre-order</TabsTrigger>
          <TabsTrigger value="meja"><LayoutGrid className="h-3.5 w-3.5 mr-1.5" />Kelola Meja</TabsTrigger>
        </TabsList>

        {/* ===== RESERVASI MEJA ===== */}
        <TabsContent value="reservasi">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="h-8 w-40 text-sm"
              />
            </div>
            <Badge variant="outline" className="text-xs">
              {reservations.length} reservasi
            </Badge>
            <div className="ml-auto flex gap-2">
              {Object.entries(RESERVATION_STATUS).map(([k, v]) => (
                <span key={k} className="text-xs flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${v.color.split(' ')[0]}`} />
                  {v.label} ({reservations.filter(r => r.status === k).length})
                </span>
              ))}
            </div>
          </div>

          {resLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CalendarCheck className="h-14 w-14 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Tidak ada reservasi untuk tanggal ini</p>
              <p className="text-sm">Reservasi dari pelanggan akan muncul di sini</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map(res => {
                const st = RESERVATION_STATUS[res.status] || RESERVATION_STATUS['pending'];
                return (
                  <Card key={res.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-medium text-sm">{res.contact_name || res.buyer_name}</p>
                            <Badge className={`text-xs border-0 ${st.color}`}>{st.label}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <AlarmClock className="h-3 w-3" /> {res.time_slot}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> {res.persons} orang
                            </span>
                            {res.contact_phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {res.contact_phone}
                              </span>
                            )}
                          </div>
                          {res.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{res.notes}"</p>}
                        </div>
                        {res.status === 'pending' && (
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700 border-emerald-300"
                              onClick={() => updateResMutation.mutate({ id: res.id, status: 'confirmed' })}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Konfirmasi
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300"
                              onClick={() => updateResMutation.mutate({ id: res.id, status: 'cancelled' })}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Tolak
                            </Button>
                          </div>
                        )}
                        {res.status === 'confirmed' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                            onClick={() => updateResMutation.mutate({ id: res.id, status: 'completed' })}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Selesai
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== ITEM PRE-ORDER ===== */}
        <TabsContent value="preorder">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              Item pre-order membutuhkan pemesanan beberapa hari sebelumnya (kue ulang tahun, katering, dll).
            </p>
            <Button size="sm" onClick={() => { setEditingItem(emptyPreOrder()); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Item
            </Button>
          </div>

          {poLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1,2].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : preOrders.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <ChefHat className="h-14 w-14 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Belum ada item pre-order</p>
              <p className="text-sm mb-4">Tambahkan produk khusus yang memerlukan pemesanan di muka</p>
              <Button onClick={() => { setEditingItem(emptyPreOrder()); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Tambah Item Pre-order
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {preOrders.map(item => (
                <Card key={item.id} className={!item.is_active ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <Badge className={`text-xs border-0 ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                            {item.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{formatPrice(item.price)}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Min. {item.min_lead_days} hari sebelumnya
                          </span>
                          {item.max_quantity && <span>Maks. {item.max_quantity}/hari</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingItem(item); setDialogOpen(true); }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== KELOLA MEJA ===== */}
        <TabsContent value="meja">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">Atur denah meja restoran/warung Anda.</p>
            <Button size="sm" onClick={() => { setEditingTable({ number: '', capacity: 4, type: 'indoor', is_available: true }); setTableDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Meja
            </Button>
          </div>
          {tables.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <LayoutGrid className="h-14 w-14 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Belum ada meja terdaftar</p>
              <Button className="mt-3" onClick={() => { setEditingTable({ number: '', capacity: 4, type: 'indoor', is_available: true }); setTableDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Tambah Meja
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {tables.map(table => (
                <Card
                  key={table.id}
                  className={`text-center cursor-pointer hover:shadow-md transition-shadow ${!table.is_available ? 'opacity-60 bg-red-50' : 'bg-emerald-50'}`}
                  onClick={() => { setEditingTable(table); setTableDialogOpen(true); }}
                >
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold">{table.number}</p>
                    <p className="text-xs text-muted-foreground">{table.capacity} kursi</p>
                    <Badge className={`mt-1 text-[10px] border-0 ${table.is_available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {table.is_available ? 'Tersedia' : 'Penuh'}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{table.type}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Pre-order Item */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); setEditingItem(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{(editingItem as any)?.id ? 'Edit Item Pre-order' : 'Tambah Item Pre-order'}</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-3 mt-2">
              <div className="space-y-1">
                <Label className="text-sm">Nama Produk *</Label>
                <Input placeholder="Misal: Kue Ulang Tahun Custom" value={editingItem.name || ''} onChange={e => setEditingItem(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Deskripsi</Label>
                <Textarea placeholder="Deskripsi detail produk..." value={editingItem.description || ''} onChange={e => setEditingItem(p => ({ ...p, description: e.target.value }))} rows={2} className="resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Harga *</Label>
                  <Input type="number" min={0} placeholder="0" value={editingItem.price || ''} onChange={e => setEditingItem(p => ({ ...p, price: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Min. Hari Sebelumnya *</Label>
                  <Input type="number" min={1} max={30} value={editingItem.min_lead_days || 1} onChange={e => setEditingItem(p => ({ ...p, min_lead_days: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Maks. Kuantitas per Hari (opsional)</Label>
                <Input type="number" min={1} placeholder="Kosongkan = tidak terbatas" value={editingItem.max_quantity || ''} onChange={e => setEditingItem(p => ({ ...p, max_quantity: Number(e.target.value) || null }))} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editingItem.is_active ?? true} onCheckedChange={v => setEditingItem(p => ({ ...p, is_active: v }))} />
                <Label className="text-sm">Item aktif dan bisa dipesan</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingItem(null); }}>Batal</Button>
            <Button onClick={() => savePoMutation.mutate(editingItem!)} disabled={!editingItem?.name || !editingItem?.price || savePoMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> {savePoMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Meja */}
      <Dialog open={tableDialogOpen} onOpenChange={open => { if (!open) { setTableDialogOpen(false); setEditingTable(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{(editingTable as any)?.id ? 'Edit Meja' : 'Tambah Meja'}</DialogTitle>
          </DialogHeader>
          {editingTable && (
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Nomor Meja *</Label>
                  <Input placeholder="A1" value={editingTable.number || ''} onChange={e => setEditingTable(p => ({ ...p, number: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Kapasitas *</Label>
                  <Input type="number" min={1} max={20} value={editingTable.capacity || 4} onChange={e => setEditingTable(p => ({ ...p, capacity: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Tipe</Label>
                <Select value={editingTable.type || 'indoor'} onValueChange={v => setEditingTable(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="outdoor">Outdoor</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="private">Private Room</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editingTable.is_available ?? true} onCheckedChange={v => setEditingTable(p => ({ ...p, is_available: v }))} />
                <Label className="text-sm">Meja tersedia</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTableDialogOpen(false); setEditingTable(null); }}>Batal</Button>
            <Button onClick={() => saveTableMutation.mutate(editingTable!)} disabled={!editingTable?.number || saveTableMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> {saveTableMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
