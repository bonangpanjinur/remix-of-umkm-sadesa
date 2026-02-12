import { useState, useEffect } from 'react';
import { Shield, Check, X, Eye, FileText, User, Store } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HalalMerchantRow {
  id: string;
  name: string;
  business_category: string | null;
  halal_status: string;
  halal_certificate_url: string | null;
  ktp_url: string | null;
  registered_at: string | null;
  user_id: string | null;
}

export default function AdminHalalManagementPage() {
  const [merchants, setMerchants] = useState<HalalMerchantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMerchant, setSelectedMerchant] = useState<HalalMerchantRow | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const fetchHalalMerchants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('id, name, business_category, halal_status, halal_certificate_url, ktp_url, registered_at, user_id')
        .eq('business_category', 'kuliner')
        .neq('halal_status', 'NONE')
        .order('registered_at', { ascending: false });

      if (error) throw error;
      setMerchants(data || []);
    } catch (error) {
      console.error('Error fetching halal merchants:', error);
      toast.error('Gagal memuat data sertifikasi halal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHalalMerchants();
  }, []);

  const updateHalalStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('merchants')
        .update({ halal_status: status })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Status halal berhasil diperbarui menjadi ${status}`);
      fetchHalalMerchants();
      setViewDialogOpen(false);
    } catch (error) {
      console.error('Error updating halal status:', error);
      toast.error('Gagal memperbarui status halal');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Terverifikasi</Badge>;
      case 'PENDING_VERIFICATION':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Menunggu Verifikasi</Badge>;
      case 'REQUESTED':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Pengajuan Baru</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Nama Merchant',
      render: (item: HalalMerchantRow) => (
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'halal_status',
      header: 'Status Halal',
      render: (item: HalalMerchantRow) => getStatusBadge(item.halal_status),
    },
    {
      key: 'registered_at',
      header: 'Tanggal Daftar',
      render: (item: HalalMerchantRow) => 
        item.registered_at ? new Date(item.registered_at).toLocaleDateString('id-ID') : '-',
    },
    {
      key: 'actions',
      header: '',
      render: (item: HalalMerchantRow) => (
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setSelectedMerchant(item);
              setViewDialogOpen(true);
            }}
          >
            <Eye className="h-4 w-4 mr-1" />
            Detail
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">Aksi</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => updateHalalStatus(item.id, 'VERIFIED')}>
                <Check className="h-4 w-4 mr-2 text-green-600" />
                Verifikasi Halal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateHalalStatus(item.id, 'PENDING_VERIFICATION')}>
                <Shield className="h-4 w-4 mr-2 text-yellow-600" />
                Set Dalam Proses
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateHalalStatus(item.id, 'NONE')} className="text-destructive">
                <X className="h-4 w-4 mr-2" />
                Batalkan/Tolak
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Manajemen Sertifikasi Halal" subtitle="Verifikasi sertifikat dan pengajuan halal merchant">
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
          <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Pengajuan Baru</p>
          <p className="text-2xl font-bold text-blue-900">{merchants.filter(m => m.halal_status === 'REQUESTED').length}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl">
          <p className="text-yellow-600 text-xs font-bold uppercase tracking-wider mb-1">Menunggu Verifikasi</p>
          <p className="text-2xl font-bold text-yellow-900">{merchants.filter(m => m.halal_status === 'PENDING_VERIFICATION').length}</p>
        </div>
        <div className="bg-green-50 border border-green-100 p-4 rounded-xl">
          <p className="text-green-600 text-xs font-bold uppercase tracking-wider mb-1">Terverifikasi</p>
          <p className="text-2xl font-bold text-green-900">{merchants.filter(m => m.halal_status === 'VERIFIED').length}</p>
        </div>
      </div>

      <DataTable
        data={merchants}
        columns={columns}
        loading={loading}
        searchKeys={['name']}
        searchPlaceholder="Cari merchant..."
        emptyMessage="Tidak ada pengajuan sertifikasi halal"
      />

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Sertifikasi Halal</DialogTitle>
            <DialogDescription>
              Merchant: {selectedMerchant?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-primary" />
                  Dokumen Sertifikat
                </h4>
                {selectedMerchant?.halal_certificate_url ? (
                  <div className="aspect-[4/3] relative rounded border overflow-hidden bg-white">
                    <img 
                      src={selectedMerchant.halal_certificate_url} 
                      alt="Sertifikat Halal" 
                      className="object-contain w-full h-full"
                    />
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="absolute bottom-2 right-2"
                      onClick={() => window.open(selectedMerchant.halal_certificate_url!, '_blank')}
                    >
                      Buka Full
                    </Button>
                  </div>
                ) : (
                  <div className="aspect-[4/3] flex items-center justify-center border border-dashed rounded bg-muted/50 text-muted-foreground text-xs">
                    Tidak ada file sertifikat
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-primary" />
                  Foto KTP (Pengajuan)
                </h4>
                {selectedMerchant?.ktp_url ? (
                  <div className="aspect-[4/3] relative rounded border overflow-hidden bg-white">
                    <img 
                      src={selectedMerchant.ktp_url} 
                      alt="KTP Merchant" 
                      className="object-contain w-full h-full"
                    />
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="absolute bottom-2 right-2"
                      onClick={() => window.open(selectedMerchant.ktp_url!, '_blank')}
                    >
                      Buka Full
                    </Button>
                  </div>
                ) : (
                  <div className="aspect-[4/3] flex items-center justify-center border border-dashed rounded bg-muted/50 text-muted-foreground text-xs">
                    Tidak ada file KTP
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Tutup</Button>
            {selectedMerchant?.halal_status !== 'VERIFIED' && (
              <Button onClick={() => updateHalalStatus(selectedMerchant!.id, 'VERIFIED')}>
                Verifikasi Sekarang
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
