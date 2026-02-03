import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Eye, Check, X, MoreHorizontal, Plus, Edit, Trash2 } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { approveVillage, rejectVillage, deleteVillage } from '@/lib/adminApi';
import { VillageAddDialog } from '@/components/admin/VillageAddDialog';
import { VillageEditDialog } from '@/components/admin/VillageEditDialog';

interface VillageRow {
  id: string;
  name: string;
  district: string;
  regency: string;
  subdistrict: string | null;
  description: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  registration_status: string;
  is_active: boolean;
  registered_at: string | null;
}

export default function AdminVillagesPage() {
  const navigate = useNavigate();
  const [villages, setVillages] = useState<VillageRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedVillage, setSelectedVillage] = useState<VillageRow | null>(null);

  const fetchVillages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('villages')
        .select('id, name, district, regency, subdistrict, description, contact_name, contact_phone, contact_email, registration_status, is_active, registered_at')
        .order('registered_at', { ascending: false });

      if (error) throw error;
      setVillages(data || []);
    } catch (error) {
      console.error('Error fetching villages:', error);
      toast.error('Gagal memuat data desa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVillages();
  }, []);

  const handleApprove = async (id: string) => {
    const success = await approveVillage(id);
    if (success) {
      toast.success('Desa wisata berhasil disetujui');
      fetchVillages();
    } else {
      toast.error('Gagal menyetujui desa wisata');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Alasan penolakan:');
    if (!reason) return;
    
    const success = await rejectVillage(id, reason);
    if (success) {
      toast.success('Desa wisata ditolak');
      fetchVillages();
    } else {
      toast.error('Gagal menolak desa wisata');
    }
  };

  const handleDelete = async () => {
    if (!selectedVillage) return;
    
    const success = await deleteVillage(selectedVillage.id);
    if (success) {
      toast.success('Desa wisata berhasil dihapus');
      fetchVillages();
      setDeleteDialogOpen(false);
    } else {
      toast.error('Gagal menghapus desa wisata');
    }
  };

  const getStatusBadge = (regStatus: string, isActive: boolean) => {
    if (regStatus === 'PENDING') {
      return <Badge variant="secondary" className="bg-warning/10 text-warning">Menunggu</Badge>;
    }
    if (regStatus === 'REJECTED') {
      return <Badge variant="destructive">Ditolak</Badge>;
    }
    if (isActive) {
      return <Badge className="bg-success/10 text-success">Aktif</Badge>;
    }
    return <Badge variant="outline">Nonaktif</Badge>;
  };

  const columns = [
    {
      key: 'name',
      header: 'Nama Desa',
      render: (item: VillageRow) => (
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.subdistrict || '-'}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Lokasi',
      render: (item: VillageRow) => (
        <div className="text-sm">
          <p>{item.district}</p>
          <p className="text-xs text-muted-foreground">{item.regency}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Kontak',
      render: (item: VillageRow) => (
        <div className="text-sm">
          <p>{item.contact_name || '-'}</p>
          <p className="text-xs text-muted-foreground">{item.contact_phone || '-'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: VillageRow) => getStatusBadge(item.registration_status, item.is_active),
    },
    {
      key: 'registered_at',
      header: 'Terdaftar',
      render: (item: VillageRow) => 
        item.registered_at 
          ? new Date(item.registered_at).toLocaleDateString('id-ID') 
          : '-',
    },
    {
      key: 'actions',
      header: '',
      render: (item: VillageRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/admin/villages/${item.id}`)}>
              <Eye className="h-4 w-4 mr-2" />
              Lihat Detail
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setSelectedVillage(item);
              setEditDialogOpen(true);
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
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
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => {
                setSelectedVillage(item);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Hapus
            </DropdownMenuItem>
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
  ];

  return (
    <AdminLayout 
      title="Manajemen Desa Wisata" 
      subtitle="Kelola semua desa wisata yang terdaftar"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">{villages.length} desa terdaftar</span>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Desa
        </Button>
      </div>

      <DataTable
        data={villages}
        columns={columns}
        searchKey="name"
        searchPlaceholder="Cari nama desa..."
        filters={filters}
        loading={loading}
        emptyMessage="Belum ada desa wisata terdaftar"
      />

      <VillageAddDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen} 
        onSuccess={fetchVillages} 
      />

      {selectedVillage && (
        <VillageEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          villageId={selectedVillage.id}
          initialData={{
            name: selectedVillage.name,
            district: selectedVillage.district,
            regency: selectedVillage.regency,
            subdistrict: selectedVillage.subdistrict,
            description: selectedVillage.description,
            contact_name: selectedVillage.contact_name,
            contact_phone: selectedVillage.contact_phone,
            contact_email: selectedVillage.contact_email,
            is_active: selectedVillage.is_active,
          }}
          onSuccess={fetchVillages}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Desa <strong>{selectedVillage?.name}</strong> akan dihapus secara permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
