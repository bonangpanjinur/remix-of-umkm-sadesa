/**
 * SSE Manager — manages Server-Sent Events connections and broadcasting.
 * Replaces Supabase Realtime for all real-time features.
 */
import type { Response } from "express";

interface SSEClient {
  userId: string;
  res: Response;
  channels: Set<string>; // channel names this client subscribes to
}

// userId → list of SSE clients (user can have multiple tabs open)
const clients = new Map<string, SSEClient[]>();

// channelName → list of SSE clients
const channelClients = new Map<string, SSEClient[]>();

// All clients list for broadcast to everyone
const allClients: SSEClient[] = [];

/** Register a new SSE client */
export function addSSEClient(userId: string, res: Response): SSEClient {
  const client: SSEClient = { userId, res, channels: new Set() };

  // Add to userId map
  const byUser = clients.get(userId) || [];
  byUser.push(client);
  clients.set(userId, byUser);

  // Add to allClients
  allClients.push(client);

  return client;
}

/** Remove a disconnected SSE client */
export function removeSSEClient(client: SSEClient) {
  // Remove from userId map
  const byUser = clients.get(client.userId) || [];
  const filtered = byUser.filter((c) => c !== client);
  if (filtered.length === 0) clients.delete(client.userId);
  else clients.set(client.userId, filtered);

  // Remove from channel maps
  for (const ch of client.channels) {
    const byCh = channelClients.get(ch) || [];
    const filteredCh = byCh.filter((c) => c !== client);
    if (filteredCh.length === 0) channelClients.delete(ch);
    else channelClients.set(ch, filteredCh);
  }

  // Remove from allClients
  const idx = allClients.indexOf(client);
  if (idx !== -1) allClients.splice(idx, 1);
}

/** Subscribe a client to a channel name */
export function subscribeClientToChannel(client: SSEClient, channelName: string) {
  client.channels.add(channelName);
  const byCh = channelClients.get(channelName) || [];
  if (!byCh.includes(client)) byCh.push(client);
  channelClients.set(channelName, byCh);
}

/** Send SSE event to a specific user */
export function sendToUser(userId: string, event: object) {
  const byUser = clients.get(userId) || [];
  const data = JSON.stringify(event);
  for (const client of byUser) {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch (_) {
      // Client disconnected — will be cleaned up by close handler
    }
  }
}

/** Send SSE event to all clients subscribed to a channel */
export function sendToChannel(channelName: string, event: object) {
  const byCh = channelClients.get(channelName) || [];
  const data = JSON.stringify(event);
  for (const client of byCh) {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch (_) {}
  }
}

/** Broadcast a postgres_changes event to relevant users.
 *
 * Strategy: send to ALL connected clients — the client-side shim will
 * filter by table + event + filter to decide which callbacks to invoke.
 * This avoids complex server-side filter parsing.
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
  for (const client of allClients) {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch (_) {}
  }
}

/** Broadcast a peer-to-peer broadcast event on a named channel */
export function broadcastChannelEvent(payload: {
  type: "broadcast";
  channel: string;
  event: string;
  payload: unknown;
}) {
  sendToChannel(payload.channel, payload);
  const data = JSON.stringify(payload);
  // Also send to all clients on that channel (already done above via sendToChannel)
  void data;
}

export function getClientCount(): number {
  return allClients.length;
}
