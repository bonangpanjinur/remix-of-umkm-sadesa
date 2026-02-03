import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Eye, Check, X, MoreHorizontal, Plus } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { approveMerchant, rejectMerchant } from '@/lib/adminApi';
import { MerchantAddDialog } from '@/components/admin/MerchantAddDialog';

interface MerchantRow {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  district: string | null;
  business_category: string | null;
  registration_status: string;
  status: string;
  registered_at: string | null;
  villages: { name: string } | null;
}

export default function AdminMerchantsPage() {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchMerchants = async () => {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('id, name, phone, city, district, business_category, registration_status, status, registered_at, villages(name)')
        .order('registered_at', { ascending: false });

      if (error) throw error;
      setMerchants(data || []);
    } catch (error) {
      console.error('Error fetching merchants:', error);
      toast.error('Gagal memuat data merchant');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const handleApprove = async (id: string) => {
    const success = await approveMerchant(id);
    if (success) {
      toast.success('Merchant berhasil disetujui');
      fetchMerchants();
    } else {
      toast.error('Gagal menyetujui merchant');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Alasan penolakan:');
    if (!reason) return;
    
    const success = await rejectMerchant(id, reason);
    if (success) {
      toast.success('Merchant ditolak');
      fetchMerchants();
    } else {
      toast.error('Gagal menolak merchant');
    }
  };

  const getStatusBadge = (status: string, regStatus: string) => {
    if (regStatus === 'PENDING') {
      return <Badge variant="secondary" className="bg-warning/10 text-warning">Menunggu</Badge>;
    }
    if (regStatus === 'REJECTED') {
      return <Badge variant="destructive">Ditolak</Badge>;
    }
    if (status === 'ACTIVE') {
      return <Badge className="bg-success/10 text-success">Aktif</Badge>;
    }
    return <Badge variant="outline">Nonaktif</Badge>;
  };

  const columns = [
    {
      key: 'name',
      header: 'Nama Merchant',
      render: (item: MerchantRow) => (
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.business_category || '-'}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Lokasi',
      render: (item: MerchantRow) => (
        <div className="text-sm">
          <p>{item.villages?.name || '-'}</p>
          <p className="text-xs text-muted-foreground">{item.district}, {item.city}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Telepon',
      render: (item: MerchantRow) => item.phone || '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: MerchantRow) => getStatusBadge(item.status, item.registration_status),
    },
    {
      key: 'registered_at',
      header: 'Terdaftar',
      render: (item: MerchantRow) => 
        item.registered_at 
          ? new Date(item.registered_at).toLocaleDateString('id-ID') 
          : '-',
    },
    {
      key: 'actions',
      header: '',
      render: (item: MerchantRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/admin/merchants/${item.id}`)}>
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
      label: 'Status',
      options: [
        { value: 'PENDING', label: 'Menunggu' },
        { value: 'APPROVED', label: 'Disetujui' },
        { value: 'REJECTED', label: 'Ditolak' },
      ],
    },
    {
      key: 'business_category',
      label: 'Kategori',
      options: [
        { value: 'kuliner', label: 'Kuliner' },
        { value: 'fashion', label: 'Fashion' },
        { value: 'kriya', label: 'Kriya' },
        { value: 'jasa', label: 'Jasa' },
      ],
    },
  ];

  return (
    <AdminLayout title="Manajemen Merchant" subtitle="Kelola semua merchant yang terdaftar">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">{merchants.length} merchant terdaftar</span>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Merchant
        </Button>
      </div>

      <DataTable
        data={merchants}
        columns={columns}
        searchKey="name"
        searchPlaceholder="Cari nama merchant..."
        filters={filters}
        loading={loading}
        emptyMessage="Belum ada merchant terdaftar"
      />

      <MerchantAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={fetchMerchants}
      />
    </AdminLayout>
  );
}
