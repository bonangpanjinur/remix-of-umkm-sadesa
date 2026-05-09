/**
 * Courier API Routes
 * - Batch delivery: terima 2-3 pesanan sekaligus
 * - Earnings summary: data rekap penghasilan per periode
 */
import { Router } from "express";
import { pool } from "../db";
import { getSessionUser } from "../auth";

const router = Router();

// ─── Batch Delivery — terima 2-3 pesanan sekaligus ────────────────────────────
router.post("/batch-accept", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { order_ids } = req.body as { order_ids?: string[] };
  if (!order_ids || order_ids.length < 2 || order_ids.length > 3) {
    return res.status(400).json({ error: "Pilih 2–3 pesanan untuk batch delivery" });
  }

  const client = await pool.connect();
  try {
    // Cek apakah kurir ada dan APPROVED
    const courierRes = await client.query(
      "SELECT id, name FROM public.couriers WHERE user_id = $1 AND registration_status = 'APPROVED' AND status = 'ACTIVE'",
      [user.id]
    );
    const courier = courierRes.rows[0];
    if (!courier) return res.status(403).json({ error: "Kurir tidak ditemukan atau belum disetujui" });

    // Cek berapa order aktif yang sedang dikerjakan
    const activeRes = await client.query(
      "SELECT COUNT(*) AS cnt FROM public.orders WHERE courier_id = $1 AND status = ANY($2)",
      [courier.id, ["ASSIGNED", "PICKED_UP", "SENT", "DELIVERING"]]
    );
    const activeCount = parseInt(activeRes.rows[0]?.cnt ?? "0");
    if (activeCount + order_ids.length > 3) {
      return res.status(400).json({
        error: `Kurir sudah punya ${activeCount} order aktif. Maksimal 3 total.`,
        active_count: activeCount,
      });
    }

    // Verifikasi semua order: harus PAID dan belum ada kurir
    const ordersRes = await client.query(
      "SELECT id, status, courier_id FROM public.orders WHERE id = ANY($1)",
      [order_ids]
    );
    const found = ordersRes.rows;
    if (found.length !== order_ids.length) {
      return res.status(404).json({ error: "Satu atau lebih pesanan tidak ditemukan" });
    }
    const invalid = found.filter(o => o.status !== "PAID" || o.courier_id !== null);
    if (invalid.length > 0) {
      return res.status(409).json({
        error: `${invalid.length} pesanan sudah diambil atau belum dibayar`,
        invalid_ids: invalid.map(o => o.id),
      });
    }

    // Update semua order secara atomik
    await client.query("BEGIN");
    await client.query(
      `UPDATE public.orders
       SET courier_id = $1, status = 'ASSIGNED', assigned_at = now(), updated_at = now()
       WHERE id = ANY($2) AND status = 'PAID' AND courier_id IS NULL`,
      [courier.id, order_ids]
    );

    // Notifikasi ke kurir
    await client.query(
      `INSERT INTO public.notifications (user_id, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        `Batch ${order_ids.length} Pesanan Diterima! 🚀`,
        `Kamu berhasil mengambil ${order_ids.length} pesanan sekaligus. Silakan mulai pickup.`,
        "order",
        "/courier",
      ]
    ).catch(() => {});

    // G-01 fix: Notifikasi ke setiap buyer bahwa kurir sudah ditugaskan
    const buyerRes = await client.query(
      `SELECT o.id AS order_id, o.buyer_id FROM public.orders o WHERE o.id = ANY($1)`,
      [order_ids]
    );
    for (const row of buyerRes.rows) {
      if (row.buyer_id) {
        await client.query(
          `INSERT INTO public.notifications (user_id, title, message, type, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            row.buyer_id,
            "Kurir Sudah Ditugaskan! 🏍️",
            `Pesanan #${row.order_id.slice(0, 8).toUpperCase()} sedang diproses kurir dan akan segera dijemput.`,
            "order",
            `/orders`,
          ]
        ).catch(() => {});
      }
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      courier_id: courier.id,
      courier_name: courier.name,
      accepted_order_ids: order_ids,
      message: `${order_ids.length} pesanan berhasil di-batch dan diterima`,
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ error: err.message || "Server error" });
  } finally {
    client.release();
  }
});

// ─── Batalkan batch (kembalikan order ke PAID) ────────────────────────────────
router.post("/batch-cancel", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { order_ids, reason } = req.body as { order_ids?: string[]; reason?: string };
  if (!order_ids || order_ids.length === 0) {
    return res.status(400).json({ error: "order_ids wajib diisi" });
  }

  const client = await pool.connect();
  try {
    const courierRes = await client.query(
      "SELECT id FROM public.couriers WHERE user_id = $1 AND registration_status = 'APPROVED'",
      [user.id]
    );
    const courier = courierRes.rows[0];
    if (!courier) return res.status(403).json({ error: "Kurir tidak ditemukan" });

    await client.query(
      `UPDATE public.orders
       SET courier_id = NULL, status = 'PAID', assigned_at = NULL, updated_at = now()
       WHERE id = ANY($1) AND courier_id = $2 AND status = 'ASSIGNED'`,
      [order_ids, courier.id]
    );

    return res.json({ success: true, message: "Batch dibatalkan, pesanan dikembalikan ke antrian" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── Rekap penghasilan per periode ────────────────────────────────────────────
router.get("/earnings-summary", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { period_start, period_end } = req.query as { period_start?: string; period_end?: string };
  if (!period_start || !period_end) {
    return res.status(400).json({ error: "period_start dan period_end wajib diisi (ISO string)" });
  }

  const client = await pool.connect();
  try {
    const courierRes = await client.query(
      "SELECT id, name, phone, vehicle_type FROM public.couriers WHERE user_id = $1 AND registration_status = 'APPROVED'",
      [user.id]
    );
    const courier = courierRes.rows[0];
    if (!courier) return res.status(404).json({ error: "Kurir tidak ditemukan atau belum disetujui" });

    const earningsRes = await client.query(
      `SELECT id, amount, type, status, order_id, created_at, paid_at
       FROM public.courier_earnings
       WHERE courier_id = $1
         AND created_at >= $2
         AND created_at <= $3
       ORDER BY created_at ASC`,
      [courier.id, period_start, period_end]
    );

    const all = earningsRes.rows;
    const totalAmount = all.reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
    const paidAmount = all.filter((e: any) => e.status === "PAID").reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
    const pendingAmount = all.filter((e: any) => e.status === "PENDING").reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
    const deliveryTotal = all.filter((e: any) => e.type === "DELIVERY").reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
    const rideTotal = all.filter((e: any) => e.type === "RIDE").reduce((s: number, e: any) => s + parseFloat(e.amount), 0);

    return res.json({
      success: true,
      courier,
      earnings: all,
      stats: {
        totalAmount,
        paidAmount,
        pendingAmount,
        deliveryTotal,
        rideTotal,
        deliveryCount: all.filter((e: any) => e.type === "DELIVERY").length,
        rideCount: all.filter((e: any) => e.type === "RIDE").length,
        totalTransactions: all.length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── Pesanan tersedia untuk di-batch ─────────────────────────────────────────
router.get("/available-orders", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { limit = "15" } = req.query as { limit?: string };
  const client = await pool.connect();

  try {
    const courierRes = await client.query(
      "SELECT id FROM public.couriers WHERE user_id = $1 AND registration_status = 'APPROVED' AND status = 'ACTIVE' AND is_available = true",
      [user.id]
    );
    const courier = courierRes.rows[0];
    if (!courier) return res.status(403).json({ error: "Kurir tidak aktif atau tidak tersedia" });

    // Hitung order aktif
    const activeRes = await client.query(
      "SELECT COUNT(*) AS cnt FROM public.orders WHERE courier_id = $1 AND status = ANY($2)",
      [courier.id, ["ASSIGNED", "PICKED_UP", "SENT", "DELIVERING"]]
    );
    const activeCount = parseInt(activeRes.rows[0]?.cnt ?? "0");
    const canAccept = 3 - activeCount;

    if (canAccept <= 0) {
      return res.json({ success: true, orders: [], active_count: activeCount, can_accept: 0 });
    }

    const ordersRes = await client.query(
      `SELECT
         o.id, o.total, o.status, o.created_at, o.shipping_address,
         o.delivery_lat, o.delivery_lng,
         p.full_name AS buyer_name,
         m.name AS merchant_name, m.address AS merchant_address,
         m.lat AS merchant_lat, m.lng AS merchant_lng
       FROM public.orders o
       LEFT JOIN public.profiles p ON p.id = o.buyer_id
       LEFT JOIN public.merchants m ON m.id = o.merchant_id
       WHERE o.status = 'PAID' AND o.courier_id IS NULL
       ORDER BY o.created_at ASC
       LIMIT $1`,
      [parseInt(limit)]
    );

    return res.json({
      success: true,
      orders: ordersRes.rows,
      active_count: activeCount,
      can_accept: canAccept,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
