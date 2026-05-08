/**
 * POS Routes — endpoint agregat untuk performa optimal
 * B1: /dashboard-stats  — 13 DB call → 4 query paralel
 * B2: /merchant-quotas  — N×3 sequential → 1 request server
 */
import { Router, Request, Response } from "express";
import { pool } from "../db";
import { getSessionUser } from "../auth";

const router = Router();

// GET /api/pos/dashboard-stats?tenant_id=...&outlet_id=...
router.get("/dashboard-stats", async (req: Request, res: Response) => {
  const userId = await getSessionUser(req as any);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { tenant_id, outlet_id } = req.query as {
    tenant_id: string;
    outlet_id: string;
  };

  if (!tenant_id || !outlet_id) {
    return res.status(400).json({ error: "tenant_id dan outlet_id wajib diisi" });
  }

  const client = await pool.connect();
  try {
    // Satu CTE besar untuk semua sales (today, week, month, chart 7 hari)
    const salesQuery = `
      WITH sales_base AS (
        SELECT
          total::numeric,
          created_at
        FROM pos_sales
        WHERE tenant_id = $1
          AND outlet_id = $2
          AND status = 'completed'
          AND created_at >= NOW() - INTERVAL '35 days'
      ),
      today_stats AS (
        SELECT
          COALESCE(SUM(total), 0) AS today_sales,
          COUNT(*) AS today_transactions
        FROM sales_base
        WHERE created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Jakarta')
          AND created_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Jakarta') + INTERVAL '1 day'
      ),
      week_stats AS (
        SELECT COALESCE(SUM(total), 0) AS week_sales
        FROM sales_base
        WHERE created_at >= DATE_TRUNC('week', NOW())
          AND created_at < DATE_TRUNC('week', NOW()) + INTERVAL '7 days'
      ),
      month_stats AS (
        SELECT COALESCE(SUM(total), 0) AS month_sales
        FROM sales_base
        WHERE created_at >= DATE_TRUNC('month', NOW())
          AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
      ),
      chart_data AS (
        SELECT
          DATE_TRUNC('day', created_at)::date AS day,
          COALESCE(SUM(total), 0) AS total
        FROM sales_base
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY 1
      )
      SELECT
        t.today_sales,
        t.today_transactions,
        w.week_sales,
        m.month_sales,
        (SELECT JSON_AGG(JSON_BUILD_OBJECT('day', c.day, 'total', c.total) ORDER BY c.day) FROM chart_data c) AS chart_raw
      FROM today_stats t, week_stats w, month_stats m
    `;

    // 4 query paralel: sales CTE + products + customers + stock
    const [salesResult, productsResult, customersResult, stockResult] =
      await Promise.all([
        client.query(salesQuery, [tenant_id, outlet_id]),
        client.query(
          `SELECT COUNT(*) AS total FROM pos_products WHERE tenant_id = $1 AND is_active = true`,
          [tenant_id]
        ),
        client.query(
          `SELECT COUNT(*) AS total FROM pos_customers WHERE tenant_id = $1`,
          [tenant_id]
        ),
        client.query(
          `SELECT quantity, min_stock FROM pos_stock WHERE outlet_id = $1`,
          [outlet_id]
        ),
      ]);

    const s = salesResult.rows[0] || {};
    const chartRaw: { day: string; total: number }[] = s.chart_raw || [];

    // Isi hari yang tidak ada transaksi dengan 0
    const labels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const salesChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const found = chartRaw.find((r) => String(r.day).slice(0, 10) === iso);
      salesChart.push({
        label: labels[d.getDay()],
        total: found ? Number(found.total) : 0,
      });
    }

    const stockRows = stockResult.rows;
    const lowStockCount = stockRows.filter(
      (r: any) => Number(r.quantity) <= Number(r.min_stock || 5)
    ).length;

    return res.json({
      todaySales: Number(s.today_sales || 0),
      todayTransactions: Number(s.today_transactions || 0),
      weekSales: Number(s.week_sales || 0),
      monthSales: Number(s.month_sales || 0),
      totalProducts: Number(productsResult.rows[0]?.total || 0),
      totalCustomers: Number(customersResult.rows[0]?.total || 0),
      lowStockCount,
      topProducts: [],
      salesChart,
    });
  } finally {
    client.release();
  }
});

// POST /api/pos/merchant-quotas
router.post("/merchant-quotas", async (req: Request, res: Response) => {
  const userId = await getSessionUser(req as any);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { merchant_ids } = req.body as { merchant_ids: string[] };
  if (!Array.isArray(merchant_ids) || merchant_ids.length === 0) {
    return res.status(400).json({ error: "merchant_ids harus berupa array" });
  }

  const client = await pool.connect();
  try {
    const placeholders = merchant_ids.map((_, i) => `$${i + 1}`).join(", ");
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Satu batch untuk semua merchant sekaligus
    const [merchantsResult, subscriptionsResult, ordersResult, settingsResult] =
      await Promise.all([
        client.query(
          `SELECT id, name FROM merchants WHERE id IN (${placeholders})`,
          merchant_ids
        ),
        client.query(
          `SELECT
             ms.merchant_id,
             ms.transaction_quota,
             ms.used_quota,
             ms.expired_at,
             tp.name AS package_name
           FROM merchant_subscriptions ms
           LEFT JOIN transaction_packages tp ON ms.package_id = tp.id
           WHERE ms.merchant_id IN (${placeholders})
             AND ms.status = 'ACTIVE'
             AND ms.expired_at >= NOW()
           ORDER BY ms.expired_at ASC`,
          merchant_ids
        ),
        client.query(
          `SELECT merchant_id, COUNT(*) AS order_count
           FROM orders
           WHERE merchant_id IN (${placeholders})
             AND created_at >= $${merchant_ids.length + 1}
           GROUP BY merchant_id`,
          [...merchant_ids, startOfMonth.toISOString()]
        ),
        client.query(
          `SELECT value FROM app_settings WHERE key = 'free_tier_quota' LIMIT 1`
        ),
      ]);

    const freeTierLimit =
      (settingsResult.rows[0]?.value as { limit?: number })?.limit ?? 100;

    const subscriptionsByMerchant: Record<string, any[]> = {};
    for (const row of subscriptionsResult.rows) {
      if (!subscriptionsByMerchant[row.merchant_id]) {
        subscriptionsByMerchant[row.merchant_id] = [];
      }
      subscriptionsByMerchant[row.merchant_id].push(row);
    }

    const ordersByMerchant: Record<string, number> = {};
    for (const row of ordersResult.rows) {
      ordersByMerchant[row.merchant_id] = Number(row.order_count);
    }

    const statuses: Record<string, any> = {};
    for (const merchant of merchantsResult.rows) {
      const subs = subscriptionsByMerchant[merchant.id] || [];
      const currentUsage = ordersByMerchant[merchant.id] || 0;

      if (subs.length > 0) {
        const totalQuota = subs.reduce((s: number, r: any) => s + Number(r.transaction_quota), 0);
        const usedQuota = subs.reduce((s: number, r: any) => s + Number(r.used_quota), 0);
        const remaining = totalQuota - usedQuota;
        statuses[merchant.id] = {
          merchantId: merchant.id,
          merchantName: merchant.name,
          canTransact: remaining > 0,
          remainingQuota: remaining,
          totalQuota,
          usedQuota,
          expiresAt: subs[0].expired_at,
          packageName:
            subs.length > 1
              ? `${subs[0].package_name} (+${subs.length - 1} paket)`
              : subs[0].package_name || null,
          type: "premium",
        };
      } else {
        const remaining = Math.max(0, freeTierLimit - currentUsage);
        statuses[merchant.id] = {
          merchantId: merchant.id,
          merchantName: merchant.name,
          canTransact: remaining > 0,
          remainingQuota: remaining,
          totalQuota: freeTierLimit,
          usedQuota: currentUsage,
          expiresAt: null,
          packageName: "Free Tier",
          type: "free",
        };
      }
    }

    return res.json(statuses);
  } finally {
    client.release();
  }
});

export default router;
