/**
 * Server-Sent Events (SSE) endpoint
 * Replaces Supabase Realtime channels for all real-time features.
 *
 * GET  /api/sse           — connect and receive events
 * POST /api/sse/broadcast — send broadcast event (peer-to-peer, e.g. courier location)
 * POST /api/sse/subscribe — subscribe client to a named channel
 */
import { Router, Request, Response } from "express";
import {
  addSSEClient,
  removeSSEClient,
  broadcastChannelEvent,
  getClientCount,
  addClientChannel,
} from "../sse-manager";
import { getSessionUser } from "../auth";

const router = Router();

// GET /api/sse — establish SSE stream
router.get("/", async (req: Request, res: Response) => {
  // Auth: token dari Authorization header atau query param
  const authHeader = req.headers.authorization || "";
  const token =
    authHeader.replace("Bearer ", "") ||
    (req.query.token as string) ||
    "";

  // S8: getSessionUser sekarang async (query ke DB)
  const userId = token ? await getSessionUser(token) : null;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // matikan nginx buffering
  res.flushHeaders();

  const client = addSSEClient(userId, res);

  // Kirim event connected
  res.write(`data: ${JSON.stringify({ type: "connected", userId, clients: getClientCount() })}\n\n`);

  // Heartbeat setiap 25 detik agar koneksi tidak terputus
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (_) {
      clearInterval(heartbeat);
    }
  }, 25000);

  // O5: Max 30 menit per koneksi — cegah zombie connection memory leak
  const MAX_DURATION_MS = 30 * 60 * 1000;
  const connectionTimeout = setTimeout(() => {
    clearInterval(heartbeat);
    removeSSEClient(client);
    res.end();
  }, MAX_DURATION_MS);

  // Bersihkan saat disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    clearTimeout(connectionTimeout);
    removeSSEClient(client);
  });

  req.on("error", () => {
    clearInterval(heartbeat);
    clearTimeout(connectionTimeout);
    removeSSEClient(client);
  });
});

// POST /api/sse/subscribe — subscribe ke channel tertentu setelah terkoneksi
router.post("/subscribe", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const userId = token ? await getSessionUser(token) : null;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { channel } = req.body;
  if (!channel) return res.status(400).json({ error: "channel wajib diisi" });

  const joined = addClientChannel(userId, channel);
  res.json({ ok: true, channel, joined });
});

// POST /api/sse/broadcast — kirim broadcast event (mis. lokasi kurir)
router.post("/broadcast", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const userId = token ? await getSessionUser(token) : null;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { channel, event, payload } = req.body;
  if (!channel || !event) {
    return res.status(400).json({ error: "channel dan event wajib diisi" });
  }

  broadcastChannelEvent({ type: "broadcast", channel, event, payload });
  res.json({ ok: true });
});

export default router;
