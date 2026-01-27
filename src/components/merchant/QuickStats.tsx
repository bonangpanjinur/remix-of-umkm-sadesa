import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, XCircle, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';

interface QuickStatsProps {
  merchantId: string;
}

interface Stats {
  todayOrders: number;
  pendingOrders: number;
  processingOrders: number;
  completedToday: number;
  canceledToday: number;
  todayRevenue: number;
  pendingBalance: number;
  availableBalance: number;
}

export function QuickStats({ merchantId }: QuickStatsProps) {
  const [stats, setStats] = useState<Stats>({
    todayOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    completedToday: 0,
    canceledToday: 0,
    todayRevenue: 0,
    pendingBalance: 0,
    availableBalance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [merchantId]);

  const fetchStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Fetch orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total, created_at')
        .eq('merchant_id', merchantId);

      // Fetch merchant balance
      const { data: merchant } = await supabase
        .from('merchants')
        .select('available_balance, pending_balance')
        .eq('id', merchantId)
        .single();

      const todayOrders = (orders || []).filter(o => o.created_at >= todayISO);
      
      setStats({
        todayOrders: todayOrders.length,
        pendingOrders: (orders || []).filter(o => o.status === 'NEW' || o.status === 'PENDING_CONFIRMATION').length,
        processingOrders: (orders || []).filter(o => o.status === 'PROCESSED').length,
        completedToday: todayOrders.filter(o => o.status === 'DONE').length,
        canceledToday: todayOrders.filter(o => o.status === 'CANCELED').length,
        todayRevenue: todayOrders
          .filter(o => o.status === 'DONE')
          .reduce((sum, o) => sum + o.total, 0),
        pendingBalance: merchant?.pending_balance || 0,
        availableBalance: merchant?.available_balance || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statItems = [
    { 
      label: 'Pesanan Hari Ini', 
      value: stats.todayOrders, 
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    { 
      label: 'Menunggu Proses', 
      value: stats.pendingOrders, 
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    },
    { 
      label: 'Sedang Diproses', 
      value: stats.processingOrders, 
      icon: TrendingUp,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    { 
      label: 'Selesai Hari Ini', 
      value: stats.completedToday, 
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    { 
      label: 'Batal Hari Ini', 
      value: stats.canceledToday, 
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10'
    },
    { 
      label: 'Pendapatan Hari Ini', 
      value: formatPrice(stats.todayRevenue), 
      icon: Wallet,
      color: 'text-green-600',
      bgColor: 'bg-green-600/10',
      isPrice: true
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-8 w-8 bg-muted rounded" />
                <div className="h-6 bg-muted rounded w-12" />
                <div className="h-4 bg-muted rounded w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center mb-2`}>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <p className="text-2xl font-bold">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
