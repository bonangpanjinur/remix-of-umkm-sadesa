/**
 * Push Notification Helper — kirim push otomatis saat status order berubah.
 * Dipanggil dari endpoint order status update.
 */
import webpush from "web-push";
import { pool } from "../db";

const ORDER_STATUS_LABELS: Record<string, { title: string; body: string }> = {
  PROCESSING:          { title: "Pesanan Diproses 🍳", body: "Merchant sedang menyiapkan pesananmu." },
  READY:               { title: "Pesanan Siap 📦", body: "Pesananmu sudah siap untuk dikirim." },
  ASSIGNED:            { title: "Kurir Ditugaskan 🚴", body: "Kurir sedang menuju toko untuk mengambil pesananmu." },
  PICKED_UP:           { title: "Pesanan Diambil 🛵", body: "Kurir sudah mengambil pesananmu dan sedang dalam perjalanan." },
  SENT:                { title: "Pesanan Dikirim 🚀", body: "Pesananmu sedang dalam perjalanan ke alamatmu." },
  DELIVERING:          { title: "Dalam Pengiriman 📍", body: "Pesananmu hampir sampai!" },
  DONE:                { title: "Pesanan Selesai ✅", body: "Pesananmu telah tiba. Terima kasih sudah berbelanja!" },
  COMPLETED:           { title: "Pesanan Selesai ✅", body: "Pesananmu telah tiba. Terima kasih sudah berbelanja!" },
  CANCELLED:           { title: "Pesanan Dibatalkan ❌", body: "Pesananmu telah dibatalkan." },
  REJECTED:            { title: "Pesanan Ditolak ⚠️", body: "Maaf, merchant tidak dapat memproses pesananmu." },
  PENDING_PAYMENT:     { title: "Menunggu Pembayaran 💳", body: "Silakan selesaikan pembayaran pesananmu." },
  PAYMENT_VERIFIED:    { title: "Pembayaran Dikonfirmasi ✅", body: "Pembayaranmu telah dikonfirmasi. Pesanan sedang diproses." },
};

/**
 * Kirim push notification ke pembeli saat status order berubah.
 * @param orderId  - ID order yang diperbarui
 * @param newStatus - Status baru order
 * @param orderId  - Opsional URL yang dibuka saat push diklik
 */
export async function sendOrderStatusPush(
  orderId: string,
  newStatus: string,
  url = "/orders"
): Promise<void> {
  const label = ORDER_STATUS_LABELS[newStatus];
  if (!label) return; // status tidak perlu notifikasi

  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
  const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@desamart.id";

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return; // push belum dikonfigurasi

  try {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch {
    return;
  }

  const client = await pool.connect();
  try {
    // Dapatkan buyer_id dari order
    const orderRes = await client.query<{ buyer_id: string }>(
      `SELECT buyer_id FROM public.orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );
    if (!orderRes.rows.length || !orderRes.rows[0].buyer_id) return;

    const buyerId = orderRes.rows[0].buyer_id;

    // Ambil semua push subscription milik buyer ini
    const subsRes = await client.query<{
      endpoint: string;
      p256dh: string;
      auth: string;
    }>(
      `SELECT endpoint, p256dh, auth FROM public.push_subscriptions WHERE user_id = $1`,
      [buyerId]
    );

    if (!subsRes.rows.length) return;

    const payload = JSON.stringify({
      title: label.title,
      body: label.body,
      url: `/orders`,
      badge: "/logo192.png",
      icon: "/logo192.png",
    });

    const results = await Promise.allSettled(
      subsRes.rows.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
      )
    );

    // Hapus subscription yang sudah tidak valid (410 Gone)
    const toDelete: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const err = r.reason as { statusCode?: number };
        if (err?.statusCode === 410) toDelete.push(subsRes.rows[i].endpoint);
      }
    });

    if (toDelete.length > 0) {
      await client.query(
        `DELETE FROM public.push_subscriptions WHERE endpoint = ANY($1)`,
        [toDelete]
      );
    }
  } catch (err) {
    console.error("[pushHelper] sendOrderStatusPush error:", err);
  } finally {
    client.release();
  }
}
