import { useState, useEffect, useCallback, useRef } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ChefHat, Clock, CheckCircle, ArrowLeft, RefreshCw,
  Flame, Bell, Table2, Maximize2, Minimize2
} from 'lucide-react';
import { format, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface TableOrder {
  id: string;
  table_id: string | null;
  table_name: string | null;
  order_number: string;
  status: 'pending' | 'cooking' | 'ready' | 'served' | 'paid' | 'cancelled';
  items: any[];
  notes: string | null;
  customer_name: string | null;
  cashier_name: string | null;
  priority: number;
  cooking_started_at: string | null;
  ready_at: string | null;
  created_at: string;
}

const STATUS_CONFIG = {
  pending: {
    label: 'Menunggu',
    bg: 'bg-yellow-900/30 border-yellow-500',
    header: 'bg-yellow-500',
    badge: 'bg-yellow-500 text-black',
    dot: 'bg-yellow-400 animate-pulse',
  },
  cooking: {
    label: 'Sedang Dimasak',
    bg: 'bg-orange-900/30 border-orange-500',
    header: 'bg-orange-500',
    badge: 'bg-orange-500 text-white',
    dot: 'bg-orange-400 animate-pulse',
  },
  ready: {
    label: 'Siap Disajikan',
    bg: 'bg-emerald-900/30 border-emerald-500',
    header: 'bg-emerald-500',
    badge: 'bg-emerald-500 text-white',
    dot: 'bg-emerald-400',
  },
};

const COLUMNS: Array<{ key: 'pending' | 'cooking' | 'ready'; label: string; icon: any; color: string }> = [
  { key: 'pending',  label: 'Antrian',       icon: Clock,        color: 'text-yellow-400' },
  { key: 'cooking',  label: 'Sedang Dimasak', icon: Flame,        color: 'text-orange-400' },
  { key: 'ready',    label: 'Siap Disajikan', icon: CheckCircle,  color: 'text-emerald-400' },
];

function ElapsedTimer({ since, warnAfter = 10 }: { since: string; warnAfter?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed(differenceInSeconds(new Date(), new Date(since)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isWarn = mins >= warnAfter;
  return (
    <span className={`font-mono text-sm font-bold ${isWarn ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}>
      {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

export default function POSKDSPage() {
  const { tenant, activeOutlet } = usePOS();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevOrderIds = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // ignore audio errors
    }
  }, [soundEnabled]);

  const fetchOrders = useCallback(async () => {
    if (!tenant) return;
    try {
      let q = supabase
        .from('pos_table_orders' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .in('status', ['pending', 'cooking', 'ready'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });
      if (activeOutlet) q = q.eq('outlet_id', activeOutlet.id);
      const { data, error } = await q;
      if (error) throw error;
      const newOrders = (data || []) as unknown as TableOrder[];

      // Play beep for new orders
      const newIds = new Set(newOrders.map(o => o.id));
      const hasNew = newOrders.some(o => !prevOrderIds.current.has(o.id));
      if (hasNew && prevOrderIds.current.size > 0) playBeep();
      prevOrderIds.current = newIds;

      setOrders(newOrders);
      setLastUpdate(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tenant, activeOutlet, playBeep]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Realtime subscription
  useEffect(() => {
    if (!tenant) return;
    const channel = supabase
      .channel('kds-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'pos_table_orders',
        filter: `tenant_id=eq.${tenant.id}`,
      }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant, fetchOrders]);

  // Auto-refresh every 30s as fallback
  useEffect(() => {
    const id = setInterval(fetchOrders, 30000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    try {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'cooking') updates.cooking_started_at = new Date().toISOString();
      if (status === 'ready') updates.ready_at = new Date().toISOString();
      if (status === 'served') updates.served_at = new Date().toISOString();
      await supabase.from('pos_table_orders' as any).update(updates).eq('id', orderId);
      playBeep();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const byStatus = (status: 'pending' | 'cooking' | 'ready') =>
    orders.filter(o => o.status === status);

  const totalActive = orders.length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost" size="sm"
            onClick={() => navigate('/pos/meja')}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Keluar
          </Button>
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-orange-400" />
            <div>
              <h1 className="font-bold text-lg leading-none">Kitchen Display System</h1>
              <p className="text-xs text-gray-400">
                {tenant?.name}{activeOutlet ? ` — ${(activeOutlet as any).name}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400">Update terakhir</p>
            <p className="text-sm font-mono">{format(lastUpdate, 'HH:mm:ss')}</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${totalActive > 0 ? 'bg-orange-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-sm font-bold">{totalActive} Aktif</span>
          </div>
          <Button
            variant="ghost" size="sm"
            onClick={() => setSoundEnabled(s => !s)}
            className={`${soundEnabled ? 'text-yellow-400' : 'text-gray-600'} hover:bg-gray-800`}
            title={soundEnabled ? 'Matikan notifikasi suara' : 'Aktifkan notifikasi suara'}
          >
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchOrders} className="text-gray-400 hover:text-white hover:bg-gray-800">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="text-gray-400 hover:text-white hover:bg-gray-800">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-0 border-b border-gray-700">
        {COLUMNS.map(col => {
          const Icon = col.icon;
          const count = byStatus(col.key).length;
          return (
            <div key={col.key} className="flex items-center justify-center gap-2 py-3 border-r border-gray-700 last:border-r-0">
              <Icon className={`h-5 w-5 ${col.color}`} />
              <span className="font-semibold">{col.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                count > 0 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-400 mx-auto mb-3" />
            <p className="text-gray-400">Memuat data dapur...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-3 divide-x divide-gray-700 overflow-hidden">
          {COLUMNS.map(col => {
            const colOrders = byStatus(col.key);
            const cfg = STATUS_CONFIG[col.key];
            return (
              <div key={col.key} className="overflow-y-auto p-3 space-y-3">
                {colOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                    <ChefHat className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">Kosong</p>
                  </div>
                ) : (
                  colOrders.map(order => {
                    const elapsedMins = differenceInMinutes(new Date(), new Date(order.created_at));
                    const isUrgent = elapsedMins >= 15;
                    const timerSince = col.key === 'cooking' && order.cooking_started_at
                      ? order.cooking_started_at
                      : order.created_at;

                    return (
                      <div
                        key={order.id}
                        className={`rounded-xl border-2 overflow-hidden ${cfg.bg} ${isUrgent && col.key !== 'ready' ? 'border-red-500 shadow-lg shadow-red-900/20' : ''}`}
                      >
                        {/* Card Header */}
                        <div className={`${isUrgent && col.key !== 'ready' ? 'bg-red-600' : cfg.header} px-3 py-2 flex items-center justify-between`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                            <span className="font-bold text-sm">{order.order_number}</span>
                          </div>
                          <ElapsedTimer
                            since={timerSince}
                            warnAfter={col.key === 'cooking' ? 8 : 12}
                          />
                        </div>

                        {/* Table & Customer */}
                        <div className="px-3 py-2 border-b border-white/10">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Table2 className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-sm font-semibold">
                                {order.table_name || 'Take Away'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">
                              {format(new Date(order.created_at), 'HH:mm', { locale: idLocale })}
                            </span>
                          </div>
                          {order.customer_name && (
                            <p className="text-xs text-gray-400 mt-0.5">{order.customer_name}</p>
                          )}
                        </div>

                        {/* Items */}
                        <div className="px-3 py-2 space-y-1">
                          {order.items.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">Item pesanan belum ditambahkan</p>
                          ) : (
                            order.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-start justify-between gap-2">
                                <span className="text-sm text-gray-100 flex-1">{item.name || item.product_name || 'Item'}</span>
                                <span className="text-sm font-bold text-white shrink-0">×{item.qty}</span>
                              </div>
                            ))
                          )}
                          {order.notes && (
                            <div className="mt-2 bg-yellow-900/30 border border-yellow-700/40 rounded px-2 py-1">
                              <p className="text-xs text-yellow-300">📝 {order.notes}</p>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="px-3 pb-3 pt-1 flex gap-2">
                          {col.key === 'pending' && (
                            <Button
                              size="sm"
                              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs"
                              onClick={() => updateStatus(order.id, 'cooking')}
                            >
                              <Flame className="h-3.5 w-3.5 mr-1" /> Mulai Masak
                            </Button>
                          )}
                          {col.key === 'cooking' && (
                            <Button
                              size="sm"
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                              onClick={() => updateStatus(order.id, 'ready')}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Siap Saji
                            </Button>
                          )}
                          {col.key === 'ready' && (
                            <Button
                              size="sm"
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                              onClick={() => updateStatus(order.id, 'served')}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Sudah Disajikan
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Clock */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
        <span>KDS DesaMart POS — realtime via Supabase</span>
        <LiveClock />
      </div>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-gray-300 text-sm">
      {format(time, 'EEEE, dd MMMM yyyy — HH:mm:ss', { locale: idLocale })}
    </span>
  );
}
