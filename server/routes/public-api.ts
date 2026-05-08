/**
 * P4-04: Webhook & Public REST API for POS
 * API key validated routes for third-party integrations.
 */
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db";

const router = Router();

// ─── API Key Auth Middleware ──────────────────────────────────────────────────
async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const key =
    (req.headers["x-api-key"] as string) ||
    (req.query.api_key as string);

  if (!key) {
    return res.status(401).json({ error: "API key required. Pass via X-Api-Key header." });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, permissions, is_active FROM public.api_keys WHERE key_value = $1`,
      [key]
    );
    const apiKey = result.rows[0];
    if (!apiKey || !apiKey.is_active) {
      return res.status(401).json({ error: "Invalid or inactive API key" });
    }

    // Update usage stats
    await client.query(
      `UPDATE public.api_keys SET last_used_at = now(), request_count = request_count + 1 WHERE id = $1`,
      [apiKey.id]
    );

    (req as any).apiKeyId = apiKey.id;
    (req as any).apiPermissions = apiKey.permissions || [];
    next();
  } catch (err) {
    return res.status(500).json({ error: "Auth check failed" });
  } finally {
    client.release();
  }
}

function requirePermission(perm: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const perms: string[] = (req as any).apiPermissions || [];
    if (!perms.includes(perm)) {
      return res.status(403).json({ error: `Missing permission: ${perm}` });
    }
    next();
  };
}

router.use(apiKeyAuth);

// ─── GET /api/v1/products ─────────────────────────────────────────────────────
router.get(
  "/products",
  requirePermission("read:products"),
  async (req: Request, res: Response) => {
    const { merchant_id, category, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const client = await pool.connect();
    try {
      let q = `
        SELECT p.id, p.name, p.description, p.price, p.stock, p.category,
               p.image_url, p.is_active, p.created_at,
               m.name AS merchant_name
        FROM public.products p
        LEFT JOIN public.merchants m ON p.merchant_id = m.id
        WHERE p.is_active = true
      `;
      const params: any[] = [];
      if (merchant_id) { params.push(merchant_id); q += ` AND p.merchant_id = $${params.length}`; }
      if (category) { params.push(category); q += ` AND p.category = $${params.length}`; }
      params.push(parseInt(limit)); q += ` LIMIT $${params.length}`;
      params.push(parseInt(offset)); q += ` OFFSET $${params.length}`;

      const result = await client.query(q, params);
      return res.json({ data: result.rows, count: result.rowCount, limit: parseInt(limit), offset: parseInt(offset) });
    } finally { client.release(); }
  }
);

// ─── GET /api/v1/products/:id ─────────────────────────────────────────────────
router.get(
  "/products/:id",
  requirePermission("read:products"),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT p.*, m.name AS merchant_name FROM public.products p
         LEFT JOIN public.merchants m ON p.merchant_id = m.id
         WHERE p.id = $1`,
        [req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: "Product not found" });
      return res.json({ data: result.rows[0] });
    } finally { client.release(); }
  }
);

// ─── GET /api/v1/orders ───────────────────────────────────────────────────────
router.get(
  "/orders",
  requirePermission("read:orders"),
  async (req: Request, res: Response) => {
    const { merchant_id, status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const client = await pool.connect();
    try {
      let q = `
        SELECT o.id, o.status, o.total, o.created_at, o.payment_status,
               m.name AS merchant_name
        FROM public.orders o
        LEFT JOIN public.merchants m ON o.merchant_id = m.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (merchant_id) { params.push(merchant_id); q += ` AND o.merchant_id = $${params.length}`; }
      if (status) { params.push(status); q += ` AND o.status = $${params.length}`; }
      q += ` ORDER BY o.created_at DESC`;
      params.push(parseInt(limit)); q += ` LIMIT $${params.length}`;
      params.push(parseInt(offset)); q += ` OFFSET $${params.length}`;

      const result = await client.query(q, params);
      return res.json({ data: result.rows, count: result.rowCount, limit: parseInt(limit), offset: parseInt(offset) });
    } finally { client.release(); }
  }
);

// ─── GET /api/v1/merchants ────────────────────────────────────────────────────
router.get(
  "/merchants",
  requirePermission("read:merchants"),
  async (req: Request, res: Response) => {
    const { status = "ACTIVE", limit = "50", offset = "0" } = req.query as Record<string, string>;
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, name, slug, category, rating_avg, rating_count, is_open, village_id, created_at
         FROM public.merchants WHERE status = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [status, parseInt(limit), parseInt(offset)]
      );
      return res.json({ data: result.rows, count: result.rowCount });
    } finally { client.release(); }
  }
);

// ─── GET /api/v1/analytics ────────────────────────────────────────────────────
router.get(
  "/analytics",
  requirePermission("read:analytics"),
  async (req: Request, res: Response) => {
    const { merchant_id, days = "30" } = req.query as Record<string, string>;
    const client = await pool.connect();
    try {
      const since = new Date(Date.now() - parseInt(days) * 86400000).toISOString();
      let q = `
        SELECT
          COUNT(*) FILTER (WHERE status = 'DONE') AS completed_orders,
          COUNT(*) AS total_orders,
          COALESCE(SUM(total) FILTER (WHERE status = 'DONE'), 0) AS total_revenue,
          COUNT(DISTINCT buyer_id) AS unique_buyers
        FROM public.orders
        WHERE created_at >= $1
      `;
      const params: any[] = [since];
      if (merchant_id) { params.push(merchant_id); q += ` AND merchant_id = $${params.length}`; }
      const result = await client.query(q, params);
      return res.json({ data: result.rows[0], period_days: parseInt(days) });
    } finally { client.release(); }
  }
);

// ─── POST /api/v1/orders/:id/status ──────────────────────────────────────────
router.post(
  "/orders/:id/status",
  requirePermission("write:orders"),
  async (req: Request, res: Response) => {
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ error: "status is required" });
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE public.orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, status`,
        [status, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: "Order not found" });
      return res.json({ success: true, data: result.rows[0] });
    } finally { client.release(); }
  }
);

export default router;
