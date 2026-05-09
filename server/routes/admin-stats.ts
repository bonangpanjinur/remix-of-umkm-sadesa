/**
 * FASE P4 — Admin Realtime Stats via SSE
 * GET  /api/admin/stats         — snapshot metrik platform
 * GET  /api/admin/stats/stream  — SSE live stream transaksi per menit
 * GET  /api/admin/stats/hourly  — data per jam untuk grafik 24 jam
 */
import { Router, Request, Response } from "express";
import { pool } from "../db";
import { getSessionUser } from "../auth";

const router = Router();

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const userId = await getSessionUser(token);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const client = await pool.connect();
  try {
    const r = await client.query(
      "SELECT 1 FROM public.user_roles WHERE user_id=$1 AND role='admin' LIMIT 1",
      [userId]
    );
    if (!r.rows.length) { res.status(403).json({ error: "Forbidden" }); return null; }
    return userId;
  } finally { client.release(); }
}

// ─── Snapshot stats ───────────────────────────────────────────────────────────
router.get("/stats", async (req: Request, res: Response) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;

  const client = await pool.connect();
  try {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const prevHourAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    const [
      ordersToday,
      ordersPrevHour,
      ordersThisHour,
      activeUsers,
      pendingItems,
      failedOrders,
    ] = await Promise.all([
      client.query(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS revenue
         FROM public.orders WHERE created_at >= $1`,
        [`${todayStr}T00:00:00`]
      ),
      client.query(
        `SELECT COUNT(*) AS cnt FROM public.orders
         WHERE created_at >= $1 AND created_at < $2`,
        [prevHourAgo, oneHourAgo]
      ),
      client.query(
        `SELECT COUNT(*) AS cnt FROM public.orders WHERE created_at >= $1`,
        [oneHourAgo]
      ),
      client.query(
        `SELECT COUNT(DISTINCT user_id) AS cnt FROM public.sessions
         WHERE expires_at > now()`
      ),
      client.query(
        `SELECT
           (SELECT COUNT(*) FROM public.merchants WHERE registration_status='PENDING') AS merchants,
           (SELECT COUNT(*) FROM public.couriers WHERE registration_status='PENDING') AS couriers,
           (SELECT COUNT(*) FROM public.villages WHERE registration_status='PENDING') AS villages`
      ),
      client.query(
        `SELECT COUNT(*) AS cnt FROM public.orders
         WHERE status='CANCELLED' AND created_at >= $1`,
        [`${todayStr}T00:00:00`]
      ),
    ]);

    const thisHourCnt = parseInt(ordersThisHour.rows[0]?.cnt || "0");
    const prevHourCnt = parseInt(ordersPrevHour.rows[0]?.cnt || "0");
    const spikeRatio = prevHourCnt > 0 ? thisHourCnt / prevHourCnt : 0;
    const isSpike = spikeRatio >= 2 && thisHourCnt >= 5;

    return res.json({
      ok: true,
      snapshot: {
        todayOrders: parseInt(ordersToday.rows[0]?.cnt || "0"),
        todayRevenue: parseFloat(ordersToday.rows[0]?.revenue || "0"),
        thisHourOrders: thisHourCnt,
        prevHourOrders: prevHourCnt,
        spikeRatio: Math.round(spikeRatio * 100) / 100,
        isSpike,
        activeUsers: parseInt(activeUsers.rows[0]?.cnt || "0"),
        pendingMerchants: parseInt(pendingItems.rows[0]?.merchants || "0"),
        pendingCouriers: parseInt(pendingItems.rows[0]?.couriers || "0"),
        pendingVillages: parseInt(pendingItems.rows[0]?.villages || "0"),
        failedOrdersToday: parseInt(failedOrders.rows[0]?.cnt || "0"),
        generatedAt: now.toISOString(),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── Hourly data (24 jam terakhir) untuk grafik ───────────────────────────────
router.get("/stats/hourly", async (req: Request, res: Response) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         date_trunc('hour', created_at) AS hour,
         COUNT(*) AS orders,
         COALESCE(SUM(total), 0) AS revenue,
         COUNT(*) FILTER (WHERE status = 'DONE') AS completed,
         COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled
       FROM public.orders
       WHERE created_at >= now() - interval '24 hours'
       GROUP BY 1
       ORDER BY 1 ASC`
    );

    const rows = result.rows.map((r) => ({
      hour: r.hour,
      label: new Date(r.hour).getHours().toString().padStart(2, "0") + ":00",
      orders: parseInt(r.orders),
      revenue: parseFloat(r.revenue),
      completed: parseInt(r.completed),
      cancelled: parseInt(r.cancelled),
    }));

    return res.json({ ok: true, hourly: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── Per-minute data (60 menit terakhir) ─────────────────────────────────────
router.get("/stats/minutely", async (req: Request, res: Response) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         date_trunc('minute', created_at) AS minute,
         COUNT(*) AS orders,
         COALESCE(SUM(total), 0) AS revenue
       FROM public.orders
       WHERE created_at >= now() - interval '60 minutes'
       GROUP BY 1
       ORDER BY 1 ASC`
    );

    const rows = result.rows.map((r) => {
      const d = new Date(r.minute);
      return {
        minute: r.minute,
        label: d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0"),
        orders: parseInt(r.orders),
        revenue: parseFloat(r.revenue),
      };
    });

    return res.json({ ok: true, minutely: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── SSE Live Stream — kirim snapshot setiap 10 detik ─────────────────────────
router.get("/stats/stream", async (req: Request, res: Response) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendSnapshot = async () => {
    const client = await pool.connect();
    try {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const prevHourAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

      const [ordersToday, thisHour, prevHour, recent5min, activeUsers] = await Promise.all([
        client.query(
          `SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS revenue
           FROM public.orders WHERE created_at >= $1`,
          [`${todayStr}T00:00:00`]
        ),
        client.query(
          `SELECT COUNT(*) AS cnt FROM public.orders WHERE created_at >= $1`,
          [oneHourAgo]
        ),
        client.query(
          `SELECT COUNT(*) AS cnt FROM public.orders WHERE created_at >= $1 AND created_at < $2`,
          [prevHourAgo, oneHourAgo]
        ),
        client.query(
          `SELECT id, total, status, created_at FROM public.orders
           WHERE created_at >= $1 ORDER BY created_at DESC LIMIT 10`,
          [fiveMinsAgo]
        ),
        client.query(
          `SELECT COUNT(DISTINCT user_id) AS cnt FROM public.sessions WHERE expires_at > now()`
        ),
      ]);

      const thisHourCnt = parseInt(thisHour.rows[0]?.cnt || "0");
      const prevHourCnt = parseInt(prevHour.rows[0]?.cnt || "0");
      const spikeRatio = prevHourCnt > 0 ? thisHourCnt / prevHourCnt : 0;
      const isSpike = spikeRatio >= 2 && thisHourCnt >= 5;

      const payload = {
        type: "admin_stats",
        ts: now.toISOString(),
        todayOrders: parseInt(ordersToday.rows[0]?.cnt || "0"),
        todayRevenue: parseFloat(ordersToday.rows[0]?.revenue || "0"),
        thisHourOrders: thisHourCnt,
        prevHourOrders: prevHourCnt,
        spikeRatio: Math.round(spikeRatio * 100) / 100,
        isSpike,
        activeUsers: parseInt(activeUsers.rows[0]?.cnt || "0"),
        recentOrders: recent5min.rows,
      };

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (_) {
      // Tidak fatal — coba lagi di interval berikutnya
    } finally {
      client.release();
    }
  };

  // Kirim snapshot awal
  await sendSnapshot();

  // Kirim setiap 10 detik
  const interval = setInterval(sendSnapshot, 10_000);

  // Heartbeat agar koneksi tidak terputus
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch (_) { /* ignore */ }
  }, 25_000);

  // Max 1 jam per koneksi
  const timeout = setTimeout(() => {
    clearInterval(interval);
    clearInterval(heartbeat);
    res.end();
  }, 60 * 60 * 1000);

  req.on("close", () => {
    clearInterval(interval);
    clearInterval(heartbeat);
    clearTimeout(timeout);
  });
});

export default router;
