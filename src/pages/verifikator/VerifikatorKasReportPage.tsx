import { useState, useEffect } from 'react';
import { BarChart3, Users, Wallet, AlertTriangle, TrendingUp } from 'lucide-react';
import { VerifikatorLayout } from '@/components/verifikator/VerifikatorLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';

interface MerchantKasStatus {
  merchantId: string;
  merchantName: string;
  paidCount: number;
  unpaidCount: number;
  totalPaid: number;
  totalUnpaid: number;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function VerifikatorKasReportPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [merchantStats, setMerchantStats] = useState<MerchantKasStatus[]>([]);
  const [totals, setTotals] = useState({ collected: 0, pending: 0, totalMembers: 0, complianceRate: 0 });

  useEffect(() => {
    const fetchReport = async () => {
      if (!user) return;
      setLoading(true);

      try {
        const { data: groups } = await supabase
          .from('trade_groups')
          .select('id')
          .eq('verifikator_id', user.id)
          .limit(1);

        if (!groups || groups.length === 0) { setLoading(false); return; }
        const groupId = groups[0].id;

        // Get all payments for this year
        const { data: payments } = await supabase
          .from('kas_payments')
          .select('merchant_id, amount, status, payment_month, payment_year, merchant:merchants(name)')
          .eq('group_id', groupId)
          .eq('payment_year', selectedYear);

        if (!payments) { setLoading(false); return; }

        // Group by merchant
        const merchantMap: Record<string, MerchantKasStatus> = {};
        let totalCollected = 0;
        let totalPending = 0;

        for (const p of payments) {
          const mid = p.merchant_id;
          if (!merchantMap[mid]) {
            merchantMap[mid] = {
              merchantId: mid,
              merchantName: (p.merchant as any)?.name || '-',
              paidCount: 0,
              unpaidCount: 0,
              totalPaid: 0,
              totalUnpaid: 0,
            };
          }
          if (p.status === 'PAID') {
            merchantMap[mid].paidCount++;
            merchantMap[mid].totalPaid += p.amount;
            totalCollected += p.amount;
          } else {
            merchantMap[mid].unpaidCount++;
            merchantMap[mid].totalUnpaid += p.amount;
            totalPending += p.amount;
          }
        }

        const stats = Object.values(merchantMap).sort((a, b) => b.unpaidCount - a.unpaidCount);
        const totalPayments = payments.length;
        const paidPayments = payments.filter(p => p.status === 'PAID').length;
        const complianceRate = totalPayments > 0 ? Math.round((paidPayments / totalPayments) * 100) : 0;

        setMerchantStats(stats);
        setTotals({
          collected: totalCollected,
          pending: totalPending,
          totalMembers: stats.length,
          complianceRate,
        });
      } catch (error) {
        console.error('Error fetching report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [user, selectedYear]);

  return (
    <VerifikatorLayout title="Laporan Kas" subtitle="Rekap iuran kas kelompok dagang">
      {/* Year Filter */}
      <div className="flex justify-end mb-6">
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Terkumpul</p>
                    <p className="text-lg font-bold text-primary">{formatPrice(totals.collected)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tunggakan</p>
                    <p className="text-lg font-bold text-destructive">{formatPrice(totals.pending)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Anggota</p>
                    <p className="text-lg font-bold">{totals.totalMembers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Kepatuhan</p>
                    <p className="text-lg font-bold">{totals.complianceRate}%</p>
                  </div>
                </div>
                <Progress value={totals.complianceRate} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
          </div>

          {/* Merchant Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Detail Per Anggota — {selectedYear}
              </CardTitle>
              <CardDescription>Daftar kepatuhan iuran per anggota</CardDescription>
            </CardHeader>
            <CardContent>
              {merchantStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Belum ada data untuk tahun {selectedYear}</p>
              ) : (
                <div className="space-y-3">
                  {merchantStats.map(m => {
                    const total = m.paidCount + m.unpaidCount;
                    const rate = total > 0 ? Math.round((m.paidCount / total) * 100) : 0;
                    return (
                      <div key={m.merchantId} className="p-4 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{m.merchantName}</span>
                          <Badge variant={m.unpaidCount === 0 ? 'default' : 'destructive'} className="text-[10px]">
                            {m.unpaidCount === 0 ? 'LUNAS SEMUA' : `${m.unpaidCount} TUNGGAKAN`}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                          <span>{m.paidCount} lunas</span>
                          <span>{m.unpaidCount} belum</span>
                          <span className="ml-auto font-medium text-foreground">{formatPrice(m.totalPaid)} terbayar</span>
                        </div>
                        <Progress value={rate} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </VerifikatorLayout>
  );
}
