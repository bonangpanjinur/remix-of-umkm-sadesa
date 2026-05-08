import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';
import { ArrowLeft, Wallet, TrendingUp, Clock, Gift, Zap, Info } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface CashbackTx {
  id: string;
  amount: number;
  type: 'earn' | 'redeem' | 'expire';
  status: string;
  created_at: string;
  expires_at: string | null;
}

interface CashbackRule {
  id: string;
  name: string;
  cashback_percent: number;
  min_order_amount: number;
  max_cashback: number | null;
  category: string | null;
  is_active: boolean;
  valid_until: string | null;
}

export default function CashbackPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<CashbackTx[]>([]);
  const [rules, setRules] = useState<CashbackRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [profileRes, txRes, rulesRes] = await Promise.all([
        supabase.from('profiles').select('cashback_balance').eq('id', user!.id).maybeSingle(),
        (supabase as any).from('cashback_transactions').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(30),
        (supabase as any).from('cashback_rules').select('*').eq('is_active', true).order('cashback_percent', { ascending: false }),
      ]);
      setBalance((profileRes.data as any)?.cashback_balance ?? 0);
      setTransactions((txRes.data as CashbackTx[]) || []);
      setRules((rulesRes.data as CashbackRule[]) || []);
    } catch (err) {
      console.error('Error fetching cashback:', err);
    } finally {
      setLoading(false);
    }
  };

  const txIcon = (type: string) => {
    if (type === 'earn') return <TrendingUp className="h-4 w-4 text-emerald-600" />;
    if (type === 'redeem') return <Wallet className="h-4 w-4 text-blue-600" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const txLabel = (type: string) => {
    if (type === 'earn') return 'Cashback diterima';
    if (type === 'redeem') return 'Cashback digunakan';
    return 'Cashback kedaluwarsa';
  };

  const statusColor = (status: string) => {
    if (status === 'confirmed') return 'bg-emerald-100 text-emerald-700';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-700';
    if (status === 'expired') return 'bg-gray-100 text-gray-500';
    if (status === 'redeemed') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-500';
  };

  const statusLabel = (status: string) => {
    if (status === 'confirmed') return 'Dikonfirmasi';
    if (status === 'pending') return 'Menunggu';
    if (status === 'expired') return 'Kedaluwarsa';
    if (status === 'redeemed') return 'Digunakan';
    return status;
  };

  const pendingTotal = transactions.filter(t => t.type === 'earn' && t.status === 'pending').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
        </Button>
        <h1 className="text-xl font-bold text-gray-900 mb-4">Cashback Saya</h1>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Balance Card */}
            <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="h-5 w-5 opacity-80" />
                  <span className="text-sm opacity-80">Saldo Cashback</span>
                </div>
                <p className="text-3xl font-bold mb-3">{formatPrice(balance)}</p>
                {pendingTotal > 0 && (
                  <div className="bg-white/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">{formatPrice(pendingTotal)} dalam proses</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* How to earn */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" /> Cara Mendapatkan Cashback
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada program cashback aktif.</p>
                ) : rules.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Min. belanja {formatPrice(r.min_order_amount)}
                        {r.max_cashback ? ` • Maks. ${formatPrice(r.max_cashback)}` : ''}
                        {r.category ? ` • Kategori: ${r.category}` : ''}
                      </p>
                      {r.valid_until && (
                        <p className="text-xs text-orange-600">
                          Berlaku s.d. {format(new Date(r.valid_until), 'd MMM yyyy', { locale: idLocale })}
                        </p>
                      )}
                    </div>
                    <Badge className="bg-amber-500 text-white text-sm font-bold px-2">
                      {r.cashback_percent}%
                    </Badge>
                  </div>
                ))}
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Cashback dikonfirmasi otomatis 3 hari setelah pesanan selesai. Bisa digunakan untuk transaksi berikutnya.</span>
                </div>
              </CardContent>
            </Card>

            {/* Transaction History */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Gift className="h-4 w-4 text-emerald-600" /> Riwayat Cashback
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-muted-foreground">Belum ada riwayat cashback</p>
                    <p className="text-xs text-muted-foreground mt-1">Belanja sekarang untuk dapatkan cashback!</p>
                    <Button size="sm" className="mt-3" onClick={() => navigate('/')}>
                      Belanja Sekarang
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            {txIcon(tx.type)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{txLabel(tx.type)}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.created_at), 'd MMM yyyy, HH:mm', { locale: idLocale })}
                            </p>
                            {tx.expires_at && tx.status === 'confirmed' && (
                              <p className="text-xs text-orange-500">
                                Exp: {format(new Date(tx.expires_at), 'd MMM yyyy', { locale: idLocale })}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${tx.type === 'earn' ? 'text-emerald-600' : tx.type === 'redeem' ? 'text-blue-600' : 'text-gray-400'}`}>
                            {tx.type === 'earn' ? '+' : '-'}{formatPrice(tx.amount)}
                          </p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor(tx.status)}`}>
                            {statusLabel(tx.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
