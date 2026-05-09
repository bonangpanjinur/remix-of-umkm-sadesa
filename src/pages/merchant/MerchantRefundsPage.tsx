import { useState } from 'react';
import { RotateCcw, Eye, Filter, Clock, Search, MessageSquare, CheckCircle } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface RefundRequest {
  id: string;
  orderId: string;
  buyerId: string;
  amount: number;
  reason: string;
  title: string | null;
  category: string | null;
  status: string;
  dispute_status: string | null;
  adminNotes: string | null;
  merchant_response: string | null;
  createdAt: string;
  buyerName: string;
  evidenceUrls: string[];
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Menunggu', variant: 'outline' },
  MERCHANT_RESPONDED: { label: 'Sudah Direspons', variant: 'secondary' },
  IN_MEDIATION: { label: 'Dalam Mediasi', variant: 'default' },
  APPROVED: { label: 'Disetujui', variant: 'default' },
  REJECTED: { label: 'Ditolak', variant: 'destructive' },
};

export default function MerchantRefundsPage() {
  const { merchantId } = useMerchantGuard();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [respondMode, setRespondMode] = useState(false);

  const { data: refunds = [], isLoading } = useQuery<RefundRequest[]>({
    queryKey: ['merchant-refunds', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from('refund_requests')
        .select('*, orders!inner(total, merchant_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const filtered = (data || []).filter((r: any) => r.orders?.merchant_id === merchantId);
      const buyerIds = [...new Set(filtered.map((r: any) => r.buyer_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', buyerIds);
      const profileMap = new Map(profiles?.map((p: any) => [p.user_id, p.full_name]) || []);

      return filtered.map((r: any) => ({
        id: r.id,
        orderId: r.order_id,
        buyerId: r.buyer_id,
        amount: r.amount,
        reason: r.reason,
        title: r.title || null,
        category: r.category || null,
        status: r.status,
        dispute_status: r.dispute_status || null,
        adminNotes: r.admin_notes || null,
        merchant_response: r.merchant_response || null,
        createdAt: r.created_at,
        buyerName: profileMap.get(r.buyer_id) || 'Pembeli',
        evidenceUrls: r.evidence_urls || [],
      }));
    },
    enabled: !!merchantId,
    staleTime: 30_000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      const { error } = await supabase
        .from('refund_requests')
        .update({
          merchant_response: response,
          merchant_responded_at: new Date().toISOString(),
          dispute_status: 'MERCHANT_RESPONDED',
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-refunds', merchantId] });
      toast.success('Respons berhasil dikirim ke admin');
      setRespondMode(false);
      setResponseText('');
      setDetailDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message || 'Gagal mengirim respons'),
  });

  const filteredRefunds = refunds.filter(r => {
    const ds = r.dispute_status || r.status;
    const matchesStatus = statusFilter === 'all' || ds === statusFilter || r.status === statusFilter;
    const matchesSearch =
      r.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (refund: RefundRequest) => {
    const key = refund.dispute_status || refund.status;
    const conf = STATUS_MAP[key] || { label: key, variant: 'secondary' as const };
    return <Badge variant={conf.variant}>{conf.label}</Badge>;
  };

  const openDetail = (refund: RefundRequest) => {
    setSelectedRefund(refund);
    setRespondMode(false);
    setResponseText(refund.merchant_response || '');
    setDetailDialogOpen(true);
  };

  const pendingCount = refunds.filter(r => !r.merchant_response && r.status === 'PENDING').length;

  return (
    <MerchantLayout title="Manajemen Komplain & Refund" subtitle="Pantau dan respons permintaan komplain dari pembeli">
      <div className="space-y-6">
        {pendingCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{pendingCount} komplain</strong> menunggu respons dari Anda. Harap segera direspons agar tidak dieskalasi ke admin.
            </p>
          </div>
        )}

        {/* Filter & Search */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari Order ID, Pembeli, atau Judul..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="PENDING">Menunggu Respons</SelectItem>
                <SelectItem value="MERCHANT_RESPONDED">Sudah Direspons</SelectItem>
                <SelectItem value="IN_MEDIATION">Dalam Mediasi</SelectItem>
                <SelectItem value="APPROVED">Disetujui</SelectItem>
                <SelectItem value="REJECTED">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Komplain</TableHead>
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
                      Tidak ada data komplain
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRefunds.map((refund) => (
                    <TableRow key={refund.id} className={!refund.merchant_response && refund.status === 'PENDING' ? 'bg-amber-50/50' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{refund.title || 'Komplain Pesanan'}</p>
                          <p className="text-xs text-muted-foreground font-mono">{refund.orderId.slice(0, 8).toUpperCase()}</p>
                        </div>
                      </TableCell>
                      <TableCell>{refund.buyerName}</TableCell>
                      <TableCell className="font-medium">{formatPrice(refund.amount)}</TableCell>
                      <TableCell>{getStatusBadge(refund)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(refund.createdAt), 'dd MMM yyyy', { locale: idLocale })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(refund)}>
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
        <Dialog open={detailDialogOpen} onOpenChange={(v) => { setDetailDialogOpen(v); if (!v) setRespondMode(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detail Komplain & Refund</DialogTitle>
            </DialogHeader>
            {selectedRefund && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Order ID</p>
                    <p className="font-mono text-sm">{selectedRefund.orderId.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    {getStatusBadge(selectedRefund)}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pembeli</p>
                    <p className="font-medium">{selectedRefund.buyerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Jumlah Klaim</p>
                    <p className="font-bold text-primary">{formatPrice(selectedRefund.amount)}</p>
                  </div>
                  {selectedRefund.category && (
                    <div>
                      <p className="text-xs text-muted-foreground">Kategori</p>
                      <Badge variant="outline">{selectedRefund.category}</Badge>
                    </div>
                  )}
                  {selectedRefund.title && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Judul Komplain</p>
                      <p className="font-medium">{selectedRefund.title}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium mb-1">Alasan / Deskripsi Komplain</p>
                  <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-line">
                    {selectedRefund.reason}
                  </div>
                </div>

                {selectedRefund.evidenceUrls.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Bukti Foto dari Pembeli</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedRefund.evidenceUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity">
                          <img src={url} alt={`Bukti ${i + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Merchant Response Section */}
                {selectedRefund.merchant_response && !respondMode ? (
                  <div>
                    <p className="text-sm font-medium mb-1 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" /> Respons Anda
                    </p>
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-sm whitespace-pre-line">
                      {selectedRefund.merchant_response}
                    </div>
                    {(selectedRefund.dispute_status === 'PENDING' || selectedRefund.dispute_status === 'MERCHANT_RESPONDED') && (
                      <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setRespondMode(true)}>
                        Edit Respons
                      </Button>
                    )}
                  </div>
                ) : (
                  (selectedRefund.dispute_status !== 'APPROVED' && selectedRefund.dispute_status !== 'REJECTED' && selectedRefund.status !== 'APPROVED' && selectedRefund.status !== 'REJECTED') && (
                    <div className="space-y-3 border border-dashed border-primary/30 p-4 rounded-xl bg-primary/5">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        {selectedRefund.merchant_response ? 'Edit' : 'Tulis'} Respons ke Admin
                      </p>
                      <Textarea
                        value={responseText}
                        onChange={e => setResponseText(e.target.value)}
                        rows={4}
                        placeholder="Jelaskan situasi pesanan ini dari sisi Anda. Misalnya: produk sudah dikirim sesuai pesanan, kondisi barang baik saat dikirim, bukti foto, dsb."
                      />
                      <p className="text-xs text-muted-foreground">Respons Anda akan diteruskan ke Admin untuk dipertimbangkan dalam keputusan refund.</p>
                      <div className="flex gap-2 justify-end">
                        {respondMode && <Button variant="outline" size="sm" onClick={() => setRespondMode(false)}>Batal</Button>}
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!responseText.trim()) { toast.error('Tulis respons terlebih dahulu'); return; }
                            respondMutation.mutate({ id: selectedRefund.id, response: responseText.trim() });
                          }}
                          disabled={respondMutation.isPending || !responseText.trim()}
                        >
                          {respondMutation.isPending ? 'Mengirim...' : 'Kirim Respons'}
                        </Button>
                      </div>
                    </div>
                  )
                )}

                {selectedRefund.adminNotes && (
                  <div>
                    <p className="text-sm font-medium mb-1">Catatan Admin</p>
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm border border-blue-100">
                      {selectedRefund.adminNotes}
                    </div>
                  </div>
                )}

                {(selectedRefund.status === 'APPROVED' || selectedRefund.status === 'REJECTED') && (
                  <div className={`p-4 rounded-lg border ${selectedRefund.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-sm font-medium">
                      {selectedRefund.status === 'APPROVED' ? '✅ Refund disetujui oleh Admin' : '❌ Refund ditolak oleh Admin'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MerchantLayout>
  );
}
