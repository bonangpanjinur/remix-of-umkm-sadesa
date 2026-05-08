/**
 * SSE Manager — kelola koneksi Server-Sent Events dan broadcasting.
 * Menggantikan Supabase Realtime untuk semua fitur real-time.
 *
 * S3: DB events untuk tabel sensitif hanya dikirim ke user yang bersangkutan,
 *     bukan broadcast ke semua client.
 */
import type { Response } from "express";

interface SSEClient {
  userId: string;
  res: Response;
  channels: Set<string>;
}

// userId → daftar SSE client (user bisa buka banyak tab)
const clients = new Map<string, SSEClient[]>();

// channelName → daftar SSE client
const channelClients = new Map<string, SSEClient[]>();

// Semua client (untuk broadcast publik)
const allClients: SSEClient[] = [];

// ─── S3: Tabel yang event-nya hanya dikirim ke user tertentu ─────────────────
/**
 * Mapping tabel → nama kolom yang berisi user_id pemilik data.
 * Event untuk tabel ini hanya dikirim ke user yang bersangkutan.
 */
const USER_SCOPED_TABLES: Record<string, string> = {
  notifications:                "user_id",
  withdrawal_requests:          "user_id",
  courier_withdrawal_requests:  "user_id",
  verifikator_withdrawals:      "user_id",
  push_subscriptions:           "user_id",
  saved_addresses:              "user_id",
  referral_usages:              "user_id",
};

/**
 * Tabel yang event-nya dikirim ke buyer (bukan user_id biasa).
 */
const BUYER_SCOPED_TABLES: Record<string, string> = {
  orders: "buyer_id",
};

// ─── Client registry ──────────────────────────────────────────────────────────

/** Tambahkan SSE client baru */
export function addSSEClient(userId: string, res: Response): SSEClient {
  const client: SSEClient = { userId, res, channels: new Set() };

  const byUser = clients.get(userId) || [];
  byUser.push(client);
  clients.set(userId, byUser);

  allClients.push(client);
  return client;
}

/** Hapus SSE client yang sudah disconnect */
export function removeSSEClient(client: SSEClient) {
  const byUser = clients.get(client.userId) || [];
  const filtered = byUser.filter((c) => c !== client);
  if (filtered.length === 0) clients.delete(client.userId);
  else clients.set(client.userId, filtered);

  for (const ch of client.channels) {
    const byCh = channelClients.get(ch) || [];
    const filteredCh = byCh.filter((c) => c !== client);
    if (filteredCh.length === 0) channelClients.delete(ch);
    else channelClients.set(ch, filteredCh);
  }

  const idx = allClients.indexOf(client);
  if (idx !== -1) allClients.splice(idx, 1);
}

/** Subscribe client ke channel tertentu */
export function subscribeClientToChannel(client: SSEClient, channelName: string) {
  client.channels.add(channelName);
  const byCh = channelClients.get(channelName) || [];
  if (!byCh.includes(client)) byCh.push(client);
  channelClients.set(channelName, byCh);
}

// ─── Event delivery ───────────────────────────────────────────────────────────

/** Kirim SSE event ke user tertentu saja */
export function sendToUser(userId: string, event: object) {
  const byUser = clients.get(userId) || [];
  const data = JSON.stringify(event);
  for (const client of byUser) {
    try { client.res.write(`data: ${data}\n\n`); } catch (_) {}
  }
}

/** Kirim SSE event ke semua client yang subscribe ke channel tertentu */
export function sendToChannel(channelName: string, event: object) {
  const byCh = channelClients.get(channelName) || [];
  const data = JSON.stringify(event);
  for (const client of byCh) {
    try { client.res.write(`data: ${data}\n\n`); } catch (_) {}
  }
}

/**
 * Broadcast DB event ke client yang relevan.
 *
 * S3: Strategi routing:
 * 1. Tabel sensitif (USER_SCOPED_TABLES) → hanya kirim ke pemilik data
 * 2. Tabel buyer-scoped (BUYER_SCOPED_TABLES) → hanya kirim ke buyer
 * 3. Tabel lainnya → broadcast ke semua client yang terhubung
 *
 * Client-side shim akan memfilter lebih lanjut berdasarkan event type & filter.
 */
export function broadcastDbEvent(payload: {
  type: "postgres_changes";
  table: string;
  event: "INSERT" | "UPDATE" | "DELETE";
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
  schema?: string;
}) {
  const data = JSON.stringify(payload);

  // Cek apakah tabel ini scoped ke user_id tertentu
  const userIdCol = USER_SCOPED_TABLES[payload.table];
  if (userIdCol) {
    const targetUserId = payload.record[userIdCol] as string | undefined;
    if (targetUserId) {
      // Kirim hanya ke user yang bersangkutan
      sendToUser(targetUserId, payload);
      return;
    }
  }

  // Cek apakah tabel ini scoped ke buyer_id
  const buyerIdCol = BUYER_SCOPED_TABLES[payload.table];
  if (buyerIdCol) {
    const targetBuyerId = payload.record[buyerIdCol] as string | undefined;
    if (targetBuyerId) {
      sendToUser(targetBuyerId, payload);
      return;
    }
  }

  // Default: broadcast ke semua client (produk, toko, dll.)
  for (const client of allClients) {
    try { client.res.write(`data: ${data}\n\n`); } catch (_) {}
  }
}

/** Broadcast peer-to-peer event di named channel */
export function broadcastChannelEvent(payload: {
  type: "broadcast";
  channel: string;
  event: string;
  payload: unknown;
}) {
  sendToChannel(payload.channel, payload);
}

export function getClientCount(): number {
  return allClients.length;
}
