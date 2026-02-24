import { useState, useEffect } from 'react';
import { RotateCcw, Check, X, Eye, Filter, Clock, Search, Store } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
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
  DialogDescription,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { logAdminAction } from '@/lib/auditLog';

interface RefundRequest {
  id: string;
  orderId: string;
  buyerId: string;
  merchantId: string;
  amount: number;
  reason: string;
  status: string;
  adminNotes: string | null;
  processedAt: string | null;
  createdAt: string;
  orderTotal: number;
  buyerName: string;
  merchantName: string;
  evidenceUrls: string[];
  refundType: string;
}

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [processAction, setProcessAction] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadRefunds = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('refund_requests')
        .select('*, orders(total, merchants(name))')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch buyer names separately
      const buyerIds = [...new Set((data || []).map(r => r.buyer_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', buyerIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      const mapped: RefundRequest[] = (data || []).map(r => ({
        id: r.id,
        orderId: r.order_id,
        buyerId: r.buyer_id,
        merchantId: (r.orders as any)?.merchant_id || '',
        amount: r.amount,
        reason: r.reason,
        status: r.status,
        adminNotes: r.admin_notes,
        processedAt: r.processed_at,
        createdAt: r.created_at,
        orderTotal: (r.orders as any)?.total || 0,
        buyerName: profileMap.get(r.buyer_id) || 'Unknown',
        merchantName: (r.orders as any)?.merchants?.name || 'Unknown Merchant',
        evidenceUrls: [],
        refundType: 'FULL',
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

  const handleProcess = async () => {
    if (!selectedRefund) return;

    try {
      setActionLoading(true);
      
      const newStatus = processAction === 'approve' ? 'APPROVED' : 'REJECTED';
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('refund_requests')
        .update({
          status: newStatus,
          admin_notes: adminNotes,
          processed_by: user?.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', selectedRefund.id);

      if (error) throw error;

      // If approved, update order status and deduct merchant balance
      if (processAction === 'approve') {
        await supabase
          .from('orders')
          .update({ status: 'REFUNDED' })
          .eq('id', selectedRefund.orderId);

        // Deduct refund amount from merchant's available balance
        const { data: merchant } = await supabase
          .from('merchants')
          .select('available_balance')
          .eq('id', selectedRefund.merchantId)
          .single();

        if (merchant) {
          await supabase
            .from('merchants')
            .update({
              available_balance: Math.max(0, (merchant.available_balance || 0) - selectedRefund.amount),
            })
            .eq('id', selectedRefund.merchantId);
        }
      }

      await logAdminAction(
        processAction === 'approve' ? 'APPROVE_REFUND' : 'REJECT_REFUND',
        'refund',
        selectedRefund.id,
        { status: 'PENDING' },
        { status: newStatus, admin_notes: adminNotes }
      );

      toast.success(`Refund berhasil ${processAction === 'approve' ? 'disetujui' : 'ditolak'}`);
      setProcessDialogOpen(false);
      setAdminNotes('');
      setSelectedRefund(null);
      loadRefunds();
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error('Gagal memproses refund');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRefunds = refunds.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = 
      r.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.merchantName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">Menunggu</Badge>;
      case 'APPROVED':
        return <Badge variant="success">Disetujui</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingCount = refunds.filter(r => r.status === 'PENDING').length;

  return (
    <AdminLayout title="Manajemen Refund" subtitle="Kelola permintaan pengembalian dana">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Permintaan</p>
          <p className="text-2xl font-bold">{refunds.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <p className="text-sm text-muted-foreground">Menunggu</p>
          </div>
          <p className="text-2xl font-bold text-warning">{pendingCount}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Disetujui</p>
          <p className="text-2xl font-bold text-primary">{refunds.filter(r => r.status === 'APPROVED').length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Ditolak</p>
          <p className="text-2xl font-bold text-destructive">{refunds.filter(r => r.status === 'REJECTED').length}</p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari Order ID, Pembeli, atau Merchant..."
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
                <TableHead>Merchant</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRefunds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <RotateCcw className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    Tidak ada permintaan refund
                  </TableCell>
                </TableRow>
              ) : (
                filteredRefunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell className="font-mono text-sm">{refund.orderId.slice(0, 8)}</TableCell>
                    <TableCell>{refund.buyerName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Store className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{refund.merchantName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{formatPrice(refund.amount)}</TableCell>
                    <TableCell>{getStatusBadge(refund.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(refund.createdAt), 'dd MMM yyyy', { locale: idLocale })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                        {refund.status === 'PENDING' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => {
                                setSelectedRefund(refund);
                                setProcessAction('approve');
                                setProcessDialogOpen(true);
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setSelectedRefund(refund);
                                setProcessAction('reject');
                                setProcessDialogOpen(true);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
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
                  <p className="text-sm text-muted-foreground">Merchant</p>
                  <p className="font-medium">{selectedRefund.merchantName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jumlah Refund</p>
                  <p className="font-bold text-primary">{formatPrice(selectedRefund.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipe Refund</p>
                  <Badge variant="outline">{selectedRefund.refundType}</Badge>
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Process Dialog */}
      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {processAction === 'approve' ? 'Setujui Refund' : 'Tolak Refund'}
            </DialogTitle>
            <DialogDescription>
              {processAction === 'approve' 
                ? 'Apakah Anda yakin ingin menyetujui permintaan refund ini? Saldo akan dikembalikan ke pembeli.'
                : 'Berikan alasan mengapa permintaan refund ini ditolak.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Catatan Admin</label>
              <Textarea
                placeholder="Masukkan catatan atau alasan..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessDialogOpen(false)}>
              Batal
            </Button>
            <Button
              variant={processAction === 'approve' ? 'default' : 'destructive'}
              onClick={handleProcess}
              disabled={actionLoading}
            >
              {actionLoading ? 'Memproses...' : processAction === 'approve' ? 'Setujui' : 'Tolak'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
