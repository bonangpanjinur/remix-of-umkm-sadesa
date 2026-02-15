import { useState, useEffect } from 'react';
import { Wallet, Check, X, Calendar, ShieldCheck, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface KasPayment {
  id: string;
  amount: number;
  payment_month: number;
  payment_year: number;
  status: string;
  payment_date: string | null;
  collected_by: string | null;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

interface MerchantKasCardProps {
  merchantId: string;
}

export function MerchantKasCard({ merchantId }: MerchantKasCardProps) {
  const [payments, setPayments] = useState<KasPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKas = async () => {
      try {
        const { data } = await supabase
          .from('kas_payments')
          .select('id, amount, payment_month, payment_year, status, payment_date, collected_by')
          .eq('merchant_id', merchantId)
          .order('payment_year', { ascending: false })
          .order('payment_month', { ascending: false })
          .limit(12);

        setPayments(data || []);
      } catch (e) {
        console.error('Error fetching kas:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchKas();
  }, [merchantId]);

  if (loading) return null;
  if (payments.length === 0) return null;

  const paidCount = payments.filter(p => p.status === 'PAID').length;
  const unpaidCount = payments.filter(p => p.status === 'UNPAID').length;
  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);

  const now = new Date();
  const currentMonth = payments.find(
    p => p.payment_month === now.getMonth() + 1 && p.payment_year === now.getFullYear()
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Iuran Kas Kelompok
          </CardTitle>
          <Link to="/merchant/dues">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
              Lihat Semua <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current month status */}
        {currentMonth && (
          <div className={`p-3 rounded-lg border ${currentMonth.status === 'PAID' ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                {MONTHS[currentMonth.payment_month - 1]} {currentMonth.payment_year}
              </span>
              <Badge variant={currentMonth.status === 'PAID' ? 'default' : 'destructive'} className="text-[10px]">
                {currentMonth.status === 'PAID' ? 'LUNAS' : 'BELUM BAYAR'}
              </Badge>
            </div>
            <p className="text-sm font-bold mt-1">{formatPrice(currentMonth.amount)}</p>
            {currentMonth.status === 'PAID' && currentMonth.collected_by && (
              <div className="flex items-center gap-1 text-[10px] text-primary mt-1">
                <ShieldCheck className="h-3 w-3" />
                <span>Terverifikasi</span>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-bold text-primary">{paidCount}</p>
            <p className="text-[10px] text-muted-foreground">Bulan Lunas</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-bold text-destructive">{unpaidCount}</p>
            <p className="text-[10px] text-muted-foreground">Belum Bayar</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Total terbayar: {formatPrice(totalPaid)}
        </p>

        {/* Recent history */}
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {payments.slice(0, 6).map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {MONTHS[p.payment_month - 1]} {p.payment_year}
              </span>
              <span className="flex items-center gap-1">
                {p.status === 'PAID' ? (
                  <>
                    <Check className="h-3 w-3 text-primary" />
                    {p.collected_by && <ShieldCheck className="h-3 w-3 text-primary" />}
                  </>
                ) : (
                  <X className="h-3 w-3 text-destructive" />
                )}
                <span className={p.status === 'PAID' ? 'text-primary' : 'text-destructive'}>
                  {formatPrice(p.amount)}
                </span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
