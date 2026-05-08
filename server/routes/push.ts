/**
 * P2-05: Push Notification Backend
 * Endpoints: subscribe, unsubscribe, send push to user(s)
 * Uses web-push with VAPID keys.
 */
import { Router } from "express";
import webpush from "web-push";
import { pool } from "../db";

const router = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@desamart.id";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// GET /api/push/vapid-public-key — expose public VAPID key to frontend
router.get("/vapid-public-key", (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: "Push notifications not configured" });
  }
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — save push subscription for a user
router.post("/subscribe", async (req, res) => {
  const { user_id, subscription } = req.body as {
    user_id: string;
    subscription: PushSubscriptionJSON;
  };

  if (!user_id || !subscription?.endpoint) {
    return res.status(400).json({ error: "user_id and subscription are required" });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             p256dh  = EXCLUDED.p256dh,
             auth    = EXCLUDED.auth,
             updated_at = now()`,
      [
        user_id,
        subscription.endpoint,
        (subscription.keys as any)?.p256dh ?? null,
        (subscription.keys as any)?.auth ?? null,
      ]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return res.status(500).json({ error: "Failed to save subscription" });
  } finally {
    client.release();
  }
});

// POST /api/push/unsubscribe — remove push subscription
router.post("/unsubscribe", async (req, res) => {
  const { endpoint } = req.body as { endpoint: string };
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });

  const client = await pool.connect();
  try {
    await client.query(
      "DELETE FROM public.push_subscriptions WHERE endpoint = $1",
      [endpoint]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to remove subscription" });
  } finally {
    client.release();
  }
});

// POST /api/push/send — send push notification to a specific user
router.post("/send", async (req, res) => {
  const { user_id, title, body, url, icon } = req.body as {
    user_id: string;
    title: string;
    body: string;
    url?: string;
    icon?: string;
  };

  if (!user_id || !title || !body) {
    return res.status(400).json({ error: "user_id, title, body are required" });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: "VAPID keys not configured" });
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
      url: url || "/",
    });

    const results = await Promise.allSettled(
      result.rows.map((row) =>
        webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload
        )
      )
    );

    // Remove stale subscriptions (410 Gone)
    const staleEndpoints = result.rows
      .filter(
        (_, i) =>
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
    return res.status(500).json({ error: "Failed to send push notification" });
  } finally {
    client.release();
  }
});

// POST /api/push/broadcast — send push notification to all users (admin use)
router.post("/broadcast", async (req, res) => {
  const { title, body, url } = req.body as {
    title: string;
    body: string;
    url?: string;
  };

  if (!title || !body) {
    return res.status(400).json({ error: "title and body are required" });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: "VAPID keys not configured" });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT endpoint, p256dh, auth FROM public.push_subscriptions"
    );

    const payload = JSON.stringify({
      title,
      body,
      icon: "/favicon.ico",
      url: url || "/",
    });

    const results = await Promise.allSettled(
      result.rows.map((row) =>
        webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload
        )
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return res.json({ success: true, sent, total: result.rows.length });
  } catch (err) {
    return res.status(500).json({ error: "Failed to broadcast" });
  } finally {
    client.release();
  }
});

// GET /api/push/generate-vapid — generate new VAPID key pair
router.get("/generate-vapid", (_req, res) => {
  try {
    const keys = webpush.generateVAPIDKeys();
    return res.json({ publicKey: keys.publicKey, privateKey: keys.privateKey });
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate VAPID keys" });
  }
});

// POST /api/push/update-vapid — update in-memory VAPID config (runtime only)
router.post("/update-vapid", (req, res) => {
  const { public_key, private_key, email } = req.body as {
    public_key: string;
    private_key: string;
    email: string;
  };
  if (!public_key || !private_key) {
    return res.status(400).json({ error: "public_key and private_key are required" });
  }
  try {
    webpush.setVapidDetails(email || VAPID_EMAIL, public_key, private_key);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Invalid VAPID keys" });
  }
});

export default router;
