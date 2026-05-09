/**
 * Database Proxy Routes
 * This module proxies database queries from the frontend through the secure API server.
 * The frontend's Supabase client is shimmed to call these endpoints instead.
 */
import { Router, Request, Response } from "express";
import { pool } from "../db";
import { getSessionUser, getUserById } from "../auth";
import { broadcastDbEvent } from "../sse-manager";
import { notifyNewOrder, notifyOrderStatusChange, notifyNewMerchantToAdminDesa } from "../lib/notify";

const router = Router();

// ─── Supabase relationship parser ─────────────────────────────────────────────
/**
 * Maps table -> { fkColumn, referencedTable } to resolve relationship joins.
 * Key is `parentTable:relatedTable` or just `relatedTable` as fallback.
 */
const FK_MAP: Record<string, { fk: string; ref_col?: string }> = {
  // Marketplace core
  "products:merchants":              { fk: "merchant_id",   ref_col: "id" },
  "merchants:villages":              { fk: "village_id",    ref_col: "id" },
  "merchants:profiles":              { fk: "user_id",       ref_col: "id" },
  "orders:merchants":                { fk: "merchant_id",   ref_col: "id" },
  "orders:profiles":                 { fk: "buyer_id",      ref_col: "id" },  // FIXED: buyer_id bukan user_id
  "orders:buyers":                   { fk: "buyer_id",      ref_col: "id" },
  "orders:couriers":                 { fk: "courier_id",    ref_col: "id" },
  "tourism:villages":                { fk: "village_id",    ref_col: "id" },
  "couriers:profiles":               { fk: "user_id",       ref_col: "id" },
  "reviews:profiles":                { fk: "buyer_id",      ref_col: "id" },
  "reviews:products":                { fk: "product_id",    ref_col: "id" },
  "reviews:merchants":               { fk: "merchant_id",   ref_col: "id" },
  "order_items:products":            { fk: "product_id",    ref_col: "id" },
  "order_items:orders":              { fk: "order_id",      ref_col: "id" },
  "chat_messages:profiles":          { fk: "sender_id",     ref_col: "id" },
  "wishlists:products":              { fk: "product_id",    ref_col: "id" },
  "wishlists:merchants":             { fk: "merchant_id",   ref_col: "id" },
  "merchant_favorites:merchants":    { fk: "merchant_id",   ref_col: "id" },
  "product_images:products":         { fk: "product_id",    ref_col: "id" },
  "flash_sales:products":            { fk: "product_id",    ref_col: "id" },
  "vouchers:merchants":              { fk: "merchant_id",   ref_col: "id" },
  "courier_earnings:couriers":       { fk: "courier_id",    ref_col: "id" },
  "broadcast_messages:villages":     { fk: "village_id",    ref_col: "id" },
  "village_events:villages":         { fk: "village_id",    ref_col: "id" },
  "commission_rules:merchants":      { fk: "target_id",     ref_col: "id" },
  "notifications:profiles":          { fk: "user_id",       ref_col: "id" },
  "user_villages:villages":          { fk: "village_id",    ref_col: "id" },
  "ride_requests:couriers":          { fk: "driver_id",     ref_col: "id" },
  "refund_requests:orders":          { fk: "order_id",      ref_col: "id" },
  "merchant_gallery:merchants":      { fk: "merchant_id",   ref_col: "id" },
  "tourism_guides:villages":         { fk: "village_id",    ref_col: "id" },
  "tourism_packages:villages":       { fk: "village_id",    ref_col: "id" },
  "tourism_packages:tourism_guides": { fk: "guide_id",      ref_col: "id" },
  "tourism_bookings:villages":       { fk: "village_id",    ref_col: "id" },
  "tourism_bookings:tourism_packages":{ fk: "package_id",   ref_col: "id" },
  "tourism_bookings:tourism_guides": { fk: "guide_id",      ref_col: "id" },
  "merchant_dues:trade_groups":      { fk: "group_id",      ref_col: "id" },
  "merchant_dues:merchants":         { fk: "merchant_id",   ref_col: "id" },
  "courier_ratings:orders":          { fk: "order_id",      ref_col: "id" },
  "courier_ratings:couriers":        { fk: "courier_id",    ref_col: "id" },
  "halal_certificates:merchants":    { fk: "merchant_id",   ref_col: "id" },
  "payment_proofs:orders":           { fk: "order_id",      ref_col: "id" },
  "product_views:products":          { fk: "product_id",    ref_col: "id" },
  "merchant_visitors:merchants":     { fk: "merchant_id",   ref_col: "id" },
  "voucher_usages:vouchers":         { fk: "voucher_id",    ref_col: "id" },
  "cashback_transactions:orders":    { fk: "order_id",      ref_col: "id" },
  "group_members:trade_groups":      { fk: "group_id",      ref_col: "id" },
  // POS SaaS
  "pos_sales:pos_sale_items":        { fk: "sale_id",       ref_col: "id" },
  "pos_sale_items:pos_sales":        { fk: "sale_id",       ref_col: "id" },
  "pos_sale_items:pos_products":     { fk: "product_id",    ref_col: "id" },
  "pos_stock:pos_products":          { fk: "product_id",    ref_col: "id" },
  "pos_stock:pos_outlets":           { fk: "outlet_id",     ref_col: "id" },
  "pos_stock_mutations:pos_products":{ fk: "product_id",    ref_col: "id" },
  "pos_stock_mutations:pos_outlets": { fk: "outlet_id",     ref_col: "id" },
  "pos_stock_transfers:pos_outlets": { fk: "from_outlet_id",ref_col: "id" },
  "pos_stock_transfer_items:pos_products": { fk: "product_id", ref_col: "id" },
  "pos_purchase_orders:pos_suppliers": { fk: "supplier_id", ref_col: "id" },
  "pos_purchase_orders:pos_outlets": { fk: "outlet_id",     ref_col: "id" },
  "pos_purchase_order_items:pos_purchase_orders": { fk: "purchase_order_id", ref_col: "id" },
  "pos_purchase_order_items:pos_products": { fk: "product_id", ref_col: "id" },
  "pos_purchase_returns:pos_purchase_orders": { fk: "purchase_order_id", ref_col: "id" },
  "pos_purchase_return_items:pos_products": { fk: "product_id", ref_col: "id" },
  "pos_sale_returns:pos_sales":      { fk: "sale_id",       ref_col: "id" },
  "pos_sale_return_items:pos_products": { fk: "product_id", ref_col: "id" },
  "pos_loyalty_transactions:pos_customers": { fk: "customer_id", ref_col: "id" },
  "pos_loyalty_points:pos_customers":{ fk: "customer_id",   ref_col: "id" },
  "pos_voucher_usages:pos_vouchers": { fk: "voucher_id",    ref_col: "id" },
  "pos_voucher_usages:pos_customers":{ fk: "customer_id",   ref_col: "id" },
  "pos_cash_sessions:pos_outlets":   { fk: "outlet_id",     ref_col: "id" },
  "pos_cash_mutations:pos_cash_sessions": { fk: "session_id", ref_col: "id" },
  "pos_products:pos_categories":     { fk: "category_id",   ref_col: "id" },
  "pos_products:pos_brands":         { fk: "brand_id",      ref_col: "id" },
  "pos_product_variants:pos_products": { fk: "product_id",  ref_col: "id" },
  "pos_audit_logs:pos_tenants":      { fk: "tenant_id",     ref_col: "id" },
  "pos_notifications:pos_tenants":   { fk: "tenant_id",     ref_col: "id" },
  "pos_sync_logs:pos_tenants":       { fk: "tenant_id",     ref_col: "id" },
  "pos_marketplace_orders:pos_tenants": { fk: "tenant_id",  ref_col: "id" },
  "pos_marketplace_sync:pos_products": { fk: "pos_product_id", ref_col: "id" },
};

interface ParsedRelationship {
  alias: string;
  table: string;
  fk: string;
  refCol: string;
  cols: string;
  isArray: boolean;
}

/**
 * Parse Supabase PostgREST-style column string into SQL SELECT + LEFT JOINs.
 * Example: "*, merchants (id, name, is_open, villages (name))"
 * → SELECT t.*, row_to_json(m.*) AS merchants FROM products t LEFT JOIN merchants m ON m.id = t.merchant_id
 */
function parseSupabaseColumns(columns: string, mainTable: string): { selectClause: string; joinClauses: string } {
  if (!columns || columns === "*") return { selectClause: `"${mainTable}".*`, joinClauses: "" };

  const relationships: ParsedRelationship[] = [];
  let directCols = "";

  // Parse the top-level: extract `table_name (...)` groups
  let remaining = columns.trim();
  const directColParts: string[] = [];

  // Split by commas at depth 0
  let depth = 0;
  let current = "";
  const topLevelParts: string[] = [];

  for (let i = 0; i < remaining.length; i++) {
    const ch = remaining[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      topLevelParts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) topLevelParts.push(current.trim());

  // Pattern: "table_name ( cols... )" — nested relationship
  const relPattern = /^(\w+):\w+\s*\((.+)\)$|^(\w+)\s*\((.+)\)$/s;

  for (const part of topLevelParts) {
    const m = part.match(relPattern);
    if (m) {
      // Nested relationship
      const alias = (m[1] || m[3]).trim();
      const innerCols = (m[2] || m[4]).trim();

      // Look up FK
      const fkKey = `${mainTable}:${alias}`;
      const fkInfo = FK_MAP[fkKey] || FK_MAP[alias];
      if (!fkInfo) {
        // Unknown relationship — skip embedding and just ignore the nested part
        directColParts.push(`NULL AS ${alias}`);
        continue;
      }

      // Check for nested-nested relationships in innerCols
      const hasNested = /\w+\s*\(/.test(innerCols);
      let innerSelect = innerCols;
      if (hasNested) {
        // Flatten nested: just take non-relationship columns
        const flat: string[] = [];
        let d2 = 0, cur2 = "";
        for (let i = 0; i < innerCols.length; i++) {
          const ch = innerCols[i];
          if (ch === "(") d2++;
          else if (ch === ")") d2--;
          if (ch === "," && d2 === 0) {
            flat.push(cur2.trim());
            cur2 = "";
          } else cur2 += ch;
        }
        if (cur2.trim()) flat.push(cur2.trim());

        innerSelect = flat
          .filter(p => !/\w+\s*\(/.test(p))
          .join(", ") || "*";

        // Handle nested-nested: add sub-joins inline
        const subNested = flat.filter(p => /\w+\s*\(/.test(p));
        for (const sn of subNested) {
          const snm = sn.match(/^(\w+)\s*\((.+)\)$/s);
          if (snm) {
            const snAlias = snm[1];
            const snCols = snm[2].replace(/\s+/g, ' ').trim();
            const snFkKey = `${alias}:${snAlias}`;
            const snFk = FK_MAP[snFkKey] || FK_MAP[snAlias];
            if (snFk) {
              // Reference parent table columns directly (we're inside FROM public.alias subquery)
              innerSelect += `, (SELECT row_to_json(_sn) FROM (SELECT ${snCols} FROM public.${snAlias} WHERE ${snAlias}.${snFk.ref_col || "id"} = ${alias}.${snFk.fk} LIMIT 1) _sn) AS ${snAlias}`;
            }
          }
        }
      }

      relationships.push({
        alias,
        table: alias,
        fk: fkInfo.fk,
        refCol: fkInfo.ref_col || "id",
        cols: innerSelect || "*",
        isArray: false,
      });
    } else {
      // Direct column
      if (part === "*") {
        directColParts.push(`"${mainTable}".*`);
      } else {
        directColParts.push(part);
      }
    }
  }

  // Build SELECT and JOINs
  const joinParts: string[] = [];
  const selectExtraAliases: string[] = [];

  for (const rel of relationships) {
    const joinAlias = `_j_${rel.alias}`;
    joinParts.push(
      `LEFT JOIN LATERAL (` +
        `SELECT row_to_json(_r) AS _data FROM (` +
          `SELECT ${rel.cols} FROM public.${rel.table} WHERE ${rel.table}.${rel.refCol} = "${mainTable}".${rel.fk} LIMIT 1` +
        `) _r` +
      `) ${joinAlias} ON true`
    );
    selectExtraAliases.push(`${joinAlias}._data AS ${rel.alias}`);
  }

  if (directColParts.length === 0 && relationships.length > 0) {
    directColParts.push(`"${mainTable}".*`);
  }

  const selectClause = [...directColParts, ...selectExtraAliases].join(", ") || `"${mainTable}".*`;
  const joinClauses = joinParts.join(" ");

  return { selectClause, joinClauses };
}

// Helper to get user from request
async function getUser(req: Request) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const userId = getSessionUser(token);
  if (!userId) return null;
  return getUserById(userId);
}

// Generic SELECT query proxy
// POST /api/db/select
router.post("/select", async (req: Request, res: Response) => {
  const { table, columns, filters, orFilters, order, limit: limitVal, offset: offsetVal, count, single, maybeSingle } = req.body;

  if (!table) return res.status(400).json({ error: "table is required" });

  // Security: table whitelist
  const ALLOWED_TABLES = [
    "profiles", "user_roles", "villages", "user_villages", "categories", "trade_groups",
    "transaction_packages", "merchants", "merchant_subscriptions", "group_members",
    "kas_payments", "products", "product_images", "product_variants", "quota_tiers",
    "tourism", "couriers", "orders", "order_items", "flash_sales", "reviews",
    "refund_requests", "withdrawal_requests", "courier_earnings", "courier_withdrawal_requests",
    "platform_fees", "insurance_fund", "verifikator_codes", "verifikator_earnings",
    "verifikator_withdrawals", "group_announcements", "vouchers", "voucher_usages",
    "promotions", "notifications", "broadcast_notifications", "chat_messages", "wishlists",
    "saved_addresses", "push_subscriptions", "app_settings", "admin_audit_logs",
    "backup_logs", "backup_schedules", "rate_limits", "seo_settings", "quota_usage_logs",
    "page_views", "halal_regulations", "pos_packages", "pos_settings", "pos_subscriptions",
    "pos_transactions", "ride_requests", "merchant_gallery", "courier_deposits",
    "courier_balance_logs", "merchant_favorites", "users",
    "pos_tenants", "pos_outlets", "pos_users", "pos_categories", "pos_brands",
    "pos_products", "pos_product_variants", "pos_stock", "pos_stock_mutations",
    "pos_sales", "pos_sale_items", "pos_purchase_orders", "pos_purchase_order_items",
    "pos_purchase_returns", "pos_purchase_return_items", "pos_cash_sessions",
    "pos_cash_transactions", "pos_suppliers", "pos_customers", "pos_loyalty_programs",
    "pos_loyalty_points", "pos_discounts", "pos_promotions", "pos_integration_settings",
    "pos_marketplace_sync", "pos_sync_logs", "pos_imported_orders", "pos_stock_mutations",
    "pos_audit_logs", "pos_transfer_orders", "pos_transfer_order_items",
    "merchant_operating_hours", "admin_banners", "halal_certificates", "merchant_dues",
    "payment_proofs", "search_history", "product_views", "merchant_visitors",
    "commission_rules", "broadcast_messages", "village_events", "user_villages",
    "courier_ratings", "verifikator_events",
    "cashback_rules", "cashback_transactions", "referral_usages",
    "product_subscriptions", "api_keys", "stock_history",
    "tourism_guides", "tourism_packages", "tourism_bookings",
  ];

  const tbl = String(table).replace(/[^a-z0-9_]/g, "");
  if (!ALLOWED_TABLES.includes(tbl)) {
    return res.status(403).json({ error: `Table '${tbl}' not allowed` });
  }

  try {
    const client = await pool.connect();
    try {
      // Parse Supabase-style nested relationship selects into proper SQL JOINs
      const { selectClause, joinClauses } = parseSupabaseColumns(columns, tbl);
      let sql = `SELECT ${selectClause} FROM public.${tbl}`;
      if (joinClauses) sql += " " + joinClauses;
      const params: any[] = [];

      const buildCondition = (f: any, params: any[]): string => {
        const op = f.op || "=";
        if (op === "is" && f.value === null) return `"${tbl}".${f.column} IS NULL`;
        if (op === "is" && f.value !== null) return `"${tbl}".${f.column} IS NOT NULL`;
        if (op === "is_not") { params.push(f.value); return `"${tbl}".${f.column} IS DISTINCT FROM $${params.length}`; }
        params.push(f.value);
        const n = params.length;
        if (op === "in") return `"${tbl}".${f.column} = ANY($${n})`;
        if (op === "ilike" || op === "like") return `"${tbl}".${f.column} ILIKE $${n}`;
        if (op === "gte") return `"${tbl}".${f.column} >= $${n}`;
        if (op === "lte") return `"${tbl}".${f.column} <= $${n}`;
        if (op === "gt") return `"${tbl}".${f.column} > $${n}`;
        if (op === "lt") return `"${tbl}".${f.column} < $${n}`;
        if (op === "neq") return `"${tbl}".${f.column} != $${n}`;
        if (op === "contains") return `"${tbl}".${f.column} @> $${n}`;
        if (op === "fts") return `to_tsvector("${tbl}".${f.column}) @@ plainto_tsquery($${n})`;
        return `"${tbl}".${f.column} = $${n}`;
      };

      /**
       * Parse Supabase .or() filter strings like:
       * "sender_id.eq.UUID,receiver_id.eq.UUID"
       * "start_date.is.null,start_date.lte.2024-01-01"
       * "user_email.ilike.%foo%,table_name.ilike.%foo%"
       */
      const parseOrFilterString = (filterStr: string, params: any[]): string => {
        const parts = filterStr.split(",").map(s => s.trim()).filter(Boolean);
        const clauses = parts.map(part => {
          // Format: column.op.value  (value can contain dots)
          const dotIdx1 = part.indexOf(".");
          const dotIdx2 = part.indexOf(".", dotIdx1 + 1);
          if (dotIdx1 === -1 || dotIdx2 === -1) return "TRUE";
          const col = part.substring(0, dotIdx1);
          const op = part.substring(dotIdx1 + 1, dotIdx2);
          const valRaw = part.substring(dotIdx2 + 1);
          let value: any = valRaw;
          if (valRaw === "null") value = null;
          else if (valRaw === "true") value = true;
          else if (valRaw === "false") value = false;
          else if (!isNaN(Number(valRaw)) && valRaw !== "") value = Number(valRaw);
          return buildCondition({ column: col, op, value }, params);
        });
        return clauses.length > 0 ? `(${clauses.join(" OR ")})` : "TRUE";
      };

      const allWhereConditions: string[] = [];

      if (filters && Array.isArray(filters) && filters.length > 0) {
        for (const f of filters) {
          allWhereConditions.push(buildCondition(f, params));
        }
      }

      if (orFilters && Array.isArray(orFilters) && orFilters.length > 0) {
        for (const orStr of orFilters) {
          allWhereConditions.push(parseOrFilterString(orStr, params));
        }
      }

      if (allWhereConditions.length > 0) {
        sql += ` WHERE ${allWhereConditions.join(" AND ")}`;
      }

      if (order) {
        const dir = order.ascending === false ? "DESC" : "ASC";
        sql += ` ORDER BY ${order.column} ${dir}`;
      }

      if (limitVal) {
        sql += ` LIMIT ${parseInt(limitVal)}`;
      }

      if (offsetVal) {
        sql += ` OFFSET ${parseInt(offsetVal)}`;
      }

      let countResult: number | null = null;
      if (count === "exact") {
        const countSql = `SELECT COUNT(*) FROM public.${tbl}` + (sql.includes("WHERE") ? " WHERE " + sql.split("WHERE")[1].split("ORDER")[0].split("LIMIT")[0] : "");
        try {
          const cRes = await client.query(countSql, params);
          countResult = parseInt(cRes.rows[0]?.count || "0");
        } catch {}
      }

      const result = await client.query(sql, params);
      const data = result.rows;

      if (single) {
        if (data.length === 0) return res.status(406).json({ error: "No rows", data: null, count: countResult });
        return res.json({ data: data[0], count: countResult });
      }

      if (maybeSingle) {
        return res.json({ data: data[0] || null, count: countResult });
      }

      return res.json({ data, count: countResult });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("DB select error:", err.message);
    return res.status(500).json({ error: err.message, data: null });
  }
});

// S1 + S2: Tabel yang boleh ditulis tanpa autentikasi (sangat terbatas)
const PUBLIC_WRITE_TABLES = new Set(["product_views", "search_history", "merchant_visitors"]);

// INSERT — S1: wajib autentikasi kecuali tabel publik
router.post("/insert", async (req: Request, res: Response) => {
  const { table, rows, upsert, onConflict } = req.body;
  if (!table || !rows) return res.status(400).json({ error: "table and rows are required" });

  const tbl = String(table).replace(/[^a-z0-9_]/g, "");

  // S1: Cek autentikasi untuk tabel non-publik
  if (!PUBLIC_WRITE_TABLES.has(tbl)) {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized: login diperlukan untuk operasi ini" });
  }

  const data = Array.isArray(rows) ? rows : [rows];
  if (data.length === 0) return res.json({ data: [] });

  try {
    const client = await pool.connect();
    try {
      const results = [];
      for (const row of data) {
        const keys = Object.keys(row);
        const values = keys.map((k) => row[k]);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        let sql = `INSERT INTO public.${tbl} (${keys.join(", ")}) VALUES (${placeholders})`;
        if (upsert && onConflict) {
          const updateSet = keys.filter(k => k !== onConflict).map((k, i) => `${k} = EXCLUDED.${k}`).join(", ");
          sql += ` ON CONFLICT (${onConflict}) DO UPDATE SET ${updateSet}`;
        } else if (upsert) {
          sql += ` ON CONFLICT DO NOTHING`;
        }
        sql += " RETURNING *";
        const result = await client.query(sql, values);
        if (result.rows[0]) {
          results.push(result.rows[0]);
          broadcastDbEvent({ type: "postgres_changes", table: tbl, event: "INSERT", record: result.rows[0], schema: "public" });
        }
      }

      // P1.2: Notifikasi otomatis saat order baru dibuat
      if (tbl === "orders" && results[0]) {
        notifyNewOrder(results[0]).catch((e) => console.error("[notify] order INSERT:", e));
      }
      // P1.2: Notifikasi ke admin desa saat merchant baru daftar
      if (tbl === "merchants" && results[0]) {
        notifyNewMerchantToAdminDesa(results[0]).catch((e) => console.error("[notify] merchant INSERT:", e));
      }

      return res.json({ data: results });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("DB insert error:", err.message);
    return res.status(500).json({ error: err.message, data: null });
  }
});

// UPDATE — S1: wajib autentikasi, S2: wajib ada filter
router.post("/update", async (req: Request, res: Response) => {
  const { table, updates, filters } = req.body;
  if (!table || !updates) return res.status(400).json({ error: "table and updates are required" });

  const tbl = String(table).replace(/[^a-z0-9_]/g, "");

  // S1: Cek autentikasi
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized: login diperlukan untuk operasi ini" });

  // S2: Wajib ada minimal satu filter — cegah UPDATE tanpa WHERE (full-table wipe)
  if (!filters || !Array.isArray(filters) || filters.length === 0) {
    return res.status(400).json({ error: "filters diperlukan untuk operasi update (tidak boleh kosong)" });
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) return res.json({ data: [] });

  try {
    const client = await pool.connect();
    try {
      const params: any[] = keys.map((k) => updates[k]);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
      let sql = `UPDATE public.${tbl} SET ${setClauses}`;

      const conditions: string[] = [];
      for (const f of filters) {
        params.push(f.value);
        conditions.push(`${f.column} = $${params.length}`);
      }
      sql += ` WHERE ${conditions.join(" AND ")}`;

      sql += " RETURNING *";
      const result = await client.query(sql, params);
      for (const row of result.rows) {
        broadcastDbEvent({ type: "postgres_changes", table: tbl, event: "UPDATE", record: row, schema: "public" });
      }

      // P1.2: Notifikasi buyer saat status pesanan berubah
      if (tbl === "orders") {
        for (const row of result.rows) {
          notifyOrderStatusChange(row).catch((e) => console.error("[notify] order UPDATE:", e));
        }
      }

      return res.json({ data: result.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("DB update error:", err.message);
    return res.status(500).json({ error: err.message, data: null });
  }
});

// DELETE — S1: wajib autentikasi, S2: wajib ada filter
router.post("/delete", async (req: Request, res: Response) => {
  const { table, filters } = req.body;
  if (!table) return res.status(400).json({ error: "table is required" });

  const tbl = String(table).replace(/[^a-z0-9_]/g, "");

  // S1: Cek autentikasi
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized: login diperlukan untuk operasi ini" });

  // S2: Wajib ada minimal satu filter — cegah DELETE tanpa WHERE (full-table wipe)
  if (!filters || !Array.isArray(filters) || filters.length === 0) {
    return res.status(400).json({ error: "filters diperlukan untuk operasi delete (tidak boleh kosong)" });
  }

  try {
    const client = await pool.connect();
    try {
      let sql = `DELETE FROM public.${tbl}`;
      const params: any[] = [];

      const conditions: string[] = [];
      for (const f of filters) {
        params.push(f.value);
        conditions.push(`${f.column} = $${params.length}`);
      }
      sql += ` WHERE ${conditions.join(" AND ")}`;

      sql += " RETURNING *";
      const result = await client.query(sql, params);
      for (const row of result.rows) {
        broadcastDbEvent({ type: "postgres_changes", table: tbl, event: "DELETE", record: row, old_record: row, schema: "public" });
      }
      return res.json({ data: result.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("DB delete error:", err.message);
    return res.status(500).json({ error: err.message, data: null });
  }
});

// RPC call proxy
router.post("/rpc/:fn", async (req: Request, res: Response) => {
  const fn = req.params.fn.replace(/[^a-z0-9_]/g, "");
  const args = req.body || {};

  // Allowlist of safe RPCs
  const ALLOWED_RPCS = [
    "apply_voucher", "accept_ride", "check_cod_eligibility",
    "get_quota_cost", "check_merchant_quota", "check_rate_limit",
    "cleanup_expired_chats", "generate_monthly_kas",
    // P1-01: tambah RPC yang diblokir sebelumnya
    "send_notification",
    "decrement_stock",
    "increment_product_view",
    "deduct_merchant_quota",
    "use_merchant_quota",
    "process_verifikator_withdrawal",
    "record_verifikator_commission",
    "auto_assign_merchant_to_group",
    "update_cod_trust_score",
    "update_trust_score",
    "notify_order_change",
    "notify_admin_new_withdrawal",
    "notify_merchant_verification",
    "notify_withdrawal_change",
    "auto_cancel_pending_orders",
    "auto_complete_delivered_orders",
  ];

  if (!ALLOWED_RPCS.includes(fn)) {
    return res.status(403).json({ error: `RPC '${fn}' not allowed` });
  }

  try {
    const client = await pool.connect();
    try {
      const keys = Object.keys(args);
      const params = keys.map((k) => args[k]);
      const argList = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
      const sql = `SELECT * FROM public.${fn}(${argList})`;
      const result = await client.query(sql, params);
      return res.json({ data: result.rows[0] || null });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(`RPC ${fn} error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
