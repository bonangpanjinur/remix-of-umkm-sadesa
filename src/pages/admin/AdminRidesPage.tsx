import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bike, Search, RefreshCw, TrendingUp, Users, Clock, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface RideRequest {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  status: string;
  pickup_address: string;
  destination_address: string;
  distance_km: number;
  estimated_fare: number;
  final_fare: number | null;
  created_at: string;
  completed_at: string | null;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SEARCHING: 'secondary',
  ACCEPTED: 'outline',
  PICKED_UP: 'default',
  IN_TRANSIT: 'default',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
};

export default function AdminRidesPage() {
  const [rides, setRides] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, revenue: 0 });

  useEffect(() => { fetchRides(); }, [statusFilter]);

  const fetchRides = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ride_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rides = (data || []) as unknown as RideRequest[];
      setRides(rides);

      // Calculate stats
      setStats({
        total: rides.length,
        active: rides.filter(r => ['SEARCHING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'].includes(r.status)).length,
        completed: rides.filter(r => r.status === 'COMPLETED').length,
        revenue: rides.filter(r => r.status === 'COMPLETED').reduce((sum, r) => sum + (r.final_fare || r.estimated_fare), 0),
      });
    } catch {
      toast({ title: 'Gagal memuat data ojek', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredRides = rides.filter(r =>
    !search || r.pickup_address.toLowerCase().includes(search.toLowerCase()) || r.destination_address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Ojek Desa" subtitle="Kelola perjalanan ojek desa">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bike className="h-6 w-6 text-primary" />
              Ojek Desa
            </h1>
            <p className="text-sm text-muted-foreground">Kelola perjalanan ojek dan pengaturan tarif</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRides}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Perjalanan', value: stats.total, icon: Bike, color: 'text-primary' },
            { label: 'Aktif', value: stats.active, icon: Clock, color: 'text-amber-500' },
            { label: 'Selesai', value: stats.completed, icon: TrendingUp, color: 'text-emerald-500' },
            { label: 'Pendapatan', value: formatPrice(stats.revenue), icon: DollarSign, color: 'text-primary' },
          ].map((stat) => (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-xl font-bold">{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari alamat..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value="SEARCHING">Mencari</SelectItem>
              <SelectItem value="ACCEPTED">Diterima</SelectItem>
              <SelectItem value="PICKED_UP">Dijemput</SelectItem>
              <SelectItem value="IN_TRANSIT">Dalam Perjalanan</SelectItem>
              <SelectItem value="COMPLETED">Selesai</SelectItem>
              <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Rides List */}
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Memuat...</div>
        ) : filteredRides.length === 0 ? (
          <Card className="p-8 text-center">
            <Bike className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Belum ada perjalanan ojek</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredRides.map((ride) => (
              <Card key={ride.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">#{ride.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ride.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Badge variant={STATUS_COLORS[ride.status] || 'outline'}>{ride.status}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Jemput: </span>
                    <span>{ride.pickup_address}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tujuan: </span>
                    <span>{ride.destination_address}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>{ride.distance_km} km</span>
                  <span className="font-medium text-foreground">{formatPrice(ride.final_fare || ride.estimated_fare)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
