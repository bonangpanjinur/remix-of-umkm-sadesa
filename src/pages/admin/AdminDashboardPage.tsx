import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Store, MapPin, Bike, Clock, CheckCheck, X, Calendar, RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { ApprovalCard } from '@/components/admin/ApprovalCard';
import { SalesAreaChart, OrdersBarChart } from '@/components/admin/SalesChart';
import { RealtimeIndicator } from '@/components/admin/RealtimeIndicator';
import { LiveActivityFeed } from '@/components/admin/LiveActivityFeed';
import { LiveStatsGrid } from '@/components/admin/LiveStatsGrid';
import { useRealtimeStats } from '@/hooks/useRealtimeStats';
import { fetchPendingMerchants, fetchPendingVillages, fetchPendingCouriers, approveMerchant, rejectMerchant, approveVillage, rejectVillage, approveCourier, rejectCourier } from '@/lib/adminApi';
import type { Courier } from '@/types/admin';
import type { Village, Merchant } from '@/types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { subDays, startOfDay, endOfDay } from 'date-fns';

interface OrderData {
  total: number;
  created_at: string;
  status: string;
}

interface SalesChartData {
  date: string;
  revenue: number;
  orders: number;
}

interface SelectedItem {
  id: string;
  type: 'merchant' | 'village' | 'courier';
  name: string;
}

export default function AdminDashboardPage() {
  // Realtime stats hook
  const { stats: realtimeStats, recentEvents, isConnected, loading: realtimeLoading, refresh: refreshRealtime } = useRealtimeStats();
  
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState('14days');

  // Bulk action states
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject'>('approve');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case '7days':
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now), days: 7 };
      case '14days':
        return { start: startOfDay(subDays(now, 14)), end: endOfDay(now), days: 14 };
      case '30days':
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now), days: 30 };
      default:
        return { start: startOfDay(subDays(now, 14)), end: endOfDay(now), days: 14 };
    }
  };

  // React Query: parallel fetching with caching (P3-01)
  const { data: pendingMerchants = [], isLoading: merchantsLoading } = useQuery<Merchant[]>({
    queryKey: ['admin-pending-merchants'],
    queryFn: fetchPendingMerchants,
    staleTime: 30_000,
  });

  const { data: pendingVillages = [], isLoading: villagesLoading } = useQuery<Village[]>({
    queryKey: ['admin-pending-villages'],
    queryFn: fetchPendingVillages,
    staleTime: 30_000,
  });

  const { data: pendingCouriers = [], isLoading: couriersLoading } = useQuery<Courier[]>({
    queryKey: ['admin-pending-couriers'],
    queryFn: fetchPendingCouriers,
    staleTime: 30_000,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<OrderData[]>({
    queryKey: ['admin-orders-chart', dateRange],
    queryFn: async () => {
      const { start } = getDateRange();
      const { data } = await supabase
        .from('orders')
        .select('total, created_at, status')
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: true });
      return data || [];
    },
    staleTime: 60_000,
  });

  const loading = merchantsLoading || villagesLoading || couriersLoading || ordersLoading;

  const loadData = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-pending-merchants'] });
    queryClient.invalidateQueries({ queryKey: ['admin-pending-villages'] });
    queryClient.invalidateQueries({ queryKey: ['admin-pending-couriers'] });
    queryClient.invalidateQueries({ queryKey: ['admin-orders-chart', dateRange] });
  };

  // Calculate chart data from orders
  const salesChartData = useMemo<SalesChartData[]>(() => {
    const dateMap = new Map<string, { revenue: number; orders: number }>();
    const { days } = getDateRange();
    
    orders.forEach((order) => {
      const date = order.created_at.split('T')[0];
      const existing = dateMap.get(date) || { revenue: 0, orders: 0 };
      dateMap.set(date, {
        revenue: existing.revenue + (order.status === 'DONE' ? order.total : 0),
        orders: existing.orders + 1,
      });
    });

    // Fill in missing dates
    const result: SalesChartData[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const data = dateMap.get(date) || { revenue: 0, orders: 0 };
      result.push({ date, ...data });
    }
    
    return result;
  }, [orders, dateRange]);


  // Selection handlers
  const handleSelectItem = (item: SelectedItem, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, item]);
    } else {
      setSelectedItems(prev => prev.filter(i => i.id !== item.id));
    }
  };

  const handleSelectAll = (type: 'merchant' | 'village' | 'courier', items: Array<{ id: string; name: string }>, checked: boolean) => {
    if (checked) {
      const newItems = items.map(i => ({ id: i.id, type, name: i.name }));
      setSelectedItems(prev => [...prev.filter(i => i.type !== type), ...newItems]);
    } else {
      setSelectedItems(prev => prev.filter(i => i.type !== type));
    }
  };

  const isSelected = (id: string) => selectedItems.some(i => i.id === id);
  const getSelectedByType = (type: 'merchant' | 'village' | 'courier') => selectedItems.filter(i => i.type === type);

  // Bulk action handlers
  const handleBulkAction = async () => {
    if (selectedItems.length === 0) return;
    if (bulkAction === 'reject' && !bulkReason.trim()) {
      toast.error('Alasan penolakan harus diisi');
      return;
    }

    setBulkLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of selectedItems) {
      try {
        let success = false;
        if (bulkAction === 'approve') {
          if (item.type === 'merchant') success = await approveMerchant(item.id);
          else if (item.type === 'village') success = await approveVillage(item.id);
          else if (item.type === 'courier') success = await approveCourier(item.id);
        } else {
          if (item.type === 'merchant') success = await rejectMerchant(item.id, bulkReason);
          else if (item.type === 'village') success = await rejectVillage(item.id, bulkReason);
          else if (item.type === 'courier') success = await rejectCourier(item.id, bulkReason);
        }
        
        if (success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setBulkLoading(false);
    setBulkDialogOpen(false);
    setBulkReason('');
    setSelectedItems([]);

    if (successCount > 0) {
      toast.success(`${successCount} item berhasil ${bulkAction === 'approve' ? 'disetujui' : 'ditolak'}`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} item gagal diproses`);
    }

    loadData();
  };

  const handleApproveMerchant = async (id: string) => {
    const success = await approveMerchant(id);
    if (success) {
      toast.success('Merchant berhasil disetujui');
      loadData();
    } else {
      toast.error('Gagal menyetujui merchant');
    }
  };

  const handleRejectMerchant = async (id: string, reason: string) => {
    const success = await rejectMerchant(id, reason);
    if (success) {
      toast.success('Merchant ditolak');
      loadData();
    } else {
      toast.error('Gagal menolak merchant');
    }
  };

  const handleApproveVillage = async (id: string) => {
    const success = await approveVillage(id);
    if (success) {
      toast.success('Desa wisata berhasil disetujui');
      loadData();
    } else {
      toast.error('Gagal menyetujui desa wisata');
    }
  };

  const handleRejectVillage = async (id: string, reason: string) => {
    const success = await rejectVillage(id, reason);
    if (success) {
      toast.success('Desa wisata ditolak');
      loadData();
    } else {
      toast.error('Gagal menolak desa wisata');
    }
  };

  const handleApproveCourier = async (id: string) => {
    const success = await approveCourier(id);
    if (success) {
      toast.success('Kurir berhasil disetujui');
      loadData();
    } else {
      toast.error('Gagal menyetujui kurir');
    }
  };

  const handleRejectCourier = async (id: string, reason: string) => {
    const success = await rejectCourier(id, reason);
    if (success) {
      toast.success('Kurir ditolak');
      loadData();
    } else {
      toast.error('Gagal menolak kurir');
    }
  };

  const totalPending = pendingMerchants.length + pendingVillages.length + pendingCouriers.length;

  return (
    <AdminLayout title="Dashboard" subtitle="Kelola dan pantau aktivitas aplikasi">
      {loading || realtimeLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Realtime Indicator & Date Range Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <RealtimeIndicator 
                isConnected={isConnected} 
                lastUpdated={realtimeStats.lastUpdated} 
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  refreshRealtime();
                  loadData();
                }}
                className="text-muted-foreground"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">7 Hari</SelectItem>
                  <SelectItem value="14days">14 Hari</SelectItem>
                  <SelectItem value="30days">30 Hari</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Live Stats Grid - Real-time data */}
          <LiveStatsGrid stats={realtimeStats} className="mb-8" />

          {/* Charts & Activity Feed */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 space-y-6">
              <SalesAreaChart data={salesChartData} title={`Pendapatan ${dateRange === '7days' ? '7' : dateRange === '14days' ? '14' : '30'} Hari Terakhir`} />
              <OrdersBarChart data={salesChartData} title={`Jumlah Pesanan ${dateRange === '7days' ? '7' : dateRange === '14days' ? '14' : '30'} Hari Terakhir`} />
            </div>
            <LiveActivityFeed events={recentEvents} />
          </div>

          {/* Pending Approvals */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Menunggu Persetujuan</h2>
                {totalPending > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                    {totalPending}
                  </span>
                )}
              </div>
              
              {/* Bulk Actions */}
              {selectedItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedItems.length} dipilih</span>
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={() => {
                      setBulkAction('approve');
                      setBulkDialogOpen(true);
                    }}
                  >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Setujui Semua
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => {
                      setBulkAction('reject');
                      setBulkDialogOpen(true);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Tolak Semua
                  </Button>
                </div>
              )}
            </div>

            {totalPending === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <p className="text-muted-foreground">Tidak ada pendaftaran yang menunggu persetujuan</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pending Merchants */}
                {pendingMerchants.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        checked={getSelectedByType('merchant').length === pendingMerchants.length}
                        onCheckedChange={(checked) => handleSelectAll('merchant', pendingMerchants, !!checked)}
                      />
                      <span className="text-sm font-medium text-muted-foreground">Merchant ({pendingMerchants.length})</span>
                    </div>
                    {pendingMerchants.map((merchant) => (
                      <div key={merchant.id} className="flex items-start gap-2 mb-2">
                        <Checkbox
                          checked={isSelected(merchant.id)}
                          onCheckedChange={(checked) => handleSelectItem({ id: merchant.id, type: 'merchant', name: merchant.name }, !!checked)}
                          className="mt-4"
                        />
                        <div className="flex-1">
                          <ApprovalCard
                            type="merchant"
                            id={merchant.id}
                            name={merchant.name}
                            subtitle={merchant.businessCategory}
                            details={{
                              phone: merchant.phone,
                              location: `${merchant.district}, ${merchant.city}`,
                            }}
                            registeredAt={merchant.registeredAt}
                            onApprove={handleApproveMerchant}
                            onReject={handleRejectMerchant}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending Villages */}
                {pendingVillages.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        checked={getSelectedByType('village').length === pendingVillages.length}
                        onCheckedChange={(checked) => handleSelectAll('village', pendingVillages, !!checked)}
                      />
                      <span className="text-sm font-medium text-muted-foreground">Desa Wisata ({pendingVillages.length})</span>
                    </div>
                    {pendingVillages.map((village) => (
                      <div key={village.id} className="flex items-start gap-2 mb-2">
                        <Checkbox
                          checked={isSelected(village.id)}
                          onCheckedChange={(checked) => handleSelectItem({ id: village.id, type: 'village', name: village.name }, !!checked)}
                          className="mt-4"
                        />
                        <div className="flex-1">
                          <ApprovalCard
                            type="village"
                            id={village.id}
                            name={village.name}
                            subtitle={`${village.district}, ${village.regency}`}
                            details={{
                              phone: village.contactPhone,
                              email: village.contactEmail,
                            }}
                            registeredAt={village.registeredAt}
                            onApprove={handleApproveVillage}
                            onReject={handleRejectVillage}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending Couriers */}
                {pendingCouriers.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        checked={getSelectedByType('courier').length === pendingCouriers.length}
                        onCheckedChange={(checked) => handleSelectAll('courier', pendingCouriers, !!checked)}
                      />
                      <span className="text-sm font-medium text-muted-foreground">Kurir ({pendingCouriers.length})</span>
                    </div>
                    {pendingCouriers.map((courier) => (
                      <div key={courier.id} className="flex items-start gap-2 mb-2">
                        <Checkbox
                          checked={isSelected(courier.id)}
                          onCheckedChange={(checked) => handleSelectItem({ id: courier.id, type: 'courier', name: courier.name }, !!checked)}
                          className="mt-4"
                        />
                        <div className="flex-1">
                          <ApprovalCard
                            type="courier"
                            id={courier.id}
                            name={courier.name}
                            subtitle={`${courier.vehicleType} - ${courier.vehiclePlate || 'Belum ada plat'}`}
                            details={{
                              phone: courier.phone,
                              email: courier.email,
                              location: `${courier.district}, ${courier.city}`,
                            }}
                            imageUrl={courier.photoUrl}
                            registeredAt={courier.registeredAt}
                            onApprove={handleApproveCourier}
                            onReject={handleRejectCourier}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bulk Action Dialog */}
          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {bulkAction === 'approve' ? 'Setujui Semua' : 'Tolak Semua'} ({selectedItems.length} item)
                </DialogTitle>
                <DialogDescription>
                  {bulkAction === 'approve' 
                    ? 'Semua item yang dipilih akan disetujui dan diaktifkan.'
                    : 'Semua item yang dipilih akan ditolak. Berikan alasan penolakan.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="max-h-40 overflow-auto">
                  {selectedItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm py-1">
                      <span className="px-2 py-0.5 rounded bg-secondary text-xs">{item.type}</span>
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
                {bulkAction === 'reject' && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Alasan Penolakan *</label>
                    <Textarea
                      value={bulkReason}
                      onChange={(e) => setBulkReason(e.target.value)}
                      placeholder="Jelaskan alasan penolakan..."
                      rows={3}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                  Batal
                </Button>
                <Button 
                  variant={bulkAction === 'approve' ? 'default' : 'destructive'}
                  onClick={handleBulkAction}
                  disabled={bulkLoading || (bulkAction === 'reject' && !bulkReason.trim())}
                >
                  {bulkLoading ? 'Memproses...' : bulkAction === 'approve' ? 'Setujui Semua' : 'Tolak Semua'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </AdminLayout>
  );
}
