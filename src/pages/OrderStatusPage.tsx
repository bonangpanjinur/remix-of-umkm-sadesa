/**
 * Halaman status pesanan untuk pelanggan (publik, tanpa login).
 * Polling setiap 5 detik, menampilkan progress visual real-time.
 * URL: /order/:tenantId/:orderId
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, ChefHat, Clock, Utensils, Star, RefreshCw, ArrowLeft, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

type OrderStatus = 'pending' | 'cooking' | 'ready' | 'served' | 'paid' | 'cancelled';

interface OrderData {
  id: string;
  order_number: string;
  status: OrderStatus;
  items: Array<{ name?: string; product_name?: string; qty: number; notes?: string | null }>;
  notes: string | null;
  customer_name: string | null;
  table_name: string | null;
  source: string | null;
  cooking_started_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  created_at: string;
  updated_at: string;
}

const STEPS: Array<{
  key: OrderStatus[];
  icon: any;
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  ring: string;
}> = [
  {
    key: ['pending'],
    icon: Clock,
    label: 'Pesanan Diterima',
    sublabel: 'Pesanan kamu sudah masuk ke dapur',
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
    ring: 'ring-yellow-400',
  },
  {
    key: ['cooking'],
    icon: ChefHat,
    label: 'Sedang Dimasak',
    sublabel: 'Juru masak sedang menyiapkan pesananmu',
    color: 'text-orange-600',
    bg: 'bg-orange-100',
    ring: 'ring-orange-400',
  },
  {
    key: ['ready'],
    icon: Utensils,
    label: 'Siap Disajikan',
    sublabel: 'Pesananmu siap! Pelayan segera mengantarkan',
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
    ring: 'ring-emerald-400',
  },
  {
    key: ['served', 'paid'],
    icon: Star,
    label: 'Selamat Menikmati!',
    sublabel: 'Pesanan telah disajikan. Bon appétit!',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    ring: 'ring-blue-400',
  },
];

function getStepIndex(status: OrderStatus): number {
  for (let i = 0; i < STEPS.length; i++) {
    if ((STEPS[i].key as string[]).includes(status)) return i;
  }
  return 0;
}

function formatTime(iso: string | null) {
  if (!iso) return null;
  return format(new Date(iso), 'HH:mm', { locale: idLocale });
}

export default function OrderStatusPage() {
  const { tenantId, orderId } = useParams<{ tenantId: string; orderId: string }>();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastPolled, setLastPolled] = useState(new Date());
  const prevStatus = useRef<OrderStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!tenantId || !orderId) return;
    try {
      const res = await fetch(`/api/menu/${tenantId}/order/${orderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pesanan tidak ditemukan');
      setOrder(data.order);
      setLastPolled(new Date());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Gagal memuat status pesanan');
    } finally {
      setLoading(false);
    }
  }, [tenantId, orderId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Polling setiap 5 detik
  useEffect(() => {
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // Deteksi perubahan status dan vibrate HP
  useEffect(() => {
    if (!order) return;
    if (prevStatus.current && prevStatus.current !== order.status) {
      try { navigator.vibrate?.([100, 50, 100]); } catch {}
    }
    prevStatus.current = order.status;
  }, [order?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        <p className="text-sm text-gray-500">Memuat status pesanan...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">😔</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Pesanan tidak ditemukan</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <Button onClick={fetchStatus} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Coba Lagi
        </Button>
      </div>
    );
  }

  if (order.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">❌</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Pesanan Dibatalkan</h2>
        <p className="text-gray-500 mb-1">Nomor pesanan: <strong>{order.order_number}</strong></p>
        <p className="text-gray-400 text-sm">Silakan hubungi pelayan untuk informasi lebih lanjut.</p>
      </div>
    );
  }

  const currentStep = getStepIndex(order.status);
  const isFinished = order.status === 'served' || order.status === 'paid';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className={`text-white px-4 pt-safe-top pb-5 ${
        isFinished ? 'bg-blue-600' :
        order.status === 'ready' ? 'bg-emerald-600' :
        order.status === 'cooking' ? 'bg-orange-500' : 'bg-yellow-500'
      }`}>
        <div className="flex items-center gap-3 py-3">
          <Link to={`/menu/${tenantId}`} className="text-white/80 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <p className="text-xs font-medium opacity-80">Status Pesanan</p>
            <h1 className="font-bold text-lg leading-tight font-mono">{order.order_number}</h1>
          </div>
          <button onClick={fetchStatus} className="text-white/80 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Table & Customer */}
        <div className="flex items-center gap-4 bg-white/20 rounded-xl px-4 py-2.5">
          {order.table_name && (
            <div className="flex items-center gap-1.5">
              <Table2 className="h-4 w-4 opacity-80" />
              <span className="text-sm font-semibold">{order.table_name}</span>
            </div>
          )}
          {order.customer_name && (
            <div className="flex items-center gap-1 text-sm opacity-90">
              <span>👤</span>
              <span>{order.customer_name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* Progress Steps */}
        <div className="mx-4 mt-5 bg-white rounded-2xl shadow-sm overflow-hidden">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isDone = idx < currentStep;
            const isActive = idx === currentStep;
            const isPending = idx > currentStep;
            return (
              <div
                key={idx}
                className={`flex items-center gap-4 px-4 py-4 border-b last:border-b-0 transition-colors ${
                  isActive ? 'bg-gray-50' : ''
                }`}
              >
                {/* Step icon */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                  isDone ? 'bg-emerald-100' :
                  isActive ? `${step.bg} ring-2 ${step.ring}` :
                  'bg-gray-100'
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Icon className={`h-5 w-5 ${isActive ? step.color : 'text-gray-300'}`} />
                  )}
                </div>

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${
                    isDone ? 'text-emerald-600' :
                    isActive ? 'text-gray-900' :
                    'text-gray-300'
                  }`}>
                    {step.label}
                  </p>
                  {isActive && (
                    <p className="text-xs text-gray-500 mt-0.5">{step.sublabel}</p>
                  )}
                </div>

                {/* Timestamp */}
                {isDone && idx === 0 && formatTime(order.created_at) && (
                  <span className="text-xs text-gray-400 shrink-0">{formatTime(order.created_at)}</span>
                )}
                {isDone && idx === 1 && formatTime(order.cooking_started_at) && (
                  <span className="text-xs text-gray-400 shrink-0">{formatTime(order.cooking_started_at)}</span>
                )}
                {isDone && idx === 2 && formatTime(order.ready_at) && (
                  <span className="text-xs text-gray-400 shrink-0">{formatTime(order.ready_at)}</span>
                )}
                {isActive && idx === 0 && formatTime(order.created_at) && (
                  <span className="text-xs text-gray-400 shrink-0">{formatTime(order.created_at)}</span>
                )}

                {/* Active pulse */}
                {isActive && !isFinished && (
                  <div className={`w-2.5 h-2.5 rounded-full ${step.bg} ${step.color} ring-1 ${step.ring} animate-pulse shrink-0`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Current status banner */}
        <div className={`mx-4 mt-4 rounded-2xl p-4 text-center ${
          isFinished ? 'bg-blue-50 border border-blue-200' :
          order.status === 'ready' ? 'bg-emerald-50 border border-emerald-200' :
          order.status === 'cooking' ? 'bg-orange-50 border border-orange-200' :
          'bg-yellow-50 border border-yellow-200'
        }`}>
          <p className={`font-bold text-base ${
            isFinished ? 'text-blue-700' :
            order.status === 'ready' ? 'text-emerald-700' :
            order.status === 'cooking' ? 'text-orange-700' : 'text-yellow-700'
          }`}>
            {STEPS[currentStep].label}
          </p>
          <p className="text-sm text-gray-600 mt-0.5">{STEPS[currentStep].sublabel}</p>
          {!isFinished && (
            <p className="text-[11px] text-gray-400 mt-2">
              Diperbarui otomatis · terakhir {format(lastPolled, 'HH:mm:ss')}
            </p>
          )}
        </div>

        {/* Order Items */}
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-sm text-gray-700">Pesanan Kamu</p>
          </div>
          <div className="divide-y divide-gray-50">
            {order.items.map((item, idx) => (
              <div key={idx} className="px-4 py-3">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-800 flex-1">
                    {item.name || item.product_name || 'Item'}
                  </span>
                  <span className="text-sm font-bold text-gray-700 shrink-0">×{item.qty}</span>
                </div>
                {item.notes && (
                  <p className="text-xs text-amber-600 italic mt-0.5">↳ {item.notes}</p>
                )}
              </div>
            ))}
          </div>
          {order.notes && (
            <div className="px-4 py-3 border-t border-gray-100 bg-yellow-50">
              <p className="text-xs text-yellow-700">📝 Catatan: {order.notes}</p>
            </div>
          )}
        </div>

        {/* Order More button */}
        {tenantId && (
          <div className="mx-4 mt-4">
            <Link to={`/menu/${tenantId}`}>
              <Button
                variant="outline"
                className="w-full h-11 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                + Tambah Pesanan Lagi
              </Button>
            </Link>
          </div>
        )}

        {/* Finish celebration */}
        {isFinished && (
          <div className="mx-4 mt-4 text-center py-4">
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-sm text-gray-500">Terima kasih sudah memesan!</p>
            <p className="text-xs text-gray-400 mt-1">Semoga makan siang/malamnya menyenangkan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
