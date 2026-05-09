/**
 * Notification helper — buat notif di DB + push via SSE ke user yang bersangkutan.
 * Dipakai oleh db-proxy.ts dan endpoint lain untuk trigger notif otomatis.
 */
import { pool } from "../db";
import { broadcastDbEvent } from "../sse-manager";

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  link?: string
): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO public.notifications (user_id, title, message, type, link, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, now()) RETURNING *`,
      [userId, title, message, type, link || null]
    );
    const notif = result.rows[0];
    if (notif) {
      broadcastDbEvent({
        type: "postgres_changes",
        table: "notifications",
        event: "INSERT",
        record: notif,
        schema: "public",
      });
    }
  } catch (err) {
    console.error("[notify] Gagal membuat notifikasi:", err);
  } finally {
    client.release();
  }
}

const STATUS_NOTIF_MAP: Record<string, { title: string; msg: (no: string) => string }> = {
  CONFIRMED:       { title: "Pesanan Dikonfirmasi ✅",       msg: (n) => `Pesanan #${n} telah dikonfirmasi oleh penjual.` },
  ASSIGNED:        { title: "Kurir Menuju Toko 🚴",           msg: (n) => `Pesanan #${n} sedang dijemput kurir.` },
  PICKED_UP:       { title: "Dalam Perjalanan 📦",            msg: (n) => `Pesanan #${n} sedang diantarkan ke alamat Anda.` },
  SENT:            { title: "Dalam Perjalanan 📦",            msg: (n) => `Pesanan #${n} sedang diantarkan ke alamat Anda.` },
  DELIVERING:      { title: "Dalam Perjalanan 📦",            msg: (n) => `Pesanan #${n} sedang diantarkan ke alamat Anda.` },
  DELIVERED:       { title: "Pesanan Tiba! 🎉",               msg: (n) => `Pesanan #${n} sudah sampai! Konfirmasi penerimaan ya.` },
  DONE:            { title: "Pesanan Selesai 🙏",             msg: (n) => `Pesanan #${n} selesai. Terima kasih berbelanja di DesaMart!` },
  CANCELLED:       { title: "Pesanan Dibatalkan ❌",          msg: (n) => `Pesanan #${n} telah dibatalkan.` },
  PENDING_PAYMENT: { title: "Menunggu Pembayaran ⏳",         msg: (n) => `Pesanan #${n} menunggu pembayaran.` },
};

export async function notifyOrderStatusChange(
  order: Record<string, any>
): Promise<void> {
  const orderNo = String(order.id || "").slice(0, 8).toUpperCase();
  const notifDef = STATUS_NOTIF_MAP[order.status];
  if (notifDef && order.buyer_id) {
    await createNotification(
      order.buyer_id,
      notifDef.title,
      notifDef.msg(orderNo),
      "order",
      `/orders/${order.id}`
    );
  }
}

export async function notifyNewOrder(order: Record<string, any>): Promise<void> {
  if (!order.merchant_id) return;
  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT user_id FROM public.merchants WHERE id=$1",
      [order.merchant_id]
    );
    const merchantUserId = res.rows[0]?.user_id;
    if (merchantUserId) {
      await createNotification(
        merchantUserId,
        "Pesanan Baru! 🛍️",
        `Ada pesanan baru #${String(order.id).slice(0, 8).toUpperCase()} masuk. Segera konfirmasi!`,
        "order",
        "/merchant/orders"
      );
    }
  } finally {
    client.release();
  }
}

export async function notifyNewMerchantToAdminDesa(
  merchant: Record<string, any>
): Promise<void> {
  if (!merchant.village_id) return;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT uv.user_id FROM public.user_villages uv
       JOIN public.profiles p ON p.id = uv.user_id
       WHERE uv.village_id = $1 AND p.role = 'admin_desa'`,
      [merchant.village_id]
    );
    for (const row of res.rows) {
      await createNotification(
        row.user_id,
        "Merchant Baru Mendaftar 🏪",
        `${merchant.name || "Merchant baru"} telah mendaftar di wilayah desa Anda. Segera verifikasi!`,
        "merchant",
        "/desa/merchants"
      );
    }
  } catch (err) {
    console.error("[notify] notifyNewMerchantToAdminDesa:", err);
  } finally {
    client.release();
  }
}

export async function notifyMerchantVerificationResult(
  merchantUserId: string,
  merchantName: string,
  approved: boolean,
  notes?: string
): Promise<void> {
  const title = approved ? "Merchant Disetujui ✅" : "Merchant Ditolak ❌";
  const message = approved
    ? `Selamat! Toko "${merchantName}" Anda telah disetujui oleh admin desa dan bisa mulai berjualan.`
    : `Pendaftaran toko "${merchantName}" ditolak oleh admin desa.${notes ? " Catatan: " + notes : ""}`;
  await createNotification(merchantUserId, title, message, "merchant", "/merchant/settings");
}
