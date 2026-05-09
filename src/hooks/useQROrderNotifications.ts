/**
 * Hook untuk notifikasi pesanan QR secara realtime di POS.
 * Subscrib ke channel SSE `pos_qr_orders:{tenantId}` dan mengumpulkan
 * pesanan masuk + membunyikan notifikasi audio.
 */
import { useEffect, useRef, useCallback, useState } from "react";

export interface QRIncomingOrder {
  order_id: string;
  order_number: string;
  table_id: string;
  table_name: string;
  customer_name: string;
  items: Array<{
    product_name: string;
    qty: number;
    price: number;
    subtotal: number;
    notes?: string | null;
  }>;
  subtotal: number;
  notes: string | null;
  created_at: string;
  read: boolean;
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sequence = [
      { freq: 880, start: 0, duration: 0.12 },
      { freq: 1100, start: 0.14, duration: 0.12 },
      { freq: 1320, start: 0.28, duration: 0.18 },
    ];
    sequence.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
    });
  } catch (_) {}
}

async function subscribeToQRChannel(tenantId: string) {
  try {
    const token = localStorage.getItem("session_token");
    if (!token) return;
    await fetch("/api/sse/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel: `pos_qr_orders:${tenantId}` }),
    });
  } catch (_) {}
}

export function useQROrderNotifications(tenantId: string | null | undefined) {
  const [orders, setOrders] = useState<QRIncomingOrder[]>([]);
  const channelName = tenantId ? `pos_qr_orders:${tenantId}` : null;
  const subscribedRef = useRef(false);

  // Subscribe ke server channel saat tenantId tersedia
  useEffect(() => {
    if (!tenantId || subscribedRef.current) return;
    subscribedRef.current = true;
    subscribeToQRChannel(tenantId);
    // Resubscribe setelah SSE reconnect
    const onConnected = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "connected") {
        subscribeToQRChannel(tenantId);
      }
    };
    window.addEventListener("sse_broadcast", onConnected as EventListener);
    return () => {
      window.removeEventListener("sse_broadcast", onConnected as EventListener);
      subscribedRef.current = false;
    };
  }, [tenantId]);

  // Dengarkan broadcast event `new_order` dari channel ini
  useEffect(() => {
    if (!channelName) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<any>).detail;
      if (
        detail?.type === "broadcast" &&
        detail?.channel === channelName &&
        detail?.event === "new_order" &&
        detail?.payload
      ) {
        const p = detail.payload as Omit<QRIncomingOrder, "read">;
        setOrders((prev) => [{ ...p, read: false }, ...prev]);
        playNotificationSound();
      }
    };

    window.addEventListener("sse_broadcast", handler as EventListener);
    return () => window.removeEventListener("sse_broadcast", handler as EventListener);
  }, [channelName]);

  const unreadCount = orders.filter((o) => !o.read).length;

  const markAllRead = useCallback(() => {
    setOrders((prev) => prev.map((o) => ({ ...o, read: true })));
  }, []);

  const markRead = useCallback((orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.order_id === orderId ? { ...o, read: true } : o))
    );
  }, []);

  const dismissOrder = useCallback((orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.order_id !== orderId));
  }, []);

  const clearAll = useCallback(() => setOrders([]), []);

  return { orders, unreadCount, markAllRead, markRead, dismissOrder, clearAll };
}
