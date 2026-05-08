# DesaMart — Rencana Perbaikan (Sumber Kebenaran Tunggal)

> Terakhir diperbarui: Juni 2026 — status diverifikasi dari kode aktual (rev. sesi terbaru: P3-04 ✅, React Query migration semua halaman utama ✅, Push auto-trigger ✅)

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

### P2-05: Push Notification Backend ✅ SELESAI + Auto-trigger ✅ SELESAI
`server/routes/push.ts` — subscribe, unsubscribe, send, broadcast, generate-vapid, update-vapid.
`server/routes/push.ts` endpoint baru: `POST /api/push/order-status` — auto-kirim push ke pembeli saat status order berubah.
`server/lib/pushHelper.ts` — `sendOrderStatusPush(orderId, newStatus)` dengan pesan yang disesuaikan per status.
`src/hooks/useRealtimeOrders.ts` — setelah `updateOrderStatus` berhasil, call `/api/push/order-status` secara fire-and-forget.
`src/hooks/usePushNotification.ts` — request permission + subscribe.
`src/pages/admin/AdminPushNotificationPage.tsx` — UI admin lengkap (konfigurasi VAPID keys, test kirim, broadcast).
Route `/admin/push-notification` terdaftar di App.tsx dan AdminSidebar.

---

## 🟡 P3 — KUALITAS

### P3-01: React Query Migration ✅ SELESAI (semua halaman utama)
**Halaman publik:** `Index.tsx`, `ProductDetail.tsx`, `OrdersPage.tsx`, `ExplorePage.tsx`, `TourismPage.tsx`, `ProductsPage.tsx`, `ShopsPage.tsx`, `NotificationsPage.tsx`, `SearchResultsPage.tsx`.
**Halaman admin:** `AdminDashboardPage.tsx`, `AdminMerchantsPage.tsx`, `AdminVillagesPage.tsx`, `AdminCouriersPage.tsx`, `AdminOrdersPage.tsx`, `AdminFinancePage.tsx`.
**Halaman merchant:** `MerchantDashboardPage.tsx`.
**Halaman kurir:** `CourierDashboardPage.tsx`.
Semua halaman realtime (NotificationsPage, AdminOrdersPage, CourierDashboardPage) menjaga subscription Supabase channel tapi mengganti fetchX() dengan queryClient.invalidateQueries().

### P3-02: QueryClient Cache Config ✅ SELESAI
`src/App.tsx` — `staleTime: 60_000`, `gcTime: 300_000` sudah dikonfigurasi.

### P3-03: FK_MAP POS Tidak Lengkap ✅ SELESAI
`server/routes/db-proxy.ts` — relasi POS (`pos_purchase_orders`, `pos_stock_transfers`, `pos_sale_items`) sudah ditambahkan.

### P3-04: Tabel `merchant_operating_hours` per-hari ✅ SELESAI
Migration `supabase/migrations/20260602000000_merchant_operating_hours.sql` — tabel baru dengan RLS policies.
`src/components/merchant/MerchantOperatingHoursCard.tsx` — UI per-hari (toggle buka/tutup + time picker), pakai React Query + useMutation.
Diintegrasikan ke tab "Lainnya" di `MerchantDashboardPage.tsx`. Helper `isCurrentlyOpen()` diekspor untuk dipakai komponen lain.

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
| P3-04 | merchant_operating_hours per-hari | ✅ Selesai |
| P4-01 | Mode Offline POS (PWA + IndexedDB) | ✅ Selesai |
| P4-02 | Printer Thermal ESC/POS | ✅ Selesai |
| P4-03 | WhatsApp Notifikasi Otomatis | ✅ Selesai |
| P4-04 | Webhook & API Publik | ✅ Selesai |

---

## Yang Masih Bisa Dikerjakan (Opsional)

| Topik | Keterangan |
|-------|-----------|
| React Query — halaman non-prioritas | Halaman POS, merchant sub-pages, verifikator, dll. Tidak kritis, bisa dilanjutkan bertahap. |
| Verifikasi WhatsApp Business API | Perlu akun & token resmi WhatsApp Business Cloud API sebelum live. |
| VAPID Private Key di Replit Secrets | Tambahkan `VAPID_PRIVATE_KEY` ke Secrets agar push notification aktif di produksi. |
| isCurrentlyOpen() dari jadwal | `MerchantOperatingHoursCard` mengekspor helper `isCurrentlyOpen()` yang bisa dipakai di `ShopsPage.tsx` untuk menampilkan status buka/tutup lebih akurat dibanding kolom `is_open`. |
