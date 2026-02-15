import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';

interface DailySummaryCardProps {
  merchantId: string;
}

export function DailySummaryCard({ merchantId }: DailySummaryCardProps) {
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDailySummary();
  }, [merchantId]);

  const fetchDailySummary = async () => {
    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      const yesterdayStart = yesterday.toISOString();
      const yesterdayEnd = todayStart;

      // Today's orders
      const { data: todayData } = await supabase
        .from('orders')
        .select('total, status')
        .eq('merchant_id', merchantId)
        .gte('created_at', todayStart);

      const doneToday = todayData?.filter(o => o.status === 'DONE') || [];
      setTodayRevenue(doneToday.reduce((s, o) => s + o.total, 0));
      setTodayOrders(todayData?.length || 0);

      // Pending orders
      const pending = todayData?.filter(o => ['NEW', 'PENDING_CONFIRMATION'].includes(o.status)) || [];
      setPendingOrders(pending.length);

      // Yesterday's revenue
      const { data: yesterdayData } = await supabase
        .from('orders')
        .select('total, status')
        .eq('merchant_id', merchantId)
        .gte('created_at', yesterdayStart)
        .lt('created_at', yesterdayEnd)
        .eq('status', 'DONE');

      setYesterdayRevenue(yesterdayData?.reduce((s, o) => s + o.total, 0) || 0);
    } catch (error) {
      console.error('Error fetching daily summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const percentChange = yesterdayRevenue > 0
    ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
    : todayRevenue > 0 ? 100 : 0;

  if (loading) return null;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="pt-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Hari Ini</span>
            </div>
            <p className="text-xl font-bold text-primary">{formatPrice(todayRevenue)}</p>
            <div className="flex items-center gap-1 mt-1">
              {percentChange >= 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <span className={`text-xs font-medium ${percentChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(0)}% vs kemarin
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pesanan</span>
            </div>
            <p className="text-xl font-bold">{todayOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">hari ini</p>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <Clock className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">Menunggu</span>
            </div>
            <p className="text-xl font-bold text-warning">{pendingOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">perlu diproses</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
