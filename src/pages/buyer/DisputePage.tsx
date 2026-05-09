import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, AlertCircle, CheckCircle2, Loader2, Clock, MessageSquare } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { formatPrice, safeGoBack } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const DISPUTE_CATEGORIES = [
  { value: 'produk_tidak_sesuai', label: 'Produk tidak sesuai deskripsi' },
  { value: 'produk_rusak', label: 'Produk rusak/cacat' },
  { value: 'produk_tidak_diterima', label: 'Produk tidak diterima' },
  { value: 'jumlah_kurang', label: 'Jumlah produk kurang' },
  { value: 'pembayaran', label: 'Masalah pembayaran' },
  { value: 'lainnya', label: 'Lainnya' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Diajukan', color: 'bg-amber-100 text-amber-700' },
  MERCHANT_RESPONDED: { label: 'Direspons Penjual', color: 'bg-blue-100 text-blue-700' },
  IN_MEDIATION: { label: 'Dalam Mediasi Admin', color: 'bg-purple-100 text-purple-700' },
  RESOLVED_REFUND: { label: 'Selesai — Refund', color: 'bg-emerald-100 text-emerald-700' },
  RESOLVED_REJECTED: { label: 'Selesai — Ditolak', color: 'bg-red-100 text-red-700' },
  CLOSED: { label: 'Ditutup', color: 'bg-gray-100 text-gray-700' },
};

interface OrderInfo {
  id: string;
  total: number;
  status: string;
  created_at: string;
  merchants: { name: string } | null;
  order_items: { product_name: string; quantity: number; product_price: number }[];
}

interface ExistingDispute {
  id: string;
  title: string;
  reason: string;
  category: string;
  status: string;
  dispute_status: string;
  amount: number;
  evidence_urls: string[];
  admin_notes: string | null;
  merchant_response: string | null;
  merchant_responded_at: string | null;
  created_at: string;
}

export default function DisputePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Load order info
  const { data: order, isLoading: orderLoading } = useQuery<OrderInfo | null>({
    queryKey: ['dispute-order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await supabase
        .from('orders')
        .select('id, total, status, created_at, merchants(name), order_items(product_name, quantity, product_price)')
        .eq('id', orderId)
        .eq('buyer_id', user!.id)
        .maybeSingle();
      return data as unknown as OrderInfo | null;
    },
    enabled: !!orderId && !!user,
  });

  // Load existing disputes for this order
  const { data: existingDispute, isLoading: disputeLoading } = useQuery<ExistingDispute | null>({
    queryKey: ['dispute-existing', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await supabase
        .from('refund_requests')
        .select('id, title, reason, category, status, dispute_status, amount, evidence_urls, admin_notes, merchant_response, merchant_responded_at, created_at')
        .eq('order_id', orderId)
        .eq('buyer_id', user!.id)
        .maybeSingle();
      return data as unknown as ExistingDispute | null;
    },
    enabled: !!orderId && !!user,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;
    if (evidenceUrls.length + files.length > 5) {
      toast({ title: 'Maks 5 foto bukti', variant: 'destructive' });
      return;
    }
    setUploadingFiles(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          toast({ title: `${file.name} terlalu besar`, variant: 'destructive' });
          continue;
        }
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${orderId}-${Date.now()}.${ext}`;
        const { data } = await supabase.storage.from('payment-proofs').upload(path, file);
        if (data) {
          const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(path);
          uploaded.push(urlData?.publicUrl || path);
        }
      }
      setEvidenceUrls(prev => [...prev, ...uploaded]);
    } catch {
      toast({ title: 'Gagal upload foto', variant: 'destructive' });
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user || !orderId || !order) throw new Error('Data tidak lengkap');
      const refundAmount = amount ? parseInt(amount.replace(/\D/g, '')) : order.total;
      const { error } = await supabase.from('refund_requests').insert({
        order_id: orderId,
        buyer_id: user.id,
        title: title.trim(),
        category,
        reason: reason.trim(),
        amount: refundAmount,
        evidence_urls: evidenceUrls,
        status: 'PENDING',
        dispute_status: 'OPEN',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Komplain berhasil diajukan', description: 'Penjual akan merespons dalam 2x24 jam' });
      queryClient.invalidateQueries({ queryKey: ['dispute-existing', orderId] });
      setTitle('');
      setCategory('');
      setReason('');
      setAmount('');
      setEvidenceUrls([]);
    },
    onError: (err: any) => {
      toast({ title: 'Gagal mengajukan komplain', description: err.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast({ title: 'Isi judul komplain', variant: 'destructive' }); return; }
    if (!category) { toast({ title: 'Pilih kategori masalah', variant: 'destructive' }); return; }
    if (!reason.trim() || reason.trim().length < 20) {
      toast({ title: 'Deskripsi minimal 20 karakter', variant: 'destructive' });
      return;
    }
    submitMutation.mutate();
  };

  const loading = orderLoading || disputeLoading;

  if (loading) {
    return (
      <div className="mobile-shell bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mobile-shell bg-background">
        <Header />
        <div className="p-6 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-3" />
          <p className="font-medium">Pesanan tidak ditemukan</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/orders')}>
            Kembali ke Pesanan
          </Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-muted/30 flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 py-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => safeGoBack(navigate)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Ajukan Komplain</h1>
              <p className="text-sm text-muted-foreground">Pesanan #{orderId?.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>

          {/* Order summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{order.merchants?.name || 'Toko'}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(order.created_at), 'dd MMM yyyy', { locale: idLocale })}
                  </p>
                  <p className="text-sm mt-1">
                    {order.order_items?.map(i => `${i.product_name} x${i.quantity}`).join(', ')}
                  </p>
                </div>
                <p className="font-bold">{formatPrice(order.total)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Existing dispute status */}
          {existingDispute ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Status Komplain
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge className={`${STATUS_CONFIG[existingDispute.dispute_status || existingDispute.status]?.color || 'bg-gray-100 text-gray-700'} border-0`}>
                      {STATUS_CONFIG[existingDispute.dispute_status || existingDispute.status]?.label || existingDispute.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Diajukan {format(new Date(existingDispute.created_at), 'dd MMM yyyy', { locale: idLocale })}
                    </span>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                        <div className="w-0.5 h-full bg-border mt-1" />
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">Komplain Diajukan</p>
                        <p className="text-xs text-muted-foreground">{existingDispute.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{existingDispute.reason}</p>
                        {existingDispute.evidence_urls?.length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {existingDispute.evidence_urls.map((url, i) => (
                              <img key={i} src={url} alt="Bukti" className="w-16 h-16 rounded object-cover border" />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {existingDispute.merchant_response && (
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="h-3.5 w-3.5 text-white" />
                          </div>
                          <div className="w-0.5 h-full bg-border mt-1" />
                        </div>
                        <div className="pb-4">
                          <p className="text-sm font-medium">Respons Penjual</p>
                          <p className="text-xs text-muted-foreground">
                            {existingDispute.merchant_responded_at && format(new Date(existingDispute.merchant_responded_at), 'dd MMM yyyy', { locale: idLocale })}
                          </p>
                          <div className="mt-1 bg-muted rounded-lg p-3">
                            <p className="text-sm">{existingDispute.merchant_response}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {existingDispute.admin_notes && (
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Keputusan Admin</p>
                          <div className="mt-1 bg-muted rounded-lg p-3">
                            <p className="text-sm">{existingDispute.admin_notes}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!existingDispute.merchant_response && (
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Menunggu respons penjual...</p>
                          <p className="text-xs text-muted-foreground">Penjual akan merespons dalam 2x24 jam</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Submit dispute form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detail Komplain</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Judul Komplain *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Contoh: Produk tidak sesuai foto"
                      maxLength={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Kategori Masalah *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        {DISPUTE_CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Deskripsi Masalah *</Label>
                    <Textarea
                      id="reason"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Jelaskan masalah secara detail. Minimal 20 karakter..."
                      rows={4}
                      maxLength={1000}
                    />
                    <p className="text-xs text-muted-foreground text-right">{reason.length}/1000</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Nominal Refund yang Diminta (opsional)</Label>
                    <Input
                      id="amount"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder={`Kosongkan jika full refund (${formatPrice(order.total)})`}
                      type="number"
                      min={0}
                      max={order.total}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Evidence upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Foto Bukti (opsional)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    {evidenceUrls.map((url, i) => (
                      <div key={i} className="relative w-20 h-20">
                        <img src={url} alt={`Bukti ${i + 1}`} className="w-full h-full object-cover rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => setEvidenceUrls(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {evidenceUrls.length < 5 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFiles}
                        className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors"
                      >
                        {uploadingFiles ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Tambah</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
                  <p className="text-xs text-muted-foreground">Maksimal 5 foto, ukuran maks 5MB per foto</p>
                </CardContent>
              </Card>

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengajukan...</>
                ) : (
                  'Ajukan Komplain'
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Komplain akan diteruskan ke penjual. Jika tidak ada respons dalam 2x24 jam, admin akan memediasi.
              </p>
            </form>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
