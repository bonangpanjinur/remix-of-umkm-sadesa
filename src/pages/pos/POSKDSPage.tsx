import { useState, useEffect, useCallback, useRef } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ChefHat, Clock, CheckCircle, ArrowLeft, RefreshCw,
  Flame, Bell, Table2, Maximize2, Minimize2, QrCode
} from 'lucide-react';
import { format, differenceInSeconds, differenceInMinutes } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface TableOrder {
  id: string;
  table_id: string | null;
  table_name: string | null;
  order_number: string;
  status: 'pending' | 'cooking' | 'ready' | 'served' | 'paid' | 'cancelled';
  items: Array<{ name?: string; product_name?: string; qty: number; notes?: string }>;
  notes: string | null;
  customer_name: string | null;
  source: string | null;
  cooking_started_at: string | null;
  ready_at: string | null;
  created_at: string;
}

const STATUS_CONFIG = {
  pending: {
    label: 'Menunggu',
    bg: 'bg-yellow-900/30 border-yellow-500',
    header: 'bg-yellow-500',
    dot: 'bg-yellow-400 animate-pulse',
  },
  cooking: {
    label: 'Sedang Dimasak',
    bg: 'bg-orange-900/30 border-orange-500',
    header: 'bg-orange-500',
    dot: 'bg-orange-400 animate-pulse',
  },
  ready: {
    label: 'Siap Disajikan',
    bg: 'bg-emerald-900/30 border-emerald-500',
    header: 'bg-emerald-500',
    dot: 'bg-emerald-400',
  },
};

const COLUMNS: Array<{ key: 'pending' | 'cooking' | 'ready'; label: string; icon: any; color: string }> = [
  { key: 'pending',  label: 'Antrian',        icon: Clock,       color: 'text-yellow-400' },
  { key: 'cooking',  label: 'Sedang Dimasak',  icon: Flame,       color: 'text-orange-400' },
  { key: 'ready',    label: 'Siap Disajikan',  icon: CheckCircle, color: 'text-emerald-400' },
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

function parseItems(raw: any): TableOrder['items'] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
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

  const playBeep = useCallback((pattern: 'new' | 'action' = 'new') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const notes = pattern === 'new'
        ? [{ f: 880, t: 0, d: 0.12 }, { f: 1100, t: 0.14, d: 0.12 }, { f: 1320, t: 0.28, d: 0.18 }]
        : [{ f: 660, t: 0, d: 0.15 }];
      notes.forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = f; osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + t + d);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + d + 0.05);
      });
    } catch { /* ignore */ }
  }, [soundEnabled]);

  const fetchOrders = useCallback(async () => {
    if (!tenant) return;
    try {
      let q = supabase
        .from('pos_table_orders' as any)
        .select('id, table_id, table_name, order_number, status, items, notes, customer_name, source, cooking_started_at, ready_at, created_at')
        .eq('tenant_id', tenant.id)
        .in('status', ['pending', 'cooking', 'ready'])
        .order('created_at', { ascending: true });
      if (activeOutlet) q = (q as any).eq('outlet_id', activeOutlet.id);
      const { data, error } = await q;
      if (error) throw error;

      const newOrders = ((data || []) as any[]).map(o => ({
        ...o,
        items: parseItems(o.items),
      })) as TableOrder[];

      const newIds = new Set(newOrders.map(o => o.id));
      const hasNew = newOrders.some(o => !prevOrderIds.current.has(o.id));
      if (hasNew && prevOrderIds.current.size > 0) playBeep('new');
      prevOrderIds.current = newIds;

      setOrders(newOrders);
      setLastUpdate(new Date());
    } catch (err: any) {
      // silent fail — fallback timer will retry
    } finally {
      setLoading(false);
    }
  }, [tenant, activeOutlet, playBeep]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Realtime: postgres_changes (status updates from kasir/kds)
  useEffect(() => {
    if (!tenant) return;
    const ch = supabase
      .channel('kds-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'pos_table_orders',
        filter: `tenant_id=eq.${tenant.id}`,
      }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenant, fetchOrders]);

  // Realtime: broadcast channel untuk pesanan QR baru
  useEffect(() => {
    if (!tenant) return;
    const channelName = `pos_qr_orders:${tenant.id}`;

    // Daftarkan ke server agar SSE dikirim ke client ini
    const token = localStorage.getItem('session_token');
    if (token) {
      fetch('/api/sse/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel: channelName }),
      }).catch(() => {});
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'broadcast' && detail?.channel === channelName && detail?.event === 'new_order') {
        fetchOrders();
      }
    };
    window.addEventListener('sse_broadcast', handler as EventListener);
    return () => window.removeEventListener('sse_broadcast', handler as EventListener);
  }, [tenant, fetchOrders]);

  // Auto-refresh setiap 30 detik sebagai fallback
  useEffect(() => {
    const id = setInterval(fetchOrders, 30000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'cooking') updates.cooking_started_at = new Date().toISOString();
    if (newStatus === 'ready')   updates.ready_at = new Date().toISOString();
    if (newStatus === 'served')  updates.served_at = new Date().toISOString();

    // Optimistic update
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, ...updates } : o
    ).filter(o => ['pending','cooking','ready'].includes(o.status)));

    try {
      const { error } = await supabase
        .from('pos_table_orders' as any)
        .update(updates)
        .eq('id', orderId);
      if (error) throw error;
      playBeep('action');
      setLastUpdate(new Date());
    } catch (err: any) {
      toast.error('Gagal update status: ' + err.message);
      fetchOrders(); // rollback
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

  const byStatus = (s: 'pending' | 'cooking' | 'ready') => orders.filter(o => o.status === s);
  const totalActive = orders.length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost" size="sm"
            onClick={() => navigate('/pos')}
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
            <p className="text-xs text-gray-500">Update terakhir</p>
            <p className="text-sm font-mono">{format(lastUpdate, 'HH:mm:ss')}</p>
          </div>

          {/* Active counter */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${totalActive > 0 ? 'bg-orange-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-sm font-bold">{totalActive} Aktif</span>
          </div>

          {/* QR orders badge */}
          {orders.some(o => o.source === 'qr_menu') && (
            <div className="flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-700 rounded-lg px-2.5 py-1.5">
              <QrCode className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-300 font-semibold">
                {orders.filter(o => o.source === 'qr_menu' && o.status === 'pending').length} QR baru
              </span>
            </div>
          )}

          <Button
            variant="ghost" size="sm"
            onClick={() => setSoundEnabled(s => !s)}
            className={soundEnabled ? 'text-yellow-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-800'}
            title={soundEnabled ? 'Matikan suara' : 'Aktifkan suara'}
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

      {/* ── Column Headers ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-0 border-b border-gray-700 shrink-0">
        {COLUMNS.map(col => {
          const Icon = col.icon;
          const count = byStatus(col.key).length;
          return (
            <div key={col.key} className="flex items-center justify-center gap-2 py-3 border-r border-gray-700 last:border-r-0">
              <Icon className={`h-5 w-5 ${col.color}`} />
              <span className="font-semibold text-sm sm:text-base">{col.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${count > 0 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Board ─────────────────────────────────────────────── */}
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
                    const isUrgent = col.key !== 'ready' && differenceInMinutes(new Date(), new Date(order.created_at)) >= 15;
                    const timerSince = col.key === 'cooking' && order.cooking_started_at
                      ? order.cooking_started_at
                      : order.created_at;
                    const isQR = order.source === 'qr_menu';

                    return (
                      <div
                        key={order.id}
                        className={`rounded-xl border-2 overflow-hidden ${cfg.bg} ${isUrgent ? 'border-red-500 shadow-lg shadow-red-900/20' : ''}`}
                      >
                        {/* Card Header */}
                        <div className={`${isUrgent ? 'bg-red-600' : cfg.header} px-3 py-2 flex items-center justify-between`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            <span className="font-bold text-sm">{order.order_number}</span>
                            {isQR && (
                              <span className="flex items-center gap-0.5 text-[10px] bg-black/25 rounded px-1.5 py-0.5 font-semibold">
                                <QrCode className="h-2.5 w-2.5" /> QR
                              </span>
                            )}
                          </div>
                          <ElapsedTimer since={timerSince} warnAfter={col.key === 'cooking' ? 8 : 12} />
                        </div>

                        {/* Table & Customer */}
                        <div className="px-3 py-2 border-b border-white/10">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Table2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              <span className="text-sm font-semibold truncate">
                                {order.table_name || 'Take Away'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">
                              {format(new Date(order.created_at), 'HH:mm', { locale: idLocale })}
                            </span>
                          </div>
                          {order.customer_name && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{order.customer_name}</p>
                          )}
                        </div>

                        {/* Items */}
                        <div className="px-3 py-2 space-y-1.5">
                          {order.items.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">Tidak ada item</p>
                          ) : (
                            order.items.map((item, idx) => (
                              <div key={idx}>
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-sm text-gray-100 flex-1 leading-snug">
                                    {item.name || item.product_name || 'Item'}
                                  </span>
                                  <span className="text-sm font-bold text-white shrink-0">×{item.qty}</span>
                                </div>
                                {item.notes && (
                                  <p className="text-[11px] text-amber-400 italic ml-1">↳ {item.notes}</p>
                                )}
                              </div>
                            ))
                          )}
                          {order.notes && (
                            <div className="mt-1.5 bg-yellow-900/30 border border-yellow-700/40 rounded px-2 py-1">
                              <p className="text-xs text-yellow-300">📝 {order.notes}</p>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="px-3 pb-3 pt-1">
                          {col.key === 'pending' && (
                            <Button
                              size="sm"
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-9 text-sm font-semibold"
                              onClick={() => updateStatus(order.id, 'cooking')}
                            >
                              <Flame className="h-4 w-4 mr-1.5" /> Mulai Masak
                            </Button>
                          )}
                          {col.key === 'cooking' && (
                            <Button
                              size="sm"
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm font-semibold"
                              onClick={() => updateStatus(order.id, 'ready')}
                            >
                              <CheckCircle className="h-4 w-4 mr-1.5" /> Siap Saji
                            </Button>
                          )}
                          {col.key === 'ready' && (
                            <Button
                              size="sm"
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm font-semibold"
                              onClick={() => updateStatus(order.id, 'served')}
                            >
                              <CheckCircle className="h-4 w-4 mr-1.5" /> Sudah Disajikan
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

      {/* ── Footer Clock ─────────────────────────────────────── */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-500 shrink-0">
        <span>KDS DesaMart POS — realtime via SSE</span>
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
