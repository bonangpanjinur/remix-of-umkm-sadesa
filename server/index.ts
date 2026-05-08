import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001;

app.use(express.json());

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-callback-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

app.use((req, res, next) => {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "";
  return createClient(url, key, { auth: { persistSession: false } });
}

const EMSIFA_BASE = "https://www.emsifa.com/api-wilayah-indonesia/api";

app.get("/api/wilayah", async (req, res) => {
  const { type, code } = req.query as { type?: string; code?: string };
  if (!type) return res.status(400).json({ error: "Missing type parameter" });

  let url: string;
  switch (type) {
    case "provinces":
      url = `${EMSIFA_BASE}/provinces.json`;
      break;
    case "regencies":
      if (!code)
        return res.status(400).json({ error: "Missing code parameter" });
      url = `${EMSIFA_BASE}/regencies/${code}.json`;
      break;
    case "districts":
      if (!code)
        return res.status(400).json({ error: "Missing code parameter" });
      url = `${EMSIFA_BASE}/districts/${code}.json`;
      break;
    case "villages":
      if (!code)
        return res.status(400).json({ error: "Missing code parameter" });
      url = `${EMSIFA_BASE}/villages/${code}.json`;
      break;
    default:
      return res.status(400).json({ error: "Invalid type" });
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "DesaMart/1.0" },
    });
    if (!response.ok) throw new Error(`emsifa returned ${response.status}`);
    const json: Array<{ id: string; name: string }> = await response.json();
    const data = Array.isArray(json)
      ? json.map((item) => ({ code: item.id, name: item.name }))
      : json;
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.json(data);
  } catch (err) {
    console.error("wilayah error:", err);
    return res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

app.post("/api/assign-courier", async (req, res) => {
  const supabase = getSupabaseAdmin();
  const {
    order_id,
    merchant_lat,
    merchant_lng,
    max_distance_km = 10,
  } = req.body;

  if (!order_id) return res.status(400).json({ error: "order_id is required" });

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, courier_id, merchant_id")
    .eq("id", order_id)
    .single();

  if (orderError || !order)
    return res.status(404).json({ error: "Order not found" });
  if (order.courier_id)
    return res
      .status(400)
      .json({ error: "Order already has courier", courier_id: order.courier_id });

  let pickupLat = merchant_lat || -6.9175;
  let pickupLng = merchant_lng || 107.6191;

  const { data: couriers } = await supabase
    .from("couriers")
    .select("id, name, current_lat, current_lng, vehicle_type")
    .eq("status", "ACTIVE")
    .eq("registration_status", "APPROVED")
    .eq("is_available", true)
    .not("current_lat", "is", null)
    .not("current_lng", "is", null);

  if (!couriers || couriers.length === 0)
    return res.json({ success: false, error: "No available couriers found" });

  const courierIds = couriers.map((c) => c.id);
  const { data: activeOrders } = await supabase
    .from("orders")
    .select("courier_id")
    .in("courier_id", courierIds)
    .in("status", ["ASSIGNED", "PICKED_UP", "ON_DELIVERY"]);

  const orderCounts: Record<string, number> = {};
  activeOrders?.forEach((o) => {
    orderCounts[o.courier_id] = (orderCounts[o.courier_id] || 0) + 1;
  });

  function haversine(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const candidates = couriers
    .map((c) => ({
      ...c,
      active_orders: orderCounts[c.id] || 0,
      distance_km: haversine(c.current_lat, c.current_lng, pickupLat, pickupLng),
    }))
    .filter((c) => c.distance_km <= max_distance_km && c.active_orders < 3)
    .sort((a, b) => a.distance_km + a.active_orders * 2 - (b.distance_km + b.active_orders * 2));

  if (!candidates.length)
    return res.json({ success: false, error: "No suitable couriers within range" });

  const best = candidates[0];
  await supabase
    .from("orders")
    .update({ courier_id: best.id, status: "ASSIGNED", assigned_at: new Date().toISOString() })
    .eq("id", order_id);

  const { data: courierData } = await supabase
    .from("couriers")
    .select("user_id")
    .eq("id", best.id)
    .single();

  if (courierData?.user_id) {
    await supabase.from("notifications").insert({
      user_id: courierData.user_id,
      title: "Pesanan Baru Ditugaskan",
      message: `Anda mendapat pesanan baru #${order_id.slice(0, 8).toUpperCase()}. Segera ambil pesanan.`,
      type: "order",
      link: "/courier",
    });
  }

  const { data: orderDetails } = await supabase
    .from("orders")
    .select("shipping_cost")
    .eq("id", order_id)
    .single();

  if (orderDetails?.shipping_cost) {
    await supabase.from("courier_earnings").insert({
      courier_id: best.id,
      order_id,
      amount: Math.floor(orderDetails.shipping_cost * 0.8),
      type: "DELIVERY",
      status: "PENDING",
    });
  }

  return res.json({
    success: true,
    courier: {
      id: best.id,
      name: best.name,
      distance_km: Math.round(best.distance_km * 10) / 10,
      vehicle_type: best.vehicle_type,
    },
    candidates_count: candidates.length,
  });
});

async function getXenditSettings(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "payment_xendit")
    .maybeSingle();

  if (error || !data) throw new Error("Xendit settings not found");
  const settings = data.value as {
    enabled: boolean;
    secret_key?: string;
    callback_token?: string;
  };
  if (!settings.enabled) throw new Error("Xendit payment is disabled");
  if (!settings.secret_key) throw new Error("Xendit secret key not configured");
  return settings;
}

app.post("/api/xendit/create-invoice", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const settings = await getXenditSettings(supabase);
    const { order_id, amount, payer_email, description } = req.body;

    const authHeader = `Basic ${Buffer.from(settings.secret_key + ":").toString("base64")}`;
    const origin = req.headers.origin || `https://${req.headers.host}`;

    const response = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        external_id: order_id,
        amount,
        payer_email,
        description,
        invoice_duration: 86400,
        currency: "IDR",
        success_redirect_url: `${origin}/orders?payment=success`,
        failure_redirect_url: `${origin}/orders?payment=failed`,
      }),
    });

    if (!response.ok) throw new Error(`Xendit error: ${response.status}`);
    const invoice = await response.json();

    await supabase
      .from("orders")
      .update({
        payment_invoice_id: invoice.id,
        payment_invoice_url: invoice.invoice_url,
        payment_status: "PENDING",
      })
      .eq("id", order_id);

    return res.json({ success: true, invoice_id: invoice.id, invoice_url: invoice.invoice_url, expiry_date: invoice.expiry_date });
  } catch (err) {
    console.error("create-invoice error:", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

app.get("/api/xendit/check-status", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const settings = await getXenditSettings(supabase);
    const { invoice_id } = req.query;
    if (!invoice_id) return res.status(400).json({ error: "invoice_id required" });

    const authHeader = `Basic ${Buffer.from(settings.secret_key + ":").toString("base64")}`;
    const response = await fetch(`https://api.xendit.co/v2/invoices/${invoice_id}`, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) throw new Error(`Xendit error: ${response.status}`);
    const invoice = await response.json();
    return res.json({ success: true, status: invoice.status, paid_at: invoice.paid_at, payment_method: invoice.payment_method });
  } catch (err) {
    console.error("check-status error:", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

app.post("/api/xendit/webhook", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const settings = await getXenditSettings(supabase).catch(() => null);
    const callbackToken = req.headers["x-callback-token"];

    if (settings?.callback_token && callbackToken !== settings.callback_token) {
      return res.status(401).json({ error: "Invalid callback token" });
    }

    const payload = req.body as {
      id: string;
      external_id: string;
      status: "PAID" | "EXPIRED" | "PENDING";
      paid_at?: string;
      payment_method?: string;
    };

    if (!payload.external_id) return res.status(400).json({ error: "Missing external_id" });

    const newStatus = payload.status === "PAID" ? "PAID" : payload.status === "EXPIRED" ? "EXPIRED" : "PENDING";

    await supabase
      .from("orders")
      .update({
        payment_status: newStatus,
        payment_method: payload.payment_method || null,
        paid_at: payload.paid_at || null,
        ...(newStatus === "PAID" ? { status: "PAID" } : {}),
      })
      .eq("id", payload.external_id);

    if (newStatus === "PAID") {
      const { data: order } = await supabase
        .from("orders")
        .select("user_id, id")
        .eq("id", payload.external_id)
        .single();

      if (order?.user_id) {
        await supabase.from("notifications").insert({
          user_id: order.user_id,
          title: "Pembayaran Berhasil!",
          message: `Pesanan #${order.id.slice(0, 8).toUpperCase()} telah dibayar.`,
          type: "order",
          link: `/orders`,
        });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("webhook error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── S1-05: Webhook marketplace order → import ke POS ──────────────────────
// POST /api/webhook/marketplace-order
// Menerima notifikasi order marketplace dan membuat record import ke POS
app.post("/api/webhook/marketplace-order", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const {
      order_id,
      tenant_id,
      items,           // [{ product_id, pos_product_id, qty, price }]
      status,
      customer_name,
      customer_phone,
      total,
      created_at,
    } = req.body;

    if (!order_id || !tenant_id) {
      return res.status(400).json({ error: "order_id and tenant_id are required" });
    }

    // Cek apakah order sudah diimport sebelumnya
    const { data: existing } = await supabase
      .from("pos_imported_orders" as any)
      .select("id")
      .eq("marketplace_order_id", order_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (existing) {
      return res.json({ success: true, message: "Order already imported", order_id });
    }

    // Insert ke tabel import orders POS
    await supabase.from("pos_imported_orders" as any).insert({
      tenant_id,
      marketplace_order_id: order_id,
      customer_name: customer_name || "Pelanggan Marketplace",
      customer_phone: customer_phone || null,
      total: total || 0,
      status: status || "pending",
      items: items || [],
      marketplace_created_at: created_at || new Date().toISOString(),
      imported_at: new Date().toISOString(),
    });

    // Kurangi stok produk POS yang terhubung
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.pos_product_id && item.qty > 0) {
          const { data: product } = await supabase
            .from("pos_products" as any)
            .select("stock")
            .eq("id", item.pos_product_id)
            .eq("tenant_id", tenant_id)
            .maybeSingle();

          if (product && (product as any).stock !== null) {
            const newStock = Math.max(0, Number((product as any).stock) - Number(item.qty));
            await supabase
              .from("pos_products" as any)
              .update({ stock: newStock, updated_at: new Date().toISOString() })
              .eq("id", item.pos_product_id);

            // Log mutasi stok
            await supabase.from("pos_stock_mutations" as any).insert({
              tenant_id,
              product_id: item.pos_product_id,
              type: "out",
              qty: item.qty,
              notes: `Order marketplace #${order_id.slice(0, 8).toUpperCase()}`,
              reference_type: "marketplace_order",
              reference_id: order_id,
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Catat ke sync log
    await supabase.from("pos_sync_logs" as any).insert({
      tenant_id,
      sync_type: "marketplace_webhook",
      status: "success",
      items_synced: Array.isArray(items) ? items.length : 0,
      notes: `Order ${order_id} imported via webhook`,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    console.log(`[webhook] Marketplace order ${order_id} imported for tenant ${tenant_id}`);
    return res.json({ success: true, message: "Order imported to POS", order_id });
  } catch (err) {
    console.error("marketplace-order webhook error:", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

// ─── S1-04: Auto-sync stok POS → marketplace (scheduled) ────────────────────
// Juga expose endpoint manual trigger: POST /api/pos/sync-stock
async function runStockSync() {
  const supabase = getSupabaseAdmin();
  console.log("[auto-sync] Starting scheduled stock sync...");

  try {
    // Ambil semua integrasi aktif yang punya auto_sync_stock = true
    const { data: integrations } = await supabase
      .from("pos_integration_settings" as any)
      .select("tenant_id, outlet_id, sync_interval_minutes, last_sync_at")
      .eq("auto_sync_stock", true);

    if (!integrations || integrations.length === 0) {
      console.log("[auto-sync] No active integrations with auto sync enabled.");
      return;
    }

    const now = new Date();
    let synced = 0;

    for (const integration of integrations as any[]) {
      const lastSync = integration.last_sync_at ? new Date(integration.last_sync_at) : null;
      const intervalMs = (integration.sync_interval_minutes || 60) * 60 * 1000;

      // Skip jika belum waktunya sync
      if (lastSync && now.getTime() - lastSync.getTime() < intervalMs) continue;

      // Ambil produk yang tersinkron
      const { data: syncedProducts } = await supabase
        .from("pos_marketplace_sync" as any)
        .select("*, pos_products(stock, price)")
        .eq("tenant_id", integration.tenant_id)
        .eq("sync_stock", true);

      if (!syncedProducts || syncedProducts.length === 0) continue;

      let itemsSynced = 0;
      for (const sp of syncedProducts as any[]) {
        if (!sp.marketplace_product_id || !sp.pos_products) continue;
        const newStock = sp.pos_products.stock || 0;

        // Update stok di tabel marketplace products
        await supabase
          .from("products" as any)
          .update({ stock: newStock, updated_at: now.toISOString() })
          .eq("id", sp.marketplace_product_id);

        itemsSynced++;
      }

      // Update last_sync_at
      await supabase
        .from("pos_integration_settings" as any)
        .update({ last_sync_at: now.toISOString() })
        .eq("tenant_id", integration.tenant_id);

      // Log sync
      await supabase.from("pos_sync_logs" as any).insert({
        tenant_id: integration.tenant_id,
        sync_type: "stock_sync",
        status: "success",
        items_synced: itemsSynced,
        notes: `Auto-sync scheduled (${integration.sync_interval_minutes} min interval)`,
        started_at: now.toISOString(),
        completed_at: new Date().toISOString(),
      });

      synced += itemsSynced;
      console.log(`[auto-sync] Tenant ${integration.tenant_id}: ${itemsSynced} products synced`);
    }

    if (synced > 0) console.log(`[auto-sync] Total: ${synced} products synced`);
  } catch (err) {
    console.error("[auto-sync] Error:", err);
  }
}

// Manual trigger endpoint
app.post("/api/pos/sync-stock", async (req, res) => {
  try {
    await runStockSync();
    return res.json({ success: true, message: "Stock sync triggered" });
  } catch (err) {
    return res.status(500).json({ error: "Sync failed" });
  }
});

// Jadwalkan auto-sync setiap 5 menit, fungsi itu sendiri cek interval per tenant
const SYNC_CHECK_INTERVAL_MS = 5 * 60 * 1000; // cek setiap 5 menit
setInterval(runStockSync, SYNC_CHECK_INTERVAL_MS);
console.log(`[auto-sync] Scheduled stock sync check every ${SYNC_CHECK_INTERVAL_MS / 60000} minutes`);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DesaMart API server running on port ${PORT}`);
});
