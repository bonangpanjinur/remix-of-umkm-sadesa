import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';
import { ArrowLeft, RefreshCw, Package, Calendar, Pause, Play, Trash2, ShoppingBag, Info } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Subscription {
  id: string;
  product_id: string;
  merchant_id: string;
  quantity: number;
  interval_days: 7 | 14 | 30;
  next_order_date: string;
  delivery_address: string | null;
  notes: string | null;
  is_active: boolean;
  total_orders: number;
  created_at: string;
  product?: { name: string; price: number; image_url: string | null; unit: string | null };
  merchant?: { name: string };
}

const INTERVALS: Record<number, string> = { 7: 'Mingguan', 14: 'Dua Minggu', 30: 'Bulanan' };

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: subs = [], isLoading: loading } = useQuery<Subscription[]>({
    queryKey: ['subscriptions', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('product_subscriptions')
        .select('*, products(name, price, image_url, unit), merchants(name)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return (data || []) as Subscription[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await (supabase as any).from('product_subscriptions').update({ is_active: !isActive }).eq('id', id);
      return !isActive;
    },
    onSuccess: (newActive, { id }) => {
      toast.success(newActive ? 'Langganan diaktifkan' : 'Langganan dijeda');
      queryClient.invalidateQueries({ queryKey: ['subscriptions', user?.id] });
    },
    onError: () => toast.error('Gagal mengubah status langganan'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from('product_subscriptions').delete().eq('id', id);
    },
    onSuccess: () => {
      toast.success('Langganan dihapus');
      queryClient.invalidateQueries({ queryKey: ['subscriptions', user?.id] });
    },
    onError: () => toast.error('Gagal menghapus langganan'),
  });

  const activeSubs = subs.filter(s => s.is_active);
  const pausedSubs = subs.filter(s => !s.is_active);

  const SubCard = ({ sub }: { sub: Subscription }) => (
    <Card className={`border ${sub.is_active ? 'border-emerald-200 bg-white' : 'border-gray-200 bg-gray-50'}`}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
            {sub.product?.image_url ? (
              <img src={sub.product.image_url} alt={sub.product?.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-6 w-6 text-gray-400" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm truncate">{sub.product?.name || 'Produk'}</p>
                <p className="text-xs text-muted-foreground">{sub.merchant?.name}</p>
              </div>
              {!sub.is_active && <Badge variant="outline" className="text-xs shrink-0">Dijeda</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />{INTERVALS[sub.interval_days]}</span>
              <span>×{sub.quantity} {sub.product?.unit || 'pcs'}</span>
              <span className="font-medium text-gray-700">{formatPrice((sub.product?.price || 0) * sub.quantity)}</span>
            </div>
            {sub.is_active && (
              <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                <Calendar className="h-3 w-3" />
                <span>Pesanan berikutnya: {format(new Date(sub.next_order_date), 'd MMM yyyy', { locale: idLocale })}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Total pesanan: {sub.total_orders}x</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Switch checked={sub.is_active} onCheckedChange={() => toggleMutation.mutate({ id: sub.id, isActive: sub.is_active })} disabled={toggleMutation.isPending} />
            <span className="text-xs text-muted-foreground">{sub.is_active ? 'Aktif' : 'Dijeda'}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(sub.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
        </Button>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Langganan Produk</h1>
          <Badge variant="outline" className="text-xs">{activeSubs.length} aktif</Badge>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : subs.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-medium text-gray-700 mb-1">Belum ada langganan</p>
              <p className="text-sm text-muted-foreground mb-4">Langganan produk rutin untuk pesan otomatis setiap minggu atau bulan tanpa repot.</p>
              <Button onClick={() => navigate('/')} className="gap-2"><ShoppingBag className="h-4 w-4" /> Mulai Belanja</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Pesanan langganan dibuat otomatis sesuai jadwal. Pastikan saldo mencukupi sebelum tanggal pesanan.</span>
            </div>
            {activeSubs.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Play className="h-4 w-4 text-emerald-600" /> Aktif ({activeSubs.length})</h2>
                {activeSubs.map(s => <SubCard key={s.id} sub={s} />)}
              </div>
            )}
            {pausedSubs.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Pause className="h-4 w-4 text-gray-500" /> Dijeda ({pausedSubs.length})</h2>
                {pausedSubs.map(s => <SubCard key={s.id} sub={s} />)}
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
