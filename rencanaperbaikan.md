# DesaMart — Rencana Perbaikan (Sumber Kebenaran Tunggal)

> Terakhir diperbarui: Mei 2026 — status diverifikasi dari kode aktual

---

## STATUS KESELURUHAN

Platform sangat lengkap secara fitur. Semua P1 & sebagian besar P2/P3 sudah selesai. Sisa pekerjaan: 1 item P2 dan lanjutan P3-01.

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

### P4-01: Mode Offline POS (PWA + IndexedDB)
IndexedDB untuk cache produk & transaksi saat offline. Sync otomatis saat koneksi kembali.

### P4-02: Printer Thermal ESC/POS
Integrasi Web Serial API untuk printer thermal. Fallback ke `window.print()`.

### P4-03: WhatsApp Notifikasi Otomatis
Halaman `/admin/whatsapp` sudah ada. Perlu verifikasi API WhatsApp Business aktual.

### P4-04: Webhook & API Publik POS
REST API + webhook untuk integrasi third-party. Fondasi API key management sudah ada.

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
| **P2-05** | **Push notification backend** | **❌ Belum** |
| P3-01 | React Query migration | ⚠️ Sebagian (3/150+ halaman) |
| P3-02 | QueryClient config | ✅ Selesai |
| P3-03 | FK_MAP POS | ✅ Selesai |
| P3-04 | merchant_operating_hours | ℹ️ Informasi saja |
| P4-xx | Fitur baru | 🔜 Belum dimulai |
