/**
 * P2-05: Push Notification Backend
 * Endpoints: subscribe, unsubscribe, send push to user(s)
 * Uses web-push with VAPID keys.
 */
import { Router, Request } from "express";
import webpush from "web-push";
import { pool } from "../db";
import { getSessionUser, getUserById } from "../auth";

// S8: getSessionUser sekarang async — helper ini juga harus async
async function getAuthUser(req: Request) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const userId = await getSessionUser(token);
  if (!userId) return null;
  return getUserById(userId);
}

const router = Router();

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL       = process.env.VAPID_EMAIL       || "mailto:admin@desamart.id";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// GET /api/push/vapid-public-key — kirim VAPID public key ke frontend
router.get("/vapid-public-key", (_req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: "Push notifications belum dikonfigurasi" });
  }
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — simpan push subscription
// S5: user_id diambil dari session yang terautentikasi, BUKAN dari req.body
router.post("/subscribe", async (req: Request, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized: login diperlukan" });
  }

  const { subscription } = req.body as { subscription: PushSubscriptionJSON };
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: "subscription endpoint diperlukan" });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id    = EXCLUDED.user_id,
             p256dh     = EXCLUDED.p256dh,
             auth       = EXCLUDED.auth,
             updated_at = now()`,
      [
        authUser.id,
        subscription.endpoint,
        (subscription.keys as any)?.p256dh ?? null,
        (subscription.keys as any)?.auth    ?? null,
      ]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return res.status(500).json({ error: "Gagal menyimpan subscription" });
  } finally {
    client.release();
  }
});

// POST /api/push/unsubscribe — hapus push subscription
// S5: Hanya bisa unsubscribe endpoint milik user sendiri
router.post("/unsubscribe", async (req: Request, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: "Unauthorized" });

  const { endpoint } = req.body as { endpoint: string };
  if (!endpoint) return res.status(400).json({ error: "endpoint diperlukan" });

  const client = await pool.connect();
  try {
    await client.query(
      "DELETE FROM public.push_subscriptions WHERE endpoint = $1 AND user_id = $2",
      [endpoint, authUser.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Gagal menghapus subscription" });
  } finally {
    client.release();
  }
});

// POST /api/push/send — kirim push ke user tertentu
router.post("/send", async (req, res) => {
  const { user_id, title, body, url, icon } = req.body as {
    user_id: string; title: string; body: string; url?: string; icon?: string;
  };

  if (!user_id || !title || !body) {
    return res.status(400).json({ error: "user_id, title, body wajib diisi" });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: "VAPID keys belum dikonfigurasi" });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT endpoint, p256dh, auth FROM public.push_subscriptions WHERE user_id = $1",
      [user_id]
    );

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || "/favicon.ico",
      url:  url  || "/",
    });

    const results = await Promise.allSettled(
      result.rows.map((row) =>
        webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload
        )
      )
    );

    // Hapus subscription yang sudah tidak valid (410 Gone)
    const staleEndpoints = result.rows
      .filter((_, i) =>
        results[i].status === "rejected" &&
        (results[i] as PromiseRejectedResult).reason?.statusCode === 410
      )
      .map((r) => r.endpoint);

    if (staleEndpoints.length > 0) {
      await client.query(
        "DELETE FROM public.push_subscriptions WHERE endpoint = ANY($1)",
        [staleEndpoints]
      );
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return res.json({ success: true, sent, total: result.rows.length });
  } catch (err) {
    console.error("Push send error:", err);
    return res.status(500).json({ error: "Gagal mengirim push notification" });
  } finally {
    client.release();
  }
});

// POST /api/push/order-status — trigger push saat status order berubah
router.post("/order-status", async (req, res) => {
  const { orderId, newStatus } = req.body as { orderId: string; newStatus: string };
  if (!orderId || !newStatus) {
    return res.status(400).json({ error: "orderId dan newStatus wajib diisi" });
  }
  try {
    const { sendOrderStatusPush } = await import("../lib/pushHelper");
    await sendOrderStatusPush(orderId, newStatus);
    return res.json({ success: true });
  } catch (err) {
    console.error("[push/order-status] error:", err);
    return res.status(500).json({ error: "Gagal mengirim push status pesanan" });
  }
});

// POST /api/push/broadcast — kirim push ke semua user (admin only)
router.post("/broadcast", async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: "Unauthorized: login diperlukan" });
  if (!authUser.roles.includes("admin")) {
    return res.status(403).json({ error: "Forbidden: hanya admin yang dapat broadcast" });
  }

  const { title, body, url } = req.body as { title: string; body: string; url?: string };

  if (!title || !body) {
    return res.status(400).json({ error: "title dan body wajib diisi" });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: "VAPID keys belum dikonfigurasi" });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT endpoint, p256dh, auth FROM public.push_subscriptions"
    );

    const payload = JSON.stringify({ title, body, icon: "/favicon.ico", url: url || "/" });

    const results = await Promise.allSettled(
      result.rows.map((row) =>
        webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload
        )
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return res.json({ success: true, sent, total: result.rows.length });
  } catch (err) {
    return res.status(500).json({ error: "Gagal broadcast" });
  } finally {
    client.release();
  }
});

// GET /api/push/generate-vapid — generate VAPID key pair baru
router.get("/generate-vapid", (_req, res) => {
  try {
    const keys = webpush.generateVAPIDKeys();
    return res.json({ publicKey: keys.publicKey, privateKey: keys.privateKey });
  } catch (err) {
    return res.status(500).json({ error: "Gagal generate VAPID keys" });
  }
});

// POST /api/push/update-vapid — update VAPID config runtime
router.post("/update-vapid", (req, res) => {
  const { public_key, private_key, email } = req.body as {
    public_key: string; private_key: string; email: string;
  };
  if (!public_key || !private_key) {
    return res.status(400).json({ error: "public_key dan private_key wajib diisi" });
  }
  try {
    webpush.setVapidDetails(email || VAPID_EMAIL, public_key, private_key);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "VAPID keys tidak valid" });
  }
});

export default router;
