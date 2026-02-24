import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, Eye, Search, Loader2, Wallet, Building } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface WithdrawalRequest {
  id: string;
  merchant_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
  merchant: {
    name: string;
    phone: string | null;
    available_balance: number | null;
  } | null;
}

export default function AdminWithdrawalsPage() {
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'>('all');
  const [search, setSearch] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchWithdrawals();
  }, [filter]);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('withdrawal_requests')
        .select(`
          *,
          merchant:merchants(name, phone, available_balance)
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setWithdrawals((data || []).map(w => ({
        ...w,
        merchant: w.merchant as WithdrawalRequest['merchant'],
      })));
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat data penarikan',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedWithdrawal) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({
          status: 'APPROVED',
          admin_notes: adminNotes || null,
          processed_at: new Date().toISOString(),
          processed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', selectedWithdrawal.id);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Penarikan disetujui',
      });

      setShowApproveDialog(false);
      setAdminNotes('');
      fetchWithdrawals();
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyetujui penarikan',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedWithdrawal || !adminNotes.trim()) return;
    setProcessing(true);

    try {
      // Refund the balance back to merchant using re-fetched data to avoid race condition
      const { data: freshMerchant } = await supabase
        .from('merchants')
        .select('available_balance')
        .eq('id', selectedWithdrawal.merchant_id)
        .single();

      await supabase
        .from('merchants')
        .update({
          available_balance: (freshMerchant?.available_balance || 0) + selectedWithdrawal.amount,
        })
        .eq('id', selectedWithdrawal.merchant_id);

      const { error } = await supabase
        .from('withdrawal_requests')
        .update({
          status: 'REJECTED',
          admin_notes: adminNotes,
          processed_at: new Date().toISOString(),
          processed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', selectedWithdrawal.id);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Penarikan ditolak',
      });

      setShowRejectDialog(false);
      setAdminNotes('');
      fetchWithdrawals();
    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
      toast({
        title: 'Error',
        description: 'Gagal menolak penarikan',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleComplete = async (withdrawal: WithdrawalRequest) => {
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({
          status: 'COMPLETED',
          processed_at: new Date().toISOString(),
        })
        .eq('id', withdrawal.id);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Transfer telah dikonfirmasi',
      });

      fetchWithdrawals();
    } catch (error) {
      console.error('Error completing withdrawal:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengkonfirmasi transfer',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="pending">Menunggu</Badge>;
      case 'APPROVED':
        return <Badge variant="info">Disetujui</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Selesai</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredWithdrawals = withdrawals.filter(w =>
    w.merchant?.name.toLowerCase().includes(search.toLowerCase()) ||
    w.account_holder.toLowerCase().includes(search.toLowerCase()) ||
    w.bank_name.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = withdrawals.filter(w => w.status === 'PENDING').length;

  return (
    <AdminLayout
      title="Manajemen Penarikan"
      subtitle="Kelola permintaan penarikan saldo merchant"
    >
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <TabsList>
            <TabsTrigger value="all">Semua</TabsTrigger>
            <TabsTrigger value="PENDING" className="gap-2">
              Menunggu
              {pendingCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="APPROVED">Disetujui</TabsTrigger>
            <TabsTrigger value="COMPLETED">Selesai</TabsTrigger>
            <TabsTrigger value="REJECTED">Ditolak</TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari merchant, bank..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Wallet className="h-12 w-12 mb-3 opacity-50" />
              <p>Tidak ada permintaan penarikan</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Rekening</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWithdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="font-medium">
                      {withdrawal.merchant?.name || 'Unknown'}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {formatCurrency(withdrawal.amount)}
                    </TableCell>
                    <TableCell>{withdrawal.bank_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{withdrawal.account_number}</p>
                        <p className="text-muted-foreground text-xs">
                          {withdrawal.account_holder}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(withdrawal.created_at), 'dd MMM yyyy', { locale: id })}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedWithdrawal(withdrawal);
                            setShowDetailDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {withdrawal.status === 'PENDING' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-success hover:text-success hover:bg-success/10"
                              onClick={() => {
                                setSelectedWithdrawal(withdrawal);
                                setShowApproveDialog(true);
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setSelectedWithdrawal(withdrawal);
                                setShowRejectDialog(true);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {withdrawal.status === 'APPROVED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-success"
                            onClick={() => handleComplete(withdrawal)}
                          >
                            Konfirmasi Transfer
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Penarikan</DialogTitle>
          </DialogHeader>
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Building className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{selectedWithdrawal.merchant?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedWithdrawal.merchant?.phone}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Jumlah Penarikan</p>
                  <p className="font-bold text-lg text-primary">
                    {formatCurrency(selectedWithdrawal.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedWithdrawal.status)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Bank</p>
                  <p className="font-medium">{selectedWithdrawal.bank_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">No. Rekening</p>
                  <p className="font-medium">{selectedWithdrawal.account_number}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Atas Nama</p>
                  <p className="font-medium">{selectedWithdrawal.account_holder}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal Pengajuan</p>
                  <p className="font-medium">
                    {format(new Date(selectedWithdrawal.created_at), 'dd MMMM yyyy, HH:mm', { locale: id })}
                  </p>
                </div>
                {selectedWithdrawal.processed_at && (
                  <div>
                    <p className="text-muted-foreground">Tanggal Diproses</p>
                    <p className="font-medium">
                      {format(new Date(selectedWithdrawal.processed_at), 'dd MMMM yyyy, HH:mm', { locale: id })}
                    </p>
                  </div>
                )}
              </div>

              {selectedWithdrawal.admin_notes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground mb-1">Catatan Admin:</p>
                  <p className="text-sm">{selectedWithdrawal.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setujui Penarikan</DialogTitle>
            <DialogDescription>
              Pastikan Anda sudah memverifikasi data rekening sebelum menyetujui.
            </DialogDescription>
          </DialogHeader>
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                <p className="font-semibold text-success">
                  {formatCurrency(selectedWithdrawal.amount)}
                </p>
                <p className="text-sm text-success/80">
                  {selectedWithdrawal.bank_name} - {selectedWithdrawal.account_number}
                </p>
                <p className="text-sm text-success/80">
                  a.n. {selectedWithdrawal.account_holder}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Catatan (Opsional)</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Catatan untuk merchant..."
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Setujui Penarikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Penarikan</DialogTitle>
            <DialogDescription>
              Saldo akan dikembalikan ke akun merchant.
            </DialogDescription>
          </DialogHeader>
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="font-semibold text-destructive">
                  {formatCurrency(selectedWithdrawal.amount)}
                </p>
                <p className="text-sm text-destructive/80">
                  {selectedWithdrawal.merchant?.name}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Alasan Penolakan *</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Jelaskan alasan penolakan..."
                  className="mt-1"
                  required
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || !adminNotes.trim()}
            >
              {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Tolak Penarikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
