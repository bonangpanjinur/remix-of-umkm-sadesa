import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Eye, Check, X, MoreHorizontal } from 'lucide-react';
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
  vehicle_type: string;
  vehicle_plate: string | null;
  registration_status: string;
  status: string;
  is_available: boolean;
  registered_at: string | null;
  last_location_update: string | null;
}

export default function AdminCouriersPage() {
  const navigate = useNavigate();
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCouriers = async () => {
    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('id, name, phone, email, city, district, vehicle_type, vehicle_plate, registration_status, status, is_available, registered_at, last_location_update')
        .order('registered_at', { ascending: false });

      if (error) throw error;
      setCouriers(data || []);
    } catch (error) {
      console.error('Error fetching couriers:', error);
      toast.error('Gagal memuat data kurir');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCouriers();
  }, []);

  const handleApprove = async (id: string) => {
    const success = await approveCourier(id);
    if (success) {
      toast.success('Kurir berhasil disetujui');
      fetchCouriers();
    } else {
      toast.error('Gagal menyetujui kurir');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Alasan penolakan:');
    if (!reason) return;
    
    const success = await rejectCourier(id, reason);
    if (success) {
      toast.success('Kurir ditolak');
      fetchCouriers();
    } else {
      toast.error('Gagal menolak kurir');
    }
  };

  const getStatusBadge = (regStatus: string, status: string, isAvailable: boolean) => {
    if (regStatus === 'PENDING') {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Menunggu</Badge>;
    }
    if (regStatus === 'REJECTED') {
      return <Badge variant="destructive">Ditolak</Badge>;
    }
    if (status === 'ACTIVE' && isAvailable) {
      return <Badge className="bg-green-100 text-green-700">Online</Badge>;
    }
    if (status === 'ACTIVE') {
      return <Badge variant="outline">Offline</Badge>;
    }
    return <Badge variant="outline">Nonaktif</Badge>;
  };

  const columns = [
    {
      key: 'name',
      header: 'Nama Kurir',
      render: (item: CourierRow) => (
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.email || '-'}</p>
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'Kendaraan',
      render: (item: CourierRow) => (
        <div className="text-sm">
          <p className="capitalize">{item.vehicle_type}</p>
          <p className="text-xs text-muted-foreground">{item.vehicle_plate || '-'}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Lokasi',
      render: (item: CourierRow) => (
        <div className="text-sm">
          <p>{item.district}</p>
          <p className="text-xs text-muted-foreground">{item.city}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Telepon',
      render: (item: CourierRow) => item.phone,
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
        if (!item.last_location_update) return '-';
        const date = new Date(item.last_location_update);
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
        if (diffMinutes < 5) return <span className="text-green-600">Baru saja</span>;
        if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
        return date.toLocaleDateString('id-ID');
      },
    },
    {
      key: 'actions',
      header: '',
      render: (item: CourierRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/admin/couriers/${item.id}`)}>
              <Eye className="h-4 w-4 mr-2" />
              Lihat Detail
            </DropdownMenuItem>
            {item.registration_status === 'PENDING' && (
              <>
                <DropdownMenuItem onClick={() => handleApprove(item.id)}>
                  <Check className="h-4 w-4 mr-2" />
                  Setujui
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleReject(item.id)} className="text-destructive">
                  <X className="h-4 w-4 mr-2" />
                  Tolak
                </DropdownMenuItem>
              </>
            )}
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
  ];

  return (
    <AdminLayout title="Manajemen Kurir" subtitle="Kelola semua kurir yang terdaftar">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">
            {couriers.length} kurir terdaftar • {couriers.filter(c => c.is_available).length} online
          </span>
        </div>
        <AddCourierDialog onSuccess={fetchCouriers} />
      </div>

      <DataTable
        data={couriers}
        columns={columns}
        searchKey="name"
        searchPlaceholder="Cari nama kurir..."
        filters={filters}
        loading={loading}
        emptyMessage="Belum ada kurir terdaftar"
      />
    </AdminLayout>
  );
}
