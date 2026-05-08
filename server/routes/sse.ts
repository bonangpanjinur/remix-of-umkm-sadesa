/**
 * Server-Sent Events (SSE) endpoint
 * Replaces Supabase Realtime channels for all real-time features.
 *
 * GET  /api/sse          — connect and receive events
 * POST /api/sse/broadcast — send broadcast event (peer-to-peer, e.g. courier location)
 * POST /api/sse/subscribe — subscribe client to a named channel
 */
import { Router, Request, Response } from "express";
import {
  addSSEClient,
  removeSSEClient,
  subscribeClientToChannel,
  broadcastChannelEvent,
  getClientCount,
} from "../sse-manager";
import { getSessionUser } from "../auth";

const router = Router();

// GET /api/sse — establish SSE stream
router.get("/", (req: Request, res: Response) => {
  // Auth: token from Authorization header or query param
  const authHeader = req.headers.authorization || "";
  const token =
    authHeader.replace("Bearer ", "") ||
    (req.query.token as string) ||
    "";

  const userId = token ? getSessionUser(token) : null;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  const client = addSSEClient(userId, res);

  // Send connected event
  res.write(`data: ${JSON.stringify({ type: "connected", userId, clients: getClientCount() })}\n\n`);

  // Heartbeat every 25s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (_) {
      clearInterval(heartbeat);
    }
  }, 25000);

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    removeSSEClient(client);
  });

  req.on("error", () => {
    clearInterval(heartbeat);
    removeSSEClient(client);
  });
});

// POST /api/sse/subscribe — subscribe to a channel after connection
// This is called by the client when .channel(name).subscribe() is called
router.post("/subscribe", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const userId = token ? getSessionUser(token) : null;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // We don't track the specific SSEClient here; the channel subscription
  // is used for broadcast routing which is handled client-side via the
  // global event stream. Just acknowledge.
  const { channel } = req.body;
  res.json({ ok: true, channel });
});

// POST /api/sse/broadcast — send a broadcast event (e.g. courier location)
router.post("/broadcast", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const userId = token ? getSessionUser(token) : null;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { channel, event, payload } = req.body;
  if (!channel || !event) {
    return res.status(400).json({ error: "channel and event are required" });
  }

  broadcastChannelEvent({ type: "broadcast", channel, event, payload });
  res.json({ ok: true });
});

export default router;
