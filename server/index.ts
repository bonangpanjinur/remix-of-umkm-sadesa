import express from "express";
import { pool } from "./db";
import apiRoutes from "./routes/index";
import { createOrUpdateReplitUser } from "./auth";
import * as path from "path";
import * as fs from "fs";

const app = express();
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-callback-token",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

app.use((req, res, next) => {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// Replit Auth header middleware
app.use(async (req, res, next) => {
  const replitUserId = req.headers["x-replit-user-id"] as string;
  const replitUserName = req.headers["x-replit-user-name"] as string;
  if (replitUserId && !req.headers.authorization) {
    try {
      const user = await createOrUpdateReplitUser({ id: replitUserId, name: replitUserName });
      req.headers["x-replit-internal-user-id"] = user.id;
    } catch (err) {
      console.error("Replit auth middleware error:", err);
    }
  }
  next();
});

// Mount all API routes
app.use("/api", apiRoutes);

// Serve uploaded files
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/storage", express.static(UPLOAD_DIR));

// ─── Wilayah API ──────────────────────────────────────────────────────────────
const EMSIFA_BASE = "https://www.emsifa.com/api-wilayah-indonesia/api";

app.get("/api/wilayah", async (req, res) => {
  const { type, code } = req.query as { type?: string; code?: string };
  if (!type) return res.status(400).json({ error: "Missing type parameter" });
  let url: string;
  switch (type) {
    case "provinces": url = `${EMSIFA_BASE}/provinces.json`; break;
    case "regencies": if (!code) return res.status(400).json({ error: "Missing code" }); url = `${EMSIFA_BASE}/regencies/${code}.json`; break;
    case "districts": if (!code) return res.status(400).json({ error: "Missing code" }); url = `${EMSIFA_BASE}/districts/${code}.json`; break;
    case "villages": if (!code) return res.status(400).json({ error: "Missing code" }); url = `${EMSIFA_BASE}/villages/${code}.json`; break;
    default: return res.status(400).json({ error: "Invalid type" });
  }
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "DesaMart/1.0" } });
    if (!response.ok) throw new Error(`emsifa returned ${response.status}`);
    const json: Array<{ id: string; name: string }> = await response.json();
    const data = Array.isArray(json) ? json.map((item) => ({ code: item.id, name: item.name })) : json;
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

// ─── Courier auto-assign ──────────────────────────────────────────────────────
app.post("/api/assign-courier", async (req, res) => {
  const { order_id, merchant_lat, merchant_lng, max_distance_km = 10 } = req.body;
  if (!order_id) return res.status(400).json({ error: "order_id is required" });
  const client = await pool.connect();
  try {
    const orderRes = await client.query("SELECT id, status, courier_id FROM public.orders WHERE id = $1", [order_id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.courier_id) return res.status(400).json({ error: "Order already has courier", courier_id: order.courier_id });
    const pickupLat = merchant_lat || -6.9175;
    const pickupLng = merchant_lng || 107.6191;
    const couriersRes = await client.query(
      `SELECT id, name, current_lat, current_lng, vehicle_type FROM public.couriers WHERE status='ACTIVE' AND registration_status='APPROVED' AND is_available=true AND current_lat IS NOT NULL AND current_lng IS NOT NULL`
    );
    const couriers = couriersRes.rows;
    if (!couriers.length) return res.json({ success: false, error: "No available couriers found" });
    function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    const activeOrdersRes = await client.query(
      `SELECT courier_id FROM public.orders WHERE courier_id = ANY($1) AND status = ANY($2)`,
      [couriers.map((c:any)=>c.id), ["ASSIGNED","PICKED_UP","ON_DELIVERY"]]
    );
    const orderCounts: Record<string, number> = {};
    activeOrdersRes.rows.forEach((o:any) => { orderCounts[o.courier_id] = (orderCounts[o.courier_id]||0)+1; });
    const candidates = couriers
      .map((c:any) => ({ ...c, active_orders: orderCounts[c.id]||0, distance_km: haversine(c.current_lat, c.current_lng, pickupLat, pickupLng) }))
      .filter((c:any) => c.distance_km <= max_distance_km && c.active_orders < 3)
      .sort((a:any, b:any) => (a.distance_km + a.active_orders*2) - (b.distance_km + b.active_orders*2));
    if (!candidates.length) return res.json({ success: false, error: "No suitable couriers within range" });
    const best = candidates[0] as any;
    await client.query(`UPDATE public.orders SET courier_id=$1, status='ASSIGNED', assigned_at=now() WHERE id=$2`, [best.id, order_id]);
    const courierUserRes = await client.query("SELECT user_id FROM public.couriers WHERE id=$1", [best.id]);
    const courierUserId = courierUserRes.rows[0]?.user_id;
    if (courierUserId) {
      await client.query(`INSERT INTO public.notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)`,
        [courierUserId, "Pesanan Baru Ditugaskan", `Anda mendapat pesanan baru #${order_id.slice(0,8).toUpperCase()}.`, "order", "/courier"]);
    }
    return res.json({ success: true, courier: { id: best.id, name: best.name, distance_km: Math.round(best.distance_km*10)/10, vehicle_type: best.vehicle_type }, candidates_count: candidates.length });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  } finally { client.release(); }
});

// ─── Xendit ───────────────────────────────────────────────────────────────────
async function getXenditSettings(client: any) {
  const res = await client.query("SELECT value FROM public.app_settings WHERE key='payment_xendit'");
  if (!res.rows[0]) throw new Error("Xendit settings not found");
  const s = res.rows[0].value as { enabled: boolean; secret_key?: string; callback_token?: string };
  if (!s.enabled) throw new Error("Xendit payment is disabled");
  if (!s.secret_key) throw new Error("Xendit secret key not configured");
  return s;
}

app.post("/api/xendit/create-invoice", async (req, res) => {
  const client = await pool.connect();
  try {
    const s = await getXenditSettings(client);
    const { order_id, amount, payer_email, description } = req.body;
    const auth = `Basic ${Buffer.from(s.secret_key + ":").toString("base64")}`;
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const r = await fetch("https://api.xendit.co/v2/invoices", { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify({ external_id: order_id, amount, payer_email, description, invoice_duration: 86400, currency: "IDR", success_redirect_url: `${origin}/orders?payment=success`, failure_redirect_url: `${origin}/orders?payment=failed` }) });
    if (!r.ok) throw new Error(`Xendit error: ${r.status}`);
    const inv: any = await r.json();
    await client.query(`UPDATE public.orders SET payment_invoice_id=$1, payment_invoice_url=$2, payment_status='PENDING' WHERE id=$3`, [inv.id, inv.invoice_url, order_id]);
    return res.json({ success: true, invoice_id: inv.id, invoice_url: inv.invoice_url, expiry_date: inv.expiry_date });
  } catch (err) { return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" }); }
  finally { client.release(); }
});

app.get("/api/xendit/check-status", async (req, res) => {
  const client = await pool.connect();
  try {
    const s = await getXenditSettings(client);
    const { invoice_id } = req.query;
    if (!invoice_id) return res.status(400).json({ error: "invoice_id required" });
    const auth = `Basic ${Buffer.from(s.secret_key + ":").toString("base64")}`;
    const r = await fetch(`https://api.xendit.co/v2/invoices/${invoice_id}`, { headers: { Authorization: auth } });
    if (!r.ok) throw new Error(`Xendit error: ${r.status}`);
    const inv: any = await r.json();
    return res.json({ success: true, status: inv.status, paid_at: inv.paid_at, payment_method: inv.payment_method });
  } catch (err) { return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" }); }
  finally { client.release(); }
});

app.post("/api/xendit/webhook", async (req, res) => {
  const client = await pool.connect();
  try {
    // B7: Validasi Xendit callback token — tolak jika token salah
    const s = await getXenditSettings(client).catch(() => null);
    const incomingToken = req.headers["x-callback-token"] as string | undefined;
    if (s?.callback_token) {
      if (incomingToken !== s.callback_token) {
        console.warn("[xendit/webhook] Token tidak valid, request ditolak");
        return res.status(401).json({ error: "Invalid callback token" });
      }
    } else {
      console.warn("[xendit/webhook] callback_token belum dikonfigurasi — webhook diterima tanpa validasi. Konfigurasi segera di pengaturan admin.");
    }
    const p = req.body as { external_id: string; status: string; paid_at?: string; payment_method?: string };
    if (!p.external_id) return res.status(400).json({ error: "Missing external_id" });
    const st = p.status === "PAID" ? "PAID" : p.status === "EXPIRED" ? "EXPIRED" : "PENDING";
    await client.query(`UPDATE public.orders SET payment_status=$1, payment_method=$2, paid_at=$3${st==="PAID"?", status='PAID'":""} WHERE id=$4`, [st, p.payment_method||null, p.paid_at||null, p.external_id]);
    if (st === "PAID") {
      const o = await client.query("SELECT user_id FROM public.orders WHERE id=$1", [p.external_id]);
      if (o.rows[0]?.user_id) await client.query(`INSERT INTO public.notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)`, [o.rows[0].user_id, "Pembayaran Berhasil!", `Pesanan #${p.external_id.slice(0,8).toUpperCase()} telah dibayar.`, "order", "/orders"]);
    }
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: "Server error" }); }
  finally { client.release(); }
});

app.post("/api/webhook/marketplace-order", async (req, res) => {
  const client = await pool.connect();
  try {
    const { order_id, tenant_id, items, status, customer_name, customer_phone, total, created_at } = req.body;
    if (!order_id || !tenant_id) return res.status(400).json({ error: "order_id and tenant_id are required" });
    return res.json({ success: true, message: "Webhook received", order_id });
  } catch (err) { return res.status(500).json({ error: "Server error" }); }
  finally { client.release(); }
});

app.post("/api/pos/sync-stock", async (req, res) => {
  return res.json({ success: true, message: "Stock sync triggered" });
});

// ─── S6-08: WhatsApp Notification API ─────────────────────────────────────────
/**
 * Send WhatsApp notification via configured gateway (WAblas, Fonnte, or custom API).
 * Settings stored in app_settings under key 'whatsapp_settings'.
 */
async function getWhatsAppSettings(client: any) {
  const res = await client.query("SELECT value FROM public.app_settings WHERE key='whatsapp_settings'");
  if (!res.rows[0]) throw new Error("WhatsApp settings belum dikonfigurasi");
  const s = res.rows[0].value as {
    enabled: boolean;
    provider: "wablas" | "fonnte" | "custom";
    api_key?: string;
    api_url?: string;
    sender_number?: string;
  };
  if (!s.enabled) throw new Error("WhatsApp notification dinonaktifkan");
  if (!s.api_key) throw new Error("WhatsApp API key belum dikonfigurasi");
  return s;
}

async function sendWhatsAppMessage(to: string, message: string, settings: any): Promise<boolean> {
  const phone = to.replace(/\D/g, "").replace(/^0/, "62");

  if (settings.provider === "fonnte") {
    const r = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: settings.api_key, "Content-Type": "application/json" },
      body: JSON.stringify({ target: phone, message, delay: 1, countryCode: "62" }),
    });
    const json: any = await r.json();
    return json.status === true || json.status === "true";
  }

  if (settings.provider === "wablas") {
    const r = await fetch("https://console.wablas.com/api/send-message", {
      method: "POST",
      headers: { Authorization: settings.api_key, "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
    const json: any = await r.json();
    return json.status === "success";
  }

  // Custom provider: POST to api_url with { phone, message }
  if (settings.provider === "custom" && settings.api_url) {
    const r = await fetch(settings.api_url, {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
    return r.ok;
  }

  throw new Error("Provider WhatsApp tidak dikenali");
}

app.post("/api/whatsapp/send", async (req, res) => {
  const client = await pool.connect();
  try {
    const settings = await getWhatsAppSettings(client);
    const { to, message, template, template_data } = req.body;
    if (!to || (!message && !template)) {
      return res.status(400).json({ error: "to dan message/template wajib diisi" });
    }

    let finalMessage = message;
    if (template && !finalMessage) {
      const tmplRes = await client.query(
        "SELECT content FROM public.app_settings WHERE key=$1",
        [`wa_template_${template}`]
      );
      if (tmplRes.rows[0]) {
        finalMessage = tmplRes.rows[0].content;
        if (template_data && typeof template_data === "object") {
          for (const [k, v] of Object.entries(template_data)) {
            finalMessage = finalMessage.replace(new RegExp(`{{${k}}}`, "g"), String(v));
          }
        }
      } else {
        finalMessage = message || `Notifikasi dari DesaMart`;
      }
    }

    const success = await sendWhatsAppMessage(to, finalMessage, settings);

    // Log the notification
    await client.query(
      `INSERT INTO public.app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [
        `wa_log_${Date.now()}`,
        JSON.stringify({ to, status: success ? "sent" : "failed", sent_at: new Date().toISOString() }),
      ]
    );

    return res.json({ success, message: success ? "Pesan terkirim" : "Gagal mengirim pesan" });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  } finally {
    client.release();
  }
});

app.post("/api/whatsapp/send-order-notification", async (req, res) => {
  const client = await pool.connect();
  try {
    const settings = await getWhatsAppSettings(client);
    const { order_id, event } = req.body;
    if (!order_id || !event) return res.status(400).json({ error: "order_id dan event wajib diisi" });

    const orderRes = await client.query(
      `SELECT o.*, p.phone as buyer_phone, p.full_name as buyer_name,
              m.name as merchant_name, m.phone as merchant_phone
       FROM public.orders o
       LEFT JOIN public.profiles p ON o.user_id = p.id
       LEFT JOIN public.merchants m ON o.merchant_id = m.id
       WHERE o.id = $1`,
      [order_id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });

    const orderNo = order_id.slice(0, 8).toUpperCase();
    const messages: Record<string, { to: string; msg: string }[]> = {
      NEW: [
        {
          to: order.merchant_phone || "",
          msg: `*Pesanan Baru! 🛍️*\nHalo ${order.merchant_name}, ada pesanan baru #${orderNo} senilai Rp ${Number(order.total).toLocaleString("id-ID")}.\nSegera konfirmasi di DesaMart.`,
        },
      ],
      CONFIRMED: [
        {
          to: order.buyer_phone || "",
          msg: `*Pesanan Dikonfirmasi ✅*\nHai ${order.buyer_name}, pesanan #${orderNo} Anda telah dikonfirmasi oleh ${order.merchant_name}.\nStatus akan terupdate otomatis.`,
        },
      ],
      ASSIGNED: [
        {
          to: order.buyer_phone || "",
          msg: `*Kurir Ditemukan 🚴*\nHai ${order.buyer_name}, pesanan #${orderNo} Anda sedang dijemput oleh kurir.\nEstimasi tiba: 30-60 menit.`,
        },
      ],
      DELIVERED: [
        {
          to: order.buyer_phone || "",
          msg: `*Pesanan Tiba! 📦*\nHai ${order.buyer_name}, pesanan #${orderNo} telah berhasil diantarkan.\nJangan lupa beri rating kurir ya! 😊`,
        },
      ],
      DONE: [
        {
          to: order.buyer_phone || "",
          msg: `*Terima Kasih! 🙏*\nPesanan #${orderNo} telah selesai. Terima kasih sudah belanja di DesaMart.\nBeri ulasan produkmu ya!`,
        },
      ],
    };

    const targets = messages[event] || [];
    const results = [];
    for (const t of targets) {
      if (!t.to) continue;
      const ok = await sendWhatsAppMessage(t.to, t.msg, settings);
      results.push({ to: t.to, success: ok });
    }

    return res.json({ success: true, results });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  } finally {
    client.release();
  }
});

app.get("/api/whatsapp/test", async (req, res) => {
  const client = await pool.connect();
  try {
    const settings = await getWhatsAppSettings(client);
    const { phone } = req.query as { phone?: string };
    if (!phone) return res.status(400).json({ error: "phone wajib diisi" });
    const ok = await sendWhatsAppMessage(phone, "✅ Halo! Ini pesan tes dari DesaMart. WhatsApp API berhasil terhubung!", settings);
    return res.json({ success: ok });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  } finally {
    client.release();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DesaMart API server running on port ${PORT}`);
});
