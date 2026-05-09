/**
 * QR Pay — Pembeli bayar di kasir POS via scan QR dari app DesaMart
 * Sesi disimpan in-memory dengan TTL 5 menit
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { getSessionUser } from "../auth";
import { sendToUser, sendToChannel, addClientChannel } from "../sse-manager";

const router = Router();

// ─── In-memory session store ──────────────────────────────────────────────────

interface QRPaySession {
  id: string;
  token: string;
  tenantId: string;
  outletId: string;
  cashierId: string;
  cashierName: string;
  storeName: string;
  amount: number;
  description: string;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  buyerId?: string;
  buyerName?: string;
  confirmedAt?: Date;
  createdAt: Date;
  expiresAt: Date;
}

const sessions = new Map<string, QRPaySession>();

// Bersihkan session expired setiap 2 menit
setInterval(() => {
  const now = new Date();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now && session.status === "pending") {
      session.status = "expired";
      // Beritahu kasir bahwa sesi expired
      sendToChannel(`qrpay:${id}`, {
        type: "broadcast",
        channel: `qrpay:${id}`,
        event: "qrpay_expired",
        payload: { sessionId: id },
      });
    }
    // Hapus session lebih dari 30 menit
    if (now.getTime() - session.createdAt.getTime() > 30 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 2 * 60 * 1000);

// ─── POST /api/qrpay/create — Kasir buat sesi QR Pay ─────────────────────────

router.post("/create", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const cashierId = token ? await getSessionUser(token) : null;
  if (!cashierId) return res.status(401).json({ error: "Unauthorized" });

  const { tenantId, outletId, cashierName, storeName, amount, description } = req.body as {
    tenantId: string;
    outletId: string;
    cashierName?: string;
    storeName?: string;
    amount: number;
    description?: string;
  };

  if (!tenantId || !outletId || !amount || amount <= 0) {
    return res.status(400).json({ error: "tenantId, outletId, dan amount wajib diisi" });
  }

  const sessionId = randomUUID();
  const sessionToken = randomUUID().replace(/-/g, "");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 menit

  const session: QRPaySession = {
    id: sessionId,
    token: sessionToken,
    tenantId,
    outletId,
    cashierId,
    cashierName: cashierName || "Kasir",
    storeName: storeName || "Toko",
    amount,
    description: description || `Pembayaran di ${storeName || "Toko"}`,
    status: "pending",
    createdAt: now,
    expiresAt,
  };

  sessions.set(sessionId, session);

  // Subscribe kasir ke channel SSE untuk sesi ini
  addClientChannel(cashierId, `qrpay:${sessionId}`);

  return res.json({
    sessionId,
    sessionToken,
    expiresAt: expiresAt.toISOString(),
    qrUrl: `/qrpay/${sessionToken}`,
    amount,
    storeName: session.storeName,
  });
});

// ─── GET /api/qrpay/info/:token — Buyer ambil info sesi (public) ──────────────

router.get("/info/:token", (req, res) => {
  const { token } = req.params;
  const session = [...sessions.values()].find(s => s.token === token);

  if (!session) {
    return res.status(404).json({ error: "QR Pay tidak ditemukan atau sudah kedaluwarsa" });
  }

  const now = new Date();
  if (session.expiresAt < now && session.status === "pending") {
    session.status = "expired";
  }

  if (session.status !== "pending") {
    return res.status(410).json({
      error: session.status === "confirmed"
        ? "Pembayaran sudah dikonfirmasi"
        : session.status === "expired"
        ? "QR Pay sudah kedaluwarsa. Minta kasir buat QR baru."
        : "QR Pay dibatalkan",
      status: session.status,
    });
  }

  const secondsLeft = Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000));

  return res.json({
    sessionId: session.id,
    storeName: session.storeName,
    cashierName: session.cashierName,
    amount: session.amount,
    description: session.description,
    expiresAt: session.expiresAt.toISOString(),
    secondsLeft,
  });
});

// ─── POST /api/qrpay/confirm — Buyer konfirmasi bayar ────────────────────────

router.post("/confirm", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const buyerId = token ? await getSessionUser(token) : null;
  if (!buyerId) return res.status(401).json({ error: "Login dulu untuk membayar" });

  const { sessionToken, buyerName } = req.body as {
    sessionToken: string;
    buyerName?: string;
  };

  if (!sessionToken) return res.status(400).json({ error: "sessionToken wajib diisi" });

  const session = [...sessions.values()].find(s => s.token === sessionToken);
  if (!session) return res.status(404).json({ error: "Sesi QR Pay tidak ditemukan" });

  const now = new Date();
  if (session.expiresAt < now) {
    session.status = "expired";
    return res.status(410).json({ error: "QR Pay sudah kedaluwarsa. Minta kasir buat QR baru." });
  }

  if (session.status !== "pending") {
    return res.status(409).json({
      error: session.status === "confirmed" ? "Pembayaran sudah dikonfirmasi" : "QR Pay sudah dibatalkan",
    });
  }

  // Konfirmasi!
  session.status = "confirmed";
  session.buyerId = buyerId;
  session.buyerName = buyerName || "Pembeli";
  session.confirmedAt = now;

  // Beritahu kasir via SSE
  sendToChannel(`qrpay:${session.id}`, {
    type: "broadcast",
    channel: `qrpay:${session.id}`,
    event: "qrpay_confirmed",
    payload: {
      sessionId: session.id,
      buyerId,
      buyerName: session.buyerName,
      amount: session.amount,
      confirmedAt: now.toISOString(),
    },
  });

  // Notifikasi ke buyer juga
  sendToUser(buyerId, {
    type: "postgres_changes",
    table: "notifications",
    event: "INSERT",
    record: {
      user_id: buyerId,
      title: "Pembayaran QR Berhasil!",
      message: `Rp ${session.amount.toLocaleString("id-ID")} di ${session.storeName} berhasil dibayar.`,
      type: "payment",
      link: "/orders",
    },
  });

  return res.json({
    success: true,
    message: "Pembayaran dikonfirmasi! Tunjukkan layar ini ke kasir.",
    sessionId: session.id,
    amount: session.amount,
    storeName: session.storeName,
    confirmedAt: now.toISOString(),
  });
});

// ─── DELETE /api/qrpay/cancel/:sessionId — Kasir batalkan sesi ───────────────

router.delete("/cancel/:sessionId", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const userId = token ? await getSessionUser(token) : null;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: "Sesi tidak ditemukan" });
  if (session.cashierId !== userId) return res.status(403).json({ error: "Bukan sesi Anda" });

  session.status = "cancelled";
  sendToChannel(`qrpay:${sessionId}`, {
    type: "broadcast",
    channel: `qrpay:${sessionId}`,
    event: "qrpay_cancelled",
    payload: { sessionId },
  });

  return res.json({ success: true });
});

// ─── GET /api/qrpay/status/:sessionId — Poll status ─────────────────────────

router.get("/status/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: "Sesi tidak ditemukan" });

  const now = new Date();
  if (session.expiresAt < now && session.status === "pending") session.status = "expired";

  return res.json({
    status: session.status,
    buyerName: session.buyerName,
    confirmedAt: session.confirmedAt?.toISOString(),
    secondsLeft: Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000)),
  });
});

export default router;
