import { useState, useEffect } from 'react';
import { Megaphone, Plus, Edit, Trash2, Eye, MoreHorizontal } from 'lucide-react';
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
import { AddPromotionDialog } from '@/components/admin/AddPromotionDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PromotionRow {
  id: string;
  title: string;
  subtitle: string | null;
  type: string;
  is_active: boolean;
  is_approved: boolean;
  start_date: string;
  end_date: string | null;
  view_count: number | null;
  click_count: number | null;
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('id, title, subtitle, type, is_active, is_approved, start_date, end_date, view_count, click_count')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      toast.error('Gagal memuat data promosi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      toast.success(currentActive ? 'Promosi dinonaktifkan' : 'Promosi diaktifkan');
      fetchPromotions();
    } catch (error) {
      toast.error('Gagal mengubah status promosi');
    }
  };

  const toggleApprove = async (id: string, currentApproved: boolean) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_approved: !currentApproved })
        .eq('id', id);

      if (error) throw error;
      toast.success(currentApproved ? 'Persetujuan dicabut' : 'Promosi disetujui');
      fetchPromotions();
    } catch (error) {
      toast.error('Gagal mengubah persetujuan');
    }
  };

  const deletePromotion = async (id: string) => {
    if (!confirm('Yakin ingin menghapus promosi ini?')) return;
    
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Promosi dihapus');
      fetchPromotions();
    } catch (error) {
      toast.error('Gagal menghapus promosi');
    }
  };

  const getTypeBadge = (type: string) => {
    const types: Record<string, string> = {
      'banner': 'Banner',
      'product': 'Produk',
      'tourism': 'Wisata',
      'merchant': 'Merchant',
    };
    return <Badge variant="outline">{types[type] || type}</Badge>;
  };

  const getStatusBadge = (isActive: boolean, isApproved: boolean) => {
    if (!isApproved) {
      return <Badge variant="warning">Belum Disetujui</Badge>;
    }
    if (isActive) {
      return <Badge variant="success">Aktif</Badge>;
    }
    return <Badge variant="outline">Nonaktif</Badge>;
  };

  const columns = [
    {
      key: 'title',
      header: 'Judul',
      render: (item: PromotionRow) => (
        <div>
          <p className="font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.subtitle || '-'}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tipe',
      render: (item: PromotionRow) => getTypeBadge(item.type),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: PromotionRow) => getStatusBadge(item.is_active || false, item.is_approved || false),
    },
    {
      key: 'period',
      header: 'Periode',
      render: (item: PromotionRow) => (
        <div className="text-sm">
          <p>{new Date(item.start_date).toLocaleDateString('id-ID')}</p>
          <p className="text-xs text-muted-foreground">
            {item.end_date ? `s/d ${new Date(item.end_date).toLocaleDateString('id-ID')}` : 'Tanpa batas'}
          </p>
        </div>
      ),
    },
    {
      key: 'stats',
      header: 'Statistik',
      render: (item: PromotionRow) => (
        <div className="text-sm">
          <p>{item.view_count || 0} views</p>
          <p className="text-xs text-muted-foreground">{item.click_count || 0} clicks</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: PromotionRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toggleApprove(item.id, item.is_approved || false)}>
              {item.is_approved ? 'Cabut Persetujuan' : 'Setujui'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleActive(item.id, item.is_active || false)}>
              {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => deletePromotion(item.id)} className="text-destructive">
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
      key: 'type',
      label: 'Tipe',
      options: [
        { value: 'banner', label: 'Banner' },
        { value: 'product', label: 'Produk' },
        { value: 'tourism', label: 'Wisata' },
        { value: 'merchant', label: 'Merchant' },
      ],
    },
    {
      key: 'is_approved',
      label: 'Persetujuan',
      options: [
        { value: 'true', label: 'Disetujui' },
        { value: 'false', label: 'Belum Disetujui' },
      ],
    },
  ];

  return (
    <AdminLayout title="Manajemen Promosi" subtitle="Kelola banner dan iklan">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">{promotions.length} promosi</span>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Promosi
        </Button>
      </div>

      <DataTable
        data={promotions}
        columns={columns}
        searchKeys={['title']}
        searchPlaceholder="Cari judul promosi..."
        filters={filters}
        loading={loading}
        emptyMessage="Belum ada promosi"
      />

      <AddPromotionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={fetchPromotions}
      />
    </AdminLayout>
  );
}
