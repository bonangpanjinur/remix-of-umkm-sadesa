import { useState, useEffect } from 'react';
import { Store, Check, X, MoreHorizontal, Eye } from 'lucide-react';
import { VerifikatorLayout } from '@/components/verifikator/VerifikatorLayout';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MerchantDetailSheet } from '@/components/verifikator/MerchantDetailSheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { approveMerchant, rejectMerchant } from '@/lib/adminApi';

interface MerchantRow {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  district: string | null;
  business_category: string | null;
  registration_status: string;
  verifikator_code: string | null;
  trade_group: string | null;
  registered_at: string | null;
}

export default function VerifikatorMerchantsPage() {
  const { user } = useAuth();
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailMerchantId, setDetailMerchantId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchMerchants = async () => {
    if (!user) return;

    try {
      // First get codes owned by this verifikator
      const { data: codes } = await supabase
        .from('verifikator_codes')
        .select('code, trade_group')
        .eq('verifikator_id', user.id);

      if (!codes || codes.length === 0) {
        setMerchants([]);
        setLoading(false);
        return;
      }

      const codeValues = codes.map(c => c.code);
      const codeToGroup = Object.fromEntries(codes.map(c => [c.code, c.trade_group]));

      // Get merchants using these codes
      const { data, error } = await supabase
        .from('merchants')
        .select('id, name, phone, city, district, business_category, registration_status, verifikator_code, registered_at')
        .in('verifikator_code', codeValues)
        .order('registered_at', { ascending: false });

      if (error) throw error;

      const merchantsWithGroup = (data || []).map(m => ({
        ...m,
        trade_group: m.verifikator_code ? codeToGroup[m.verifikator_code] : null,
      }));

      setMerchants(merchantsWithGroup);
    } catch (error) {
      console.error('Error fetching merchants:', error);
      toast.error('Gagal memuat data merchant');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, [user]);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">Menunggu</Badge>;
      case 'APPROVED':
        return <Badge variant="success">Disetujui</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
      key: 'trade_group',
      header: 'Kelompok Dagang',
      render: (item: MerchantRow) => (
        <div>
          <p className="font-medium">{item.trade_group || '-'}</p>
          <p className="text-xs text-muted-foreground font-mono">{item.verifikator_code}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Lokasi',
      render: (item: MerchantRow) => `${item.district || '-'}, ${item.city || '-'}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: MerchantRow) => getStatusBadge(item.registration_status),
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
            <DropdownMenuItem onClick={() => { setDetailMerchantId(item.id); setDetailOpen(true); }}>
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
  ];

  return (
    <VerifikatorLayout title="Merchant" subtitle="Merchant yang menggunakan kode Anda">
      <div className="flex items-center gap-2 mb-4">
        <Store className="h-5 w-5 text-primary" />
        <span className="text-muted-foreground text-sm">
          {merchants.length} merchant • {merchants.filter(m => m.registration_status === 'PENDING').length} menunggu
        </span>
      </div>

      <DataTable
        data={merchants}
        columns={columns}
        searchKeys={['name']}
        searchPlaceholder="Cari nama merchant..."
        filters={filters}
        loading={loading}
        emptyMessage="Belum ada merchant yang menggunakan kode Anda"
      />

      <MerchantDetailSheet
        merchantId={detailMerchantId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </VerifikatorLayout>
  );
}
