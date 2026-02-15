import { useState, useEffect } from 'react';
import { Wallet, Check, X, Calendar, ShieldCheck, User } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';

interface KasPayment {
  id: string;
  amount: number;
  payment_month: number;
  payment_year: number;
  status: string;
  payment_date: string | null;
  collected_by: string | null;
  invoice_note: string | null;
  sent_at: string | null;
  collector_name?: string;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function MerchantDuesPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<KasPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!merchant) { setLoading(false); return; }
      setMerchantId(merchant.id);

      const { data: kasData } = await supabase
        .from('kas_payments')
        .select('id, amount, payment_month, payment_year, status, payment_date, collected_by, invoice_note, sent_at')
        .eq('merchant_id', merchant.id)
        .order('payment_year', { ascending: false })
        .order('payment_month', { ascending: false });

      if (kasData && kasData.length > 0) {
        // Fetch collector names
        const collectorIds = [...new Set(kasData.filter(k => k.collected_by).map(k => k.collected_by!))];
        let collectorMap: Record<string, string> = {};
        
        if (collectorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', collectorIds);
          
          if (profiles) {
            collectorMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name || 'Verifikator']));
          }
        }

        setPayments(kasData.map(k => ({
          ...k,
          collector_name: k.collected_by ? (collectorMap[k.collected_by] || 'Verifikator') : undefined,
        })));
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const paidPayments = payments.filter(p => p.status === 'PAID');
  const unpaidPayments = payments.filter(p => p.status === 'UNPAID');
  const totalPaid = paidPayments.reduce((s, p) => s + p.amount, 0);
  const totalUnpaid = unpaidPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <MerchantLayout title="Iuran Kas" subtitle="Riwayat iuran kas kelompok dagang">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Belum ada data iuran kas</p>
            <p className="text-xs text-muted-foreground mt-1">Hubungi verifikator kelompok Anda untuk informasi lebih lanjut</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-primary">{paidPayments.length}</p>
                <p className="text-xs text-muted-foreground">Bulan Lunas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-destructive">{unpaidPayments.length}</p>
                <p className="text-xs text-muted-foreground">Belum Bayar</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-primary">{formatPrice(totalPaid)}</p>
                <p className="text-xs text-muted-foreground">Total Terbayar</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-destructive">{formatPrice(totalUnpaid)}</p>
                <p className="text-xs text-muted-foreground">Total Tunggakan</p>
              </CardContent>
            </Card>
          </div>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Riwayat Iuran
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {payments.map(p => (
                  <div key={p.id} className={`p-4 rounded-lg border ${p.status === 'PAID' ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {MONTHS[p.payment_month - 1]} {p.payment_year}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{formatPrice(p.amount)}</span>
                        <Badge variant={p.status === 'PAID' ? 'default' : 'destructive'} className="text-[10px]">
                          {p.status === 'PAID' ? 'LUNAS' : 'BELUM BAYAR'}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Verified badge */}
                    {p.status === 'PAID' && p.collected_by && (
                      <div className="flex items-center gap-2 text-xs text-primary mt-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Terverifikasi oleh {p.collector_name}</span>
                        {p.payment_date && (
                          <span className="text-muted-foreground">
                            • {new Date(p.payment_date).toLocaleDateString('id-ID')}
                          </span>
                        )}
                      </div>
                    )}

                    {p.invoice_note && (
                      <p className="text-xs text-muted-foreground mt-1">Catatan: {p.invoice_note}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </MerchantLayout>
  );
}
