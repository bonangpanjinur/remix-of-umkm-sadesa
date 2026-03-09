import { useState, useEffect } from 'react';
import { RotateCcw, Eye, Filter, Clock, Search } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface RefundRequest {
  id: string;
  orderId: string;
  buyerId: string;
  amount: number;
  reason: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  buyerName: string;
  evidenceUrls: string[];
}

export default function MerchantRefundsPage() {
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const loadRefunds = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get merchant ID
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!merchant) return;

      // refund_requests table doesn't have merchant_id column - filter via order join
      const { data, error } = await supabase
        .from('refund_requests')
        .select('*, orders!inner(total, merchant_id)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter to only this merchant's orders
      const filteredData = (data || []).filter(r => (r.orders as any)?.merchant_id === merchant.id);

      // Fetch buyer names
      const buyerIds = [...new Set(filteredData.map(r => r.buyer_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', buyerIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      const mapped: RefundRequest[] = filteredData.map(r => ({
        id: r.id,
        orderId: r.order_id,
        buyerId: r.buyer_id,
        amount: r.amount,
        reason: r.reason,
        status: r.status,
        adminNotes: r.admin_notes,
        createdAt: r.created_at,
        buyerName: profileMap.get(r.buyer_id) || 'Unknown',
        evidenceUrls: [],
      }));

      setRefunds(mapped);
    } catch (error) {
      console.error('Error loading refunds:', error);
      toast.error('Gagal memuat data refund');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefunds();
  }, []);

  const filteredRefunds = refunds.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = 
      r.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.buyerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">Menunggu Admin</Badge>;
      case 'APPROVED':
        return <Badge variant="success">Disetujui</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <MerchantLayout title="Manajemen Refund" subtitle="Pantau permintaan pengembalian dana dari pembeli">
      <div className="space-y-6">
        {/* Filter & Search */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari Order ID atau Pembeli..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="PENDING">Menunggu</SelectItem>
                <SelectItem value="APPROVED">Disetujui</SelectItem>
                <SelectItem value="REJECTED">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Pembeli</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRefunds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      <RotateCcw className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      Tidak ada permintaan refund
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRefunds.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell className="font-mono text-sm">{refund.orderId.slice(0, 8)}</TableCell>
                      <TableCell>{refund.buyerName}</TableCell>
                      <TableCell className="font-medium">{formatPrice(refund.amount)}</TableCell>
                      <TableCell>{getStatusBadge(refund.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(refund.createdAt), 'dd MMM yyyy', { locale: idLocale })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRefund(refund);
                            setDetailDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detail Permintaan Refund</DialogTitle>
            </DialogHeader>
            {selectedRefund && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Order ID</p>
                    <p className="font-mono">{selectedRefund.orderId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedRefund.status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pembeli</p>
                    <p className="font-medium">{selectedRefund.buyerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Jumlah Refund</p>
                    <p className="font-bold text-primary">{formatPrice(selectedRefund.amount)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Alasan Refund</p>
                  <div className="bg-muted p-3 rounded-lg text-sm">
                    {selectedRefund.reason}
                  </div>
                </div>

                {selectedRefund.evidenceUrls.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Bukti Pendukung</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedRefund.evidenceUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity">
                          <img src={url} alt={`Evidence ${i+1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRefund.adminNotes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Catatan Admin</p>
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm border border-blue-100">
                      {selectedRefund.adminNotes}
                    </div>
                  </div>
                )}
                
                <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    <strong>Catatan:</strong> Refund diproses oleh Admin. Jika Anda memiliki keberatan terhadap permintaan refund ini, silakan hubungi Admin melalui saluran bantuan.
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MerchantLayout>
  );
}
