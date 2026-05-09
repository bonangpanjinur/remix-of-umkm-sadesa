/**
 * FASE P4 — Hook untuk Admin Realtime Dashboard via SSE
 * - Stream transaksi live setiap 10 detik
 * - Data per jam (24 jam terakhir) untuk grafik
 * - Data per menit (60 menit terakhir) untuk grafik live
 * - Alert otomatis jika ada spike transaksi
 */
import { useState, useEffect, useCallback, useRef } from "react";

export interface AdminSnapshot {
  todayOrders: number;
  todayRevenue: number;
  thisHourOrders: number;
  prevHourOrders: number;
  spikeRatio: number;
  isSpike: boolean;
  activeUsers: number;
  recentOrders: Array<{
    id: string;
    total: number;
    status: string;
    created_at: string;
  }>;
  ts: string;
}

export interface HourlyPoint {
  hour: string;
  label: string;
  orders: number;
  revenue: number;
  completed: number;
  cancelled: number;
}

export interface MinutelyPoint {
  minute: string;
  label: string;
  orders: number;
  revenue: number;
}

export interface SpikeAlert {
  id: number;
  message: string;
  ratio: number;
  detectedAt: Date;
  dismissed: boolean;
}

export function useAdminRealtime() {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [minutely, setMinutely] = useState<MinutelyPoint[]>([]);
  const [alerts, setAlerts] = useState<SpikeAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const alertIdRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);

  const getToken = () => {
    try { return localStorage.getItem("session_token") || ""; } catch { return ""; }
  };

  const dismissAlert = useCallback((id: number) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a))
    );
  }, []);

  const fetchHourly = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/admin/stats/hourly", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.hourly) setHourly(json.hourly);
    } catch (_) {}
  }, []);

  const fetchMinutely = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/admin/stats/minutely", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.minutely) setMinutely(json.minutely);
    } catch (_) {}
  }, []);

  const connectSSE = useCallback(() => {
    const token = getToken();
    if (!token) return;

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource(`/api/admin/stats/stream?token=${token}`);
    esRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setLoading(false);
    };

    es.onmessage = (e) => {
      try {
        const data: AdminSnapshot & { type: string } = JSON.parse(e.data);
        if (data.type === "admin_stats") {
          setSnapshot(data);
          setLoading(false);

          // Cek spike dan buat alert
          if (data.isSpike) {
            setAlerts((prev) => {
              // Jangan duplikat alert dalam 5 menit terakhir
              const recent = prev.find(
                (a) =>
                  !a.dismissed &&
                  new Date().getTime() - a.detectedAt.getTime() < 5 * 60 * 1000
              );
              if (recent) return prev;

              alertIdRef.current += 1;
              const newAlert: SpikeAlert = {
                id: alertIdRef.current,
                message: `Lonjakan transaksi terdeteksi! ${data.thisHourOrders} pesanan/jam (${Math.round(data.spikeRatio * 100)}% dari jam sebelumnya)`,
                ratio: data.spikeRatio,
                detectedAt: new Date(),
                dismissed: false,
              };
              return [newAlert, ...prev].slice(0, 10);
            });
          }
        }
      } catch (_) {}
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      esRef.current = null;
      // Reconnect setelah 5 detik
      setTimeout(connectSSE, 5000);
    };
  }, []);

  useEffect(() => {
    connectSSE();
    fetchHourly();
    fetchMinutely();

    // Refresh data per jam setiap 5 menit
    const hourlyInterval = setInterval(() => {
      fetchHourly();
      fetchMinutely();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(hourlyInterval);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setIsConnected(false);
    };
  }, [connectSSE, fetchHourly, fetchMinutely]);

  const refresh = useCallback(() => {
    fetchHourly();
    fetchMinutely();
  }, [fetchHourly, fetchMinutely]);

  return {
    snapshot,
    hourly,
    minutely,
    alerts,
    isConnected,
    loading,
    dismissAlert,
    refresh,
  };
}
