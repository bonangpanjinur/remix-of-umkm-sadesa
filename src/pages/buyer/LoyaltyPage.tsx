import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';
import { ArrowLeft, Star, Gift, Crown, Award, TrendingUp, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface LoyaltyData {
  points: number;
  tier: string;
  totalEarned: number;
  totalSpent: number;
  nextTierPoints: number;
  nextTierName: string;
}

interface PointHistory {
  id: string;
  type: string;
  points: number;
  description: string;
  created_at: string;
  expires_at: string | null;
}

const TIERS = [
  { name: 'Bronze',   min: 0,    color: '#92400e', icon: Award,  bg: 'bg-amber-50' },
  { name: 'Silver',   min: 1000, color: '#6b7280', icon: Award,  bg: 'bg-gray-50' },
  { name: 'Gold',     min: 5000, color: '#d97706', icon: Crown,  bg: 'bg-yellow-50' },
  { name: 'Platinum', min: 15000,color: '#7c3aed', icon: Crown,  bg: 'bg-purple-50' },
];

const POINT_RULES = [
  { action: 'Setiap Rp 10.000 belanja', points: 10 },
  { action: 'Review produk', points: 50 },
  { action: 'Referral teman', points: 200 },
  { action: 'Ulang tahun', points: 500 },
];

export default function LoyaltyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData>({
    points: 0, tier: 'Bronze', totalEarned: 0, totalSpent: 0, nextTierPoints: 1000, nextTierName: 'Silver',
  });
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      // Get orders to calculate points
      const { data: orders } = await (supabase as any)
        .from('orders')
        .select('total, created_at, id')
        .eq('buyer_id', user.id)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false });

      const allOrders = (orders || []) as any[];
      const totalSpent = allOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
      const earnedFromOrders = Math.floor(totalSpent / 10000) * 10;

      // Get profile for bonus points
      const { data: profile } = await supabase
        .from('profiles')
        .select('loyalty_points, loyalty_tier')
        .eq('id', user.id)
        .maybeSingle();

      const points = (profile as any)?.loyalty_points ?? earnedFromOrders;
      const tier = (profile as any)?.loyalty_tier ?? getCurrentTier(points);

      const nextTier = TIERS.find(t => t.min > points);
      setLoyaltyData({
        points,
        tier: getCurrentTier(points),
        totalEarned: points,
        totalSpent,
        nextTierPoints: nextTier?.min || points,
        nextTierName: nextTier?.name || 'Platinum',
      });

      // Build history from orders
      const hist: PointHistory[] = allOrders.slice(0, 20).map((o: any) => ({
        id: o.id,
        type: 'earn',
        points: Math.floor((o.total || 0) / 10000) * 10,
        description: `Belanja #${o.id.substring(0, 8).toUpperCase()}`,
        created_at: o.created_at,
        expires_at: null,
      })).filter((h: PointHistory) => h.points > 0);

      setHistory(hist);
    } catch (err) {
      console.error('Error fetching loyalty:', err);
    } finally {
      setLoading(false);
    }
  };

  function getCurrentTier(points: number): string {
    return [...TIERS].reverse().find(t => points >= t.min)?.name || 'Bronze';
  }

  const currentTier = TIERS.find(t => t.name === loyaltyData.tier) || TIERS[0];
  const TierIcon = currentTier.icon;
  const tierIndex = TIERS.findIndex(t => t.name === loyaltyData.tier);
  const nextTierMin = TIERS[tierIndex + 1]?.min || loyaltyData.points;
  const prevTierMin = currentTier.min;
  const tierProgress = nextTierMin > prevTierMin
    ? Math.min(100, ((loyaltyData.points - prevTierMin) / (nextTierMin - prevTierMin)) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />Kembali
        </Button>

        {/* Tier Card */}
        {loading ? (
          <div className="h-40 bg-muted rounded-2xl animate-pulse" />
        ) : (
          <Card className={`${currentTier.bg} border-0 overflow-hidden`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Program Loyalitas DesaMart</p>
                  <div className="flex items-center gap-2 mt-1">
                    <TierIcon className="h-5 w-5" style={{ color: currentTier.color }} />
                    <h2 className="text-2xl font-bold" style={{ color: currentTier.color }}>Member {loyaltyData.tier}</h2>
                  </div>
                  <div className="flex items-baseline gap-1 mt-3">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-3xl font-bold">{loyaltyData.points.toLocaleString('id-ID')}</span>
                    <span className="text-sm text-muted-foreground">poin</span>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Total Belanja</p>
                  <p className="font-semibold text-foreground">{formatPrice(loyaltyData.totalSpent)}</p>
                </div>
              </div>
              {tierIndex < TIERS.length - 1 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{loyaltyData.tier}</span>
                    <span className="text-muted-foreground">{loyaltyData.nextTierName} ({nextTierMin.toLocaleString('id-ID')} poin)</span>
                  </div>
                  <Progress value={tierProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.max(0, nextTierMin - loyaltyData.points).toLocaleString('id-ID')} poin lagi ke {loyaltyData.nextTierName}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tier Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Level Member</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {TIERS.map((t, i) => {
                const active = t.name === loyaltyData.tier;
                const unlocked = loyaltyData.points >= t.min;
                return (
                  <div key={t.name} className={`rounded-lg p-2 text-center border-2 transition-all ${
                    active ? 'border-emerald-500 bg-emerald-50' : unlocked ? 'border-muted bg-muted/30' : 'border-dashed opacity-50'
                  }`}>
                    <t.icon className="h-5 w-5 mx-auto mb-1" style={{ color: t.color }} />
                    <p className="text-xs font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.min.toLocaleString()}+</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="history">
          <TabsList className="w-full">
            <TabsTrigger value="history" className="flex-1">Riwayat Poin</TabsTrigger>
            <TabsTrigger value="earn" className="flex-1">Cara Dapat Poin</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            {history.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Star className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Belum ada riwayat poin</p>
                  <p className="text-xs mt-1">Mulai belanja untuk mendapatkan poin</p>
                  <Button size="sm" className="mt-3" onClick={() => navigate('/')}>Belanja Sekarang</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 mt-3">
                {history.map(h => (
                  <Card key={h.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Star className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{h.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(h.created_at), 'dd MMM yyyy', { locale: idLocale })}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-600">+{h.points}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="earn">
            <div className="space-y-2 mt-3">
              {POINT_RULES.map((r, i) => (
                <Card key={i}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                        <Gift className="h-4 w-4 text-yellow-600" />
                      </div>
                      <p className="text-sm">{r.action}</p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">+{r.points} poin</Badge>
                  </CardContent>
                </Card>
              ))}
              <p className="text-xs text-center text-muted-foreground mt-2">Poin berlaku 12 bulan sejak didapatkan</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
}
