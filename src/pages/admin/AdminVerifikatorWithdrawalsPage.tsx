import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Check, X, Eye, Search, Loader2, Wallet, Upload, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface VerifikatorWithdrawal {
  id: string;
  verifikator_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: string;
  admin_notes: string | null;
  proof_image_url: string | null;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

export default function AdminVerifikatorWithdrawalsPage() {
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<VerifikatorWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED'>('all');
  const [search, setSearch] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<VerifikatorWithdrawal | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchWithdrawals();
  }, [filter]);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('verifikator_withdrawals')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setWithdrawals(data || []);
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

  const handleApprove = async (withdrawal: VerifikatorWithdrawal) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('verifikator_withdrawals')
        .update({
          status: 'APPROVED',
          processed_at: new Date().toISOString(),
          processed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', withdrawal.id);

      if (error) throw error;

      toast({ title: 'Penarikan disetujui. Silakan transfer dan upload bukti.' });
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

  const handleReject = async (withdrawal: VerifikatorWithdrawal) => {
    const reason = prompt('Alasan penolakan:');
    if (!reason) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('verifikator_withdrawals')
        .update({
          status: 'REJECTED',
          admin_notes: reason,
          processed_at: new Date().toISOString(),
          processed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', withdrawal.id);

      if (error) throw error;

      toast({ title: 'Penarikan ditolak' });
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

  const handleUploadProof = async () => {
    if (!selectedWithdrawal || !proofImageUrl) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('verifikator_withdrawals')
        .update({
          status: 'COMPLETED',
          proof_image_url: proofImageUrl,
          admin_notes: adminNotes || 'Transfer selesai',
          processed_at: new Date().toISOString(),
        })
        .eq('id', selectedWithdrawal.id);

      if (error) throw error;

      // Create notification for verifikator
      await supabase.from('notifications').insert({
        user_id: selectedWithdrawal.verifikator_id,
        title: 'Penarikan Selesai',
        message: `Penarikan sebesar Rp ${selectedWithdrawal.amount.toLocaleString('id-ID')} telah ditransfer.`,
        type: 'payment',
        link: '/verifikator/earnings',
      });

      toast({ title: 'Transfer dikonfirmasi' });
      setShowUploadDialog(false);
      setProofImageUrl('');
      setAdminNotes('');
      fetchWithdrawals();
    } catch (error) {
      console.error('Error completing withdrawal:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengkonfirmasi transfer',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
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
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30"><Clock className="h-3 w-3 mr-1" /> Menunggu</Badge>;
      case 'APPROVED':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30"><CheckCircle className="h-3 w-3 mr-1" /> Disetujui</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> Selesai</Badge>;
      case 'REJECTED':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30"><XCircle className="h-3 w-3 mr-1" /> Ditolak</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingCount = withdrawals.filter(w => w.status === 'PENDING').length;
  const approvedCount = withdrawals.filter(w => w.status === 'APPROVED').length;

  return (
    <AdminLayout
      title="Penarikan Verifikator"
      subtitle="Kelola permintaan penarikan saldo verifikator"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Menunggu</p>
                <p className="text-xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Upload className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Perlu Transfer</p>
                <p className="text-xl font-bold">{approvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <TabsList>
            <TabsTrigger value="all">Semua</TabsTrigger>
            <TabsTrigger value="PENDING" className="gap-2">
              Menunggu
              {pendingCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5">{pendingCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="APPROVED" className="gap-2">
              Perlu Transfer
              {approvedCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5">{approvedCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="COMPLETED">Selesai</TabsTrigger>
            <TabsTrigger value="REJECTED">Ditolak</TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama rekening..."
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
          ) : withdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Wallet className="h-12 w-12 mb-3 opacity-50" />
              <p>Tidak ada permintaan penarikan</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Rekening</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals
                  .filter(w => 
                    w.account_holder.toLowerCase().includes(search.toLowerCase()) ||
                    w.bank_name.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="font-semibold text-primary">
                      {formatCurrency(withdrawal.amount)}
                    </TableCell>
                    <TableCell>{withdrawal.bank_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{withdrawal.account_number}</p>
                        <p className="text-muted-foreground text-xs">{withdrawal.account_holder}</p>
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
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleApprove(withdrawal)}
                              disabled={processing}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleReject(withdrawal)}
                              disabled={processing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {withdrawal.status === 'APPROVED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600"
                            onClick={() => {
                              setSelectedWithdrawal(withdrawal);
                              setShowUploadDialog(true);
                            }}
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            Upload Bukti
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
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Jumlah</p>
                  <p className="font-bold text-lg text-primary">{formatCurrency(selectedWithdrawal.amount)}</p>
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
              </div>

              {selectedWithdrawal.proof_image_url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Bukti Transfer:</p>
                  <img 
                    src={selectedWithdrawal.proof_image_url} 
                    alt="Bukti transfer"
                    className="w-full rounded-lg border"
                  />
                </div>
              )}

              {selectedWithdrawal.admin_notes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground mb-1">Catatan:</p>
                  <p className="text-sm">{selectedWithdrawal.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Proof Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Bukti Transfer</DialogTitle>
            <DialogDescription>
              Upload bukti transfer untuk menyelesaikan penarikan
            </DialogDescription>
          </DialogHeader>
          
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="font-semibold">{formatCurrency(selectedWithdrawal.amount)}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedWithdrawal.bank_name} - {selectedWithdrawal.account_number}
                </p>
                <p className="text-sm text-muted-foreground">
                  a.n. {selectedWithdrawal.account_holder}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Bukti Transfer *</Label>
                <Input
                  value={proofImageUrl}
                  onChange={(e) => setProofImageUrl(e.target.value)}
                  placeholder="URL gambar bukti transfer"
                />
              </div>

              <div className="space-y-2">
                <Label>Catatan (Opsional)</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Catatan tambahan..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={processing}>
              Batal
            </Button>
            <Button onClick={handleUploadProof} disabled={processing || !proofImageUrl}>
              {processing ? 'Menyimpan...' : 'Konfirmasi Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
