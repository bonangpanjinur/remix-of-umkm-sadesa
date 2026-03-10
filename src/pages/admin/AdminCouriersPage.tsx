import { useState, useEffect } from 'react';
import { Bike, Check, X, MoreHorizontal, Edit, Trash2, RefreshCw, UserCheck } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddCourierDialog } from '@/components/admin/AddCourierDialog';
import { CourierEditDialog } from '@/components/admin/CourierEditDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { approveCourier, rejectCourier } from '@/lib/adminApi';

interface CourierRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string;
  district: string;
  subdistrict: string;
  province: string;
  address: string;
  ktp_number: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  registration_status: string;
  status: string;
  is_available: boolean;
  registered_at: string | null;
  last_location_update: string | null;
  village_id: string | null;
  user_id: string | null;
  villages?: { name: string } | null;
  // Enriched fields
  owner_name: string | null;
  owner_phone: string | null;
}

export default function AdminCouriersPage() {
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourier, setSelectedCourier] = useState<CourierRow | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchCouriers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('couriers')
        .select(`
          id, name, phone, email, city, district, subdistrict, province, address,
          ktp_number, vehicle_type, vehicle_plate, registration_status, 
          status, is_available, registered_at, last_location_update, village_id, user_id,
          villages(name)
        `)
        .order('registered_at', { ascending: false });

      if (error) throw error;
      
      // Enrich with profile info for linked users
      const rawCouriers = data || [];
      const userIds = rawCouriers.filter(c => c.user_id).map(c => c.user_id!);
      
      let profileMap = new Map<string, { full_name: string | null; phone: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', userIds);
        
        for (const p of (profiles || [])) {
          profileMap.set(p.user_id, { full_name: p.full_name, phone: p.phone });
        }
      }

      const enriched: CourierRow[] = rawCouriers.map(c => ({
        ...c,
        owner_name: c.user_id ? (profileMap.get(c.user_id)?.full_name || null) : null,
        owner_phone: c.user_id ? (profileMap.get(c.user_id)?.phone || null) : null,
      }));
      
      setCouriers(enriched);
    } catch (error: any) {
      console.error('Error fetching couriers:', error);
      toast.error('Gagal memuat data kurir: ' + (error.message || 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCouriers();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const success = await approveCourier(id);
      if (success) { toast.success('Kurir berhasil disetujui'); fetchCouriers(); }
      else toast.error('Gagal menyetujui kurir');
    } catch { toast.error('Terjadi kesalahan saat menyetujui kurir'); }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Alasan penolakan:');
    if (reason === null) return;
    if (!reason.trim()) { toast.error('Alasan penolakan wajib diisi'); return; }
    try {
      const success = await rejectCourier(id, reason);
      if (success) { toast.success('Kurir ditolak'); fetchCouriers(); }
      else toast.error('Gagal menolak kurir');
    } catch { toast.error('Terjadi kesalahan saat menolak kurir'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus kurir ini?')) return;
    try {
      // Check if courier has orders
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('courier_id', id);

      if (count && count > 0) {
        // Soft delete: deactivate instead
        const { error } = await supabase
          .from('couriers')
          .update({ status: 'INACTIVE', is_available: false, registration_status: 'REJECTED', rejection_reason: 'Dihapus oleh admin' })
          .eq('id', id);
        if (error) throw error;
        toast.success('Kurir dinonaktifkan (memiliki riwayat order)');
      } else {
        const { error } = await supabase.from('couriers').delete().eq('id', id);
        if (error) throw error;
        toast.success('Kurir berhasil dihapus');
      }
      fetchCouriers();
    } catch (error: any) {
      toast.error('Gagal menghapus kurir: ' + (error.message || 'Terjadi kesalahan'));
    }
  };

  const getStatusBadge = (regStatus: string, status: string, isAvailable: boolean) => {
    if (regStatus === 'PENDING') return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Menunggu</Badge>;
    if (regStatus === 'REJECTED') return <Badge variant="destructive">Ditolak</Badge>;
    if (status === 'ACTIVE' && isAvailable) return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Online</Badge>;
    if (status === 'ACTIVE') return <Badge variant="outline" className="text-muted-foreground">Offline</Badge>;
    return <Badge variant="outline" className="bg-slate-100 text-slate-500">Nonaktif</Badge>;
  };

  const columns = [
    {
      key: 'name',
      header: 'Nama Kurir',
      render: (item: CourierRow) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{item.name}</span>
          <span className="text-xs text-muted-foreground">{item.email || '-'}</span>
          {item.villages?.name && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full w-fit mt-1">
              {item.villages.name}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Akun User',
      render: (item: CourierRow) => (
        <div className="text-sm">
          {item.owner_name ? (
            <div className="flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-primary">{item.owner_name}</p>
                {item.owner_phone && <p className="text-xs text-muted-foreground">{item.owner_phone}</p>}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground italic text-xs">Belum terhubung</span>
          )}
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'Kendaraan',
      render: (item: CourierRow) => (
        <div className="flex flex-col">
          <span className="capitalize text-sm font-medium">{item.vehicle_type}</span>
          <span className="text-xs text-muted-foreground font-mono">{item.vehicle_plate || '-'}</span>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Lokasi',
      render: (item: CourierRow) => (
        <div className="flex flex-col">
          <span className="text-sm">{item.district}</span>
          <span className="text-xs text-muted-foreground">{item.city}</span>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Telepon',
      render: (item: CourierRow) => (
        <a href={`https://wa.me/${item.phone.replace(/^0/, '62')}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
          {item.phone}
        </a>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: CourierRow) => getStatusBadge(item.registration_status, item.status, item.is_available),
    },
    {
      key: 'last_active',
      header: 'Terakhir Aktif',
      render: (item: CourierRow) => {
        if (!item.last_location_update) return <span className="text-muted-foreground text-xs">-</span>;
        const date = new Date(item.last_location_update);
        const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diffMinutes < 5) return <span className="text-emerald-600 font-medium text-xs">Baru saja</span>;
        if (diffMinutes < 60) return <span className="text-xs">{diffMinutes} menit lalu</span>;
        if (diffMinutes < 1440) return <span className="text-xs">{Math.floor(diffMinutes / 60)} jam lalu</span>;
        return <span className="text-xs">{date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (item: CourierRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => { setSelectedCourier(item); setEditDialogOpen(true); }}>
              <Edit className="h-4 w-4 mr-2 text-blue-500" />Edit Data
            </DropdownMenuItem>
            {item.registration_status === 'PENDING' && (
              <>
                <DropdownMenuItem onClick={() => handleApprove(item.id)} className="text-emerald-600 focus:text-emerald-600">
                  <Check className="h-4 w-4 mr-2" />Setujui Kurir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleReject(item.id)} className="text-amber-600 focus:text-amber-600">
                  <X className="h-4 w-4 mr-2" />Tolak Kurir
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Hapus Kurir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filters = [
    {
      key: 'registration_status',
      label: 'Status Registrasi',
      options: [
        { value: 'PENDING', label: 'Menunggu' },
        { value: 'APPROVED', label: 'Disetujui' },
        { value: 'REJECTED', label: 'Ditolak' },
      ],
    },
    {
      key: 'vehicle_type',
      label: 'Kendaraan',
      options: [
        { value: 'motor', label: 'Motor' },
        { value: 'mobil', label: 'Mobil' },
        { value: 'sepeda', label: 'Sepeda' },
      ],
    },
    {
      key: 'status',
      label: 'Status Akun',
      options: [
        { value: 'ACTIVE', label: 'Aktif' },
        { value: 'INACTIVE', label: 'Nonaktif' },
      ],
    },
  ];

  return (
    <AdminLayout title="Manajemen Kurir" subtitle="Kelola dan verifikasi semua kurir yang terdaftar di platform">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Bike className="h-6 w-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-bold">Daftar Kurir</h2>
            <span className="text-muted-foreground text-xs">
              {couriers.length} kurir terdaftar • {couriers.filter(c => c.is_available).length} online
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCouriers} disabled={loading} className="h-9">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <AddCourierDialog onSuccess={fetchCouriers} />
        </div>
      </div>

      <DataTable
        data={couriers}
        columns={columns}
        searchKeys={['name', 'phone', 'email', 'district', 'city', 'owner_name']}
        searchPlaceholder="Cari kurir (nama, telp, lokasi, user)..."
        filters={filters}
        loading={loading}
        emptyMessage="Belum ada data kurir yang sesuai kriteria"
      />

      {selectedCourier && (
        <CourierEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          courier={selectedCourier}
          onSuccess={fetchCouriers}
        />
      )}
    </AdminLayout>
  );
}
