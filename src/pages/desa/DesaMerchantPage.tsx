import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Store,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Tag,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface MerchantItem {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  business_category: string | null;
  registration_status: string;
  status: string;
  created_at: string;
  user_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  PENDING: { label: 'Menunggu', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  APPROVED: { label: 'Disetujui', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { label: 'Ditolak', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

export default function DesaMerchantPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [search, setSearch] = useState('');
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'approve' | 'reject';
    merchant: MerchantItem | null;
  }>({ open: false, type: 'approve', merchant: null });
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { data: villageId, isLoading: villageLoading } = useQuery<string | null>({
    queryKey: ['admin-desa-village', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('user_villages')
        .select('village_id')
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.village_id ?? null;
    },
    enabled: !!user,
  });

  const { data: merchants = [], isLoading } = useQuery<MerchantItem[]>({
    queryKey: ['desa-merchants', villageId],
    queryFn: async () => {
      if (!villageId) return [];
      const { data, error } = await supabase
        .from('merchants')
        .select('id, name, description, phone, business_category, registration_status, status, created_at, user_id, profiles(full_name, email)')
        .eq('village_id', villageId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MerchantItem[];
    },
    enabled: !!villageId,
    staleTime: 30_000,
  });

  const filteredMerchants = merchants.filter((m) => {
    const matchTab =
      activeTab === 'all' ||
      (activeTab === 'pending' && m.registration_status === 'PENDING') ||
      (activeTab === 'approved' && m.registration_status === 'APPROVED') ||
      (activeTab === 'rejected' && m.registration_status === 'REJECTED');

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.business_category?.toLowerCase().includes(q) ||
      m.phone?.includes(q);

    return matchTab && matchSearch;
  });

  const counts = {
    all: merchants.length,
    pending: merchants.filter((m) => m.registration_status === 'PENDING').length,
    approved: merchants.filter((m) => m.registration_status === 'APPROVED').length,
    rejected: merchants.filter((m) => m.registration_status === 'REJECTED').length,
  };

  const openAction = (type: 'approve' | 'reject', merchant: MerchantItem) => {
    setNotes('');
    setActionDialog({ open: true, type, merchant });
  };

  const handleAction = async () => {
    if (!actionDialog.merchant) return;
    const { type, merchant } = actionDialog;
    setActionLoading(true);
    try {
      const newStatus = type === 'approve' ? 'APPROVED' : 'REJECTED';
      const { error } = await supabase
        .from('merchants')
        .update({
          registration_status: newStatus,
          status: type === 'approve' ? 'ACTIVE' : 'SUSPENDED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', merchant.id);

      if (error) throw error;

      await fetch('/api/merchant/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('session_token')}` },
        body: JSON.stringify({
          merchant_id: merchant.id,
          merchant_user_id: merchant.user_id,
          merchant_name: merchant.name,
          approved: type === 'approve',
          notes: notes || undefined,
        }),
      });

      toast.success(type === 'approve' ? `${merchant.name} berhasil disetujui` : `${merchant.name} ditolak`);
      setActionDialog({ open: false, type: 'approve', merchant: null });
      queryClient.invalidateQueries({ queryKey: ['desa-merchants', villageId] });
    } catch (err: any) {
      toast.error(err.message || 'Gagal memproses tindakan');
    } finally {
      setActionLoading(false);
    }
  };

  if (villageLoading) {
    return (
      <DesaLayout title="Verifikasi Merchant" subtitle="Kelola merchant di wilayah desa">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DesaLayout>
    );
  }

  if (!villageId) {
    return (
      <DesaLayout title="Verifikasi Merchant" subtitle="Kelola merchant di wilayah desa">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="font-bold text-lg mb-2">Desa Belum Terdaftar</h2>
          <p className="text-muted-foreground">Anda belum terhubung ke desa manapun.</p>
        </div>
      </DesaLayout>
    );
  }

  return (
    <DesaLayout title="Verifikasi Merchant" subtitle="Approve atau tolak merchant di wilayah desa">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama toko, kategori, atau nomor HP..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="pending" className="relative">
              Menunggu
              {counts.pending > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full">
                  {counts.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Aktif</TabsTrigger>
            <TabsTrigger value="rejected">Ditolak</TabsTrigger>
            <TabsTrigger value="all">Semua ({counts.all})</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredMerchants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Store className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">Tidak ada merchant</p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === 'pending' ? 'Belum ada merchant yang perlu diverifikasi.' : 'Tidak ada merchant di filter ini.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMerchants.map((merchant) => {
              const statusCfg = STATUS_CONFIG[merchant.registration_status] || STATUS_CONFIG['PENDING'];
              const isPending = merchant.registration_status === 'PENDING';
              return (
                <Card key={merchant.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base truncate">{merchant.name}</h3>
                          <Badge variant={statusCfg.variant} className="flex items-center gap-1 shrink-0">
                            {statusCfg.icon}
                            {statusCfg.label}
                          </Badge>
                        </div>

                        <div className="mt-1.5 space-y-1">
                          {merchant.business_category && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Tag className="h-3.5 w-3.5 shrink-0" />
                              {merchant.business_category}
                            </div>
                          )}
                          {merchant.phone && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {merchant.phone}
                            </div>
                          )}
                          {merchant.profiles?.email && (
                            <p className="text-xs text-muted-foreground">{merchant.profiles.email}</p>
                          )}
                          {merchant.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{merchant.description}</p>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mt-2">
                          Daftar {formatDistanceToNow(new Date(merchant.created_at), { addSuffix: true, locale: idLocale })}
                        </p>
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => openAction('approve', merchant)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          Setujui
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => openAction('reject', merchant)}
                        >
                          <XCircle className="h-4 w-4 mr-1.5" />
                          Tolak
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'approve' ? '✅ Setujui Merchant' : '❌ Tolak Merchant'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {actionDialog.type === 'approve'
                ? `Konfirmasi untuk menyetujui toko "${actionDialog.merchant?.name}". Merchant akan langsung bisa berjualan.`
                : `Konfirmasi untuk menolak toko "${actionDialog.merchant?.name}". Merchant akan mendapat notifikasi.`}
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Catatan {actionDialog.type === 'reject' ? '(wajib)' : '(opsional)'}
              </label>
              <Textarea
                placeholder={
                  actionDialog.type === 'approve'
                    ? 'Contoh: Selamat bergabung! Pastikan foto produk jelas.'
                    : 'Contoh: Dokumen izin usaha belum lengkap.'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setActionDialog({ open: false, type: 'approve', merchant: null })}
              disabled={actionLoading}
            >
              Batal
            </Button>
            <Button
              variant={actionDialog.type === 'approve' ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={actionLoading || (actionDialog.type === 'reject' && !notes.trim())}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionDialog.type === 'approve' ? 'Ya, Setujui' : 'Ya, Tolak'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DesaLayout>
  );
}
