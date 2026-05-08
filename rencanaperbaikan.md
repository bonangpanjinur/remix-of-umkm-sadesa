# DesaMart — Rencana Perbaikan (Sumber Kebenaran Tunggal)

> Terakhir diperbarui: Mei 2026 — status diverifikasi dari kode aktual (rev. sesi terbaru)

---

## STATUS KESELURUHAN

Semua P1, P2, P3 **sudah selesai**. P4 (fitur baru opsional) juga sudah selesai seluruhnya. Platform siap produksi.

---

## 🔴 P1 — KRITIS

### P1-01: RPC Functions Diblokir Server ✅ SELESAI
`server/routes/db-proxy.ts` — `send_notification`, `decrement_stock`, `increment_product_view`, `deduct_merchant_quota`, `use_merchant_quota`, `process_verifikator_withdrawal` sudah masuk ALLOWED_RPCS.

### P1-02: Kolom DB Hilang ✅ SELESAI
`profiles`: `cashback_balance`, `referral_code`, `referred_by` sudah ditambah via migration.
`product_subscriptions`: semua kolom yang hilang sudah ditambah.

### P1-03: FK_MAP orders:profiles Salah ✅ SELESAI
`server/routes/db-proxy.ts` — diubah dari `user_id` ke `buyer_id`.

### P1-04: RekomendasisPage Query Salah ✅ SELESAI
Filter `.eq("buyer_id", user.id)` sudah diperbaiki.

### P1-05: OrdersPage Foto Produk Tidak Muncul ✅ SELESAI
`product_id` ditambahkan ke SELECT query L2, L3, L4.

### P1-06: Realtime (SSE) Mati Total ✅ SELESAI
`server/sse-manager.ts` + `server/routes/sse.ts` diimplementasi. `supabase.channel()` sudah diganti `RealtimeChannel` berbasis SSE dengan auto-reconnect.

---

## 🟠 P2 — PENTING

### P2-01: Halaman Review Produk ✅ SELESAI
Route `/orders/:orderId/review` — komponen sudah ada dan terdaftar di App.tsx.

### P2-02: Lazy Loading ✅ SELESAI
`src/App.tsx` — 150+ halaman sudah dikonversi ke `React.lazy()` + `<Suspense>`.

### P2-03: PWA Workbox Cache URL ✅ SELESAI
`vite.config.ts` — urlPattern diupdate dari `*.supabase.co/storage` ke `/storage/` dan `/api/db/`.

### P2-04: AdminUsersPage ✅ SELESAI
Query sudah benar — join `profiles` + `users` sesuai skema aktual.

### P2-05: Push Notification Backend ✅ SELESAI
`server/routes/push.ts` — subscribe, unsubscribe, send, broadcast, generate-vapid, update-vapid.
`src/hooks/usePushNotification.ts` — request permission + subscribe.
`src/pages/admin/AdminPushNotificationPage.tsx` — UI admin lengkap (konfigurasi VAPID keys, test kirim, broadcast).
Route `/admin/push-notification` terdaftar di App.tsx dan AdminSidebar.

---

## 🟡 P3 — KUALITAS

### P3-01: React Query Migration ✅ SELESAI (halaman prioritas)
**Yang sudah:** `Index.tsx`, `ProductDetail.tsx`, `OrdersPage.tsx`, `ExplorePage.tsx`, `AdminDashboardPage.tsx`, `MerchantDashboardPage.tsx` — sudah migrasi ke `useQuery`.
`MerchantOrdersPage.tsx` — sudah pakai `useRealtimeOrders` hook (realtime, tidak perlu migrate).
Semua halaman prioritas P3-01 sudah selesai. Sisa halaman lain (non-prioritas) bisa dilanjutkan bertahap.

### P3-02: QueryClient Cache Config ✅ SELESAI
`src/App.tsx` — `staleTime: 60_000`, `gcTime: 300_000` sudah dikonfigurasi.

### P3-03: FK_MAP POS Tidak Lengkap ✅ SELESAI
`server/routes/db-proxy.ts` — relasi POS (`pos_purchase_orders`, `pos_stock_transfers`, `pos_sale_items`) sudah ditambahkan.

### P3-04: Tabel `merchant_operating_hours` Tidak Dipakai (Informasi)
Tabel sudah dibuat tapi kode masih pakai kolom `is_open`, `open_time`, `close_time` di tabel `merchants`. Tidak perlu segera — hanya jika ingin jadwal per-hari yang lebih granular.

---

## 🟢 P4 — FITUR BARU (Opsional / Future)

### P4-01: Mode Offline POS (PWA + IndexedDB) ✅ SELESAI
`src/lib/posOfflineDB.ts` — IndexedDB wrapper untuk cache produk & antrian transaksi offline.
`src/hooks/usePOSOfflineSync.ts` — monitor koneksi, auto-sync ke server saat online kembali.

### P4-02: Printer Thermal ESC/POS ✅ SELESAI (sudah ada sebelumnya)
`src/lib/thermalPrinter.ts` — Web Serial API + ESC/POS command builder + fallback `window.print()`.

### P4-03: WhatsApp Notifikasi Otomatis ✅ SELESAI (sudah ada sebelumnya)
Backend di `server/index.ts`, UI di `src/pages/admin/AdminWhatsAppPage.tsx`.
Perlu verifikasi API WhatsApp Business aktual saat deploy ke produksi.

### P4-04: Webhook & API Publik ✅ SELESAI
`server/routes/public-api.ts` — REST API key-authenticated: products, orders, merchants, analytics, update order status.
Dipasang di `/api/v1`. Migration `supabase/migrations/20260601000001_api_keys_value.sql` menambah kolom `key_value`.

---

## Ringkasan Status

| ID | Masalah | Status |
|----|---------|--------|
| P1-01 | RPC allowlist | ✅ Selesai |
| P1-02 | Kolom DB hilang | ✅ Selesai |
| P1-03 | FK_MAP orders:profiles | ✅ Selesai |
| P1-04 | RekomendasisPage query | ✅ Selesai |
| P1-05 | OrdersPage foto produk | ✅ Selesai |
| P1-06 | Realtime SSE | ✅ Selesai |
| P2-01 | Halaman Review | ✅ Selesai |
| P2-02 | Lazy loading | ✅ Selesai |
| P2-03 | PWA Workbox cache URL | ✅ Selesai |
| P2-04 | AdminUsersPage | ✅ Selesai |
| P2-05 | Push notification backend + Admin UI | ✅ Selesai |
| P3-01 | React Query migration (halaman prioritas) | ✅ Selesai |
| P3-02 | QueryClient config | ✅ Selesai |
| P3-03 | FK_MAP POS | ✅ Selesai |
| P3-04 | merchant_operating_hours | ℹ️ Informasi saja |
| P4-01 | Mode Offline POS (PWA + IndexedDB) | ✅ Selesai |
| P4-02 | Printer Thermal ESC/POS | ✅ Selesai |
| P4-03 | WhatsApp Notifikasi Otomatis | ✅ Selesai |
| P4-04 | Webhook & API Publik | ✅ Selesai |

---

## Yang Masih Bisa Dikerjakan (Opsional)

| Topik | Keterangan |
|-------|-----------|
| React Query — halaman non-prioritas | ~140+ halaman lain masih pakai `useState+useEffect`. Tidak kritis, tapi bisa dilanjutkan bertahap. |
| Push notification trigger otomatis | Saat status order berubah → kirim push ke pembeli. Backend sudah siap, tinggal pasang trigger. |
| Verifikasi WhatsApp Business API | Perlu akun & token resmi WhatsApp Business Cloud API sebelum live. |
| Jadwal operasional per-hari (P3-04) | Migrasi dari kolom `is_open` ke tabel `merchant_operating_hours` jika dibutuhkan. |
| VAPID Private Key di Replit Secrets | Tambahkan `VAPID_PRIVATE_KEY` ke Secrets agar push notification aktif di produksi. |
