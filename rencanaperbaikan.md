# DesaMart — Rencana Perbaikan (Sumber Kebenaran Tunggal)

> Terakhir diperbarui: Mei 2026 — berdasarkan analisis kode aktual menyeluruh (150+ halaman, semua server routes, DB schema)

---

## STATUS KESELURUHAN

Platform sangat lengkap secara fitur. Masalah utama bukan fitur yang hilang, tapi **fitur yang ada tapi rusak** karena pindahan dari Supabase ke Replit PostgreSQL belum tuntas sepenuhnya.

---

## 🔴 P1 — KRITIS (Rusak Sekarang, Harus Segera Diperbaiki)

### P1-01: RPC Functions Diblokir Server ✅ SELESAI
**File:** `server/routes/db-proxy.ts`
**Dampak:** Stok tidak berkurang saat checkout, notifikasi tidak terkirim, quota POS tidak terpotong, withdrawal verifikator gagal

Fungsi-fungsi berikut ada di DB tapi tidak di `ALLOWED_RPCS`:
- `send_notification` — dipakai di checkout & useMerchantQuota
- `decrement_stock` — dipakai saat checkout → **stok tidak berkurang!**
- `increment_product_view` — ProductDetail → view count tidak naik
- `deduct_merchant_quota` — MerchantPOSPage, useMerchantQuota
- `use_merchant_quota` — quotaApi
- `process_verifikator_withdrawal` — AdminVerifikatorCommissionsPage

**Perbaikan:** Tambahkan 6 RPC ke ALLOWED_RPCS

---

### P1-02: Kolom DB Hilang — CashbackPage & ReferralPage Crash ✅ SELESAI
**Tabel:** `profiles`, `product_subscriptions`
**Dampak:** Halaman `/cashback`, `/referral`, `/subscription` crash saat dibuka

Kolom yang hilang di `profiles`:
- `cashback_balance` — dipakai CashbackPage
- `referral_code` — dipakai ReferralPage
- `referred_by` — dipakai ReferralPage

Kolom yang hilang di `product_subscriptions`:
- `interval_days`, `next_order_date`, `delivery_address`, `total_orders`, `quantity`, `merchant_id`, `notes`

**Perbaikan:** ALTER TABLE untuk menambah kolom yang hilang

---

### P1-03: FK_MAP Salah — Orders ↔ Profiles ✅ SELESAI
**File:** `server/routes/db-proxy.ts`
**Dampak:** Query yang join `orders` dengan `profiles` menghasilkan NULL

`orders:profiles` menggunakan `fk: "user_id"` padahal kolom di tabel `orders` adalah `buyer_id`

**Perbaikan:** Ganti `user_id` → `buyer_id` di FK_MAP

---

### P1-04: RekomendasisPage — Query Salah ✅ SELESAI
**File:** `src/pages/buyer/RekomendasisPage.tsx`
**Dampak:** Rekomendasi selalu kosong untuk semua user

Filter `.eq("orders.user_id", user.id)` — kolom yang benar adalah `buyer_id`, bukan `user_id`

**Perbaikan:** Ganti ke `.eq("buyer_id", user.id)` melalui join yang benar

---

### P1-05: OrdersPage — Foto & Nama Produk Tidak Muncul ✅ SELESAI
**File:** `src/pages/OrdersPage.tsx`
**Dampak:** Semua buyer tidak melihat gambar & nama produk di riwayat pesanan

Query L2, L3, L4 tidak menyertakan `product_id` → secondary fetch tidak jalan → gambar kosong

**Perbaikan:** Tambah `product_id` ke SELECT L2, L3, L4

---

### P1-06: Realtime (WebSocket) Mati Total ✅ SELESAI
**File:** `src/integrations/supabase/client.ts`
**Dampak:** Chat tidak live, notifikasi tidak muncul real-time, status pesanan tidak update otomatis, tracking kurir tidak bergerak, order baru ke merchant tidak bunyi

`supabase.channel()` hanya stub kosong — tidak ada koneksi WebSocket sama sekali.

20+ komponen bergantung: `OrderChat`, `NotificationDropdown`, `CourierLocationUpdater`, `CourierMap`, `useRealtimeOrders`, `useFlashSales`, dll.

**Solusi:** Implementasi Server-Sent Events (SSE) di Express server sebagai pengganti Supabase Realtime

**Implementasi:**
- `server/sse-manager.ts` — mengelola koneksi SSE per user, broadcast ke channel
- `server/routes/sse.ts` — endpoint `GET /api/sse` (stream), `POST /api/sse/broadcast` (relay lokasi kurir)
- `server/routes/db-proxy.ts` — setiap INSERT/UPDATE/DELETE memanggil `broadcastDbEvent()` ke semua client SSE
- `src/integrations/supabase/client.ts` — `channel()` diganti `RealtimeChannel` berbasis SSE nyata, filter `postgres_changes` dan `broadcast` bekerja otomatis, auto-reconnect 3 detik

---

## 🟠 P2 — PENTING (Perlu Diperbaiki Segera)

### P2-01: Halaman Review Produk Tidak Ada ✅ SELESAI
**File:** Belum ada `src/pages/ReviewPage.tsx`
**Dampak:** Tombol "Beri Rating" di OrdersPage (route `/orders/:orderId/review`) mengarah ke 404

Route sudah terdaftar di App.tsx tapi komponen halaman belum dibuat

---

### P2-02: Lazy Loading Belum Ada
**File:** `src/App.tsx`
**Dampak:** Bundle JS pertama sangat besar → loading awal lambat

821 baris App.tsx, 150+ halaman di-import semua sekaligus tanpa `React.lazy()`

**Perbaikan:** Konversi semua import halaman ke `React.lazy()` + `<Suspense>`

---

### P2-03: PWA Workbox Cache URL Salah
**File:** `vite.config.ts`
**Dampak:** Cache PWA tidak efektif — masih cache URL Supabase CDN yang sudah tidak dipakai

Runtime cache masih target `*.supabase.co/storage` padahal gambar sekarang di `/storage/*` server lokal

**Perbaikan:** Update `urlPattern` ke `/storage/`, `/api/db/` (NetworkFirst)

---

### P2-04: AdminUsersPage Fetch dari Tabel Salah
**File:** `src/pages/admin/AdminUsersPage.tsx`
**Dampak:** Halaman users admin kosong atau menampilkan data tidak lengkap

Fetch dari `profiles` padahal tabel utama auth sekarang adalah `public.users`. Perlu join atau pindah query ke `users`.

---

### P2-05: Push Notification Belum Aktif
**Dampak:** User tidak terima notifikasi push saat app ditutup

Ada tabel `push_subscriptions` dan file `notification.wav` di public, tapi service worker belum punya push event handler.

---

## 🟡 P3 — KUALITAS (Disarankan)

### P3-01: React Query Tidak Digunakan untuk Data Fetching
**Dampak:** Tidak ada caching → setiap navigasi refetch semua data

Hampir semua halaman pakai `useState + useEffect` manual. `QueryClient` sudah di-setup tapi hanya dipakai di ~10 tempat.

**Perbaikan:** Migrasi bertahap, mulai dari halaman yang paling sering dikunjungi (Index, ProductDetail, OrdersPage)

---

### P3-02: QueryClient Tanpa Konfigurasi Cache
**File:** `src/App.tsx`
**Dampak:** Setiap re-render bisa trigger refetch

`new QueryClient()` tanpa `defaultOptions` → staleTime = 0, gcTime = 5 menit default

**Perbaikan:**
```ts
new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 300_000, retry: 1 }
  }
})
```

---

### P3-03: FK_MAP Server Tidak Lengkap untuk POS
**File:** `server/routes/db-proxy.ts`
**Dampak:** Beberapa halaman POS join relasi yang tidak terdaftar → NULL

Relasi yang hilang:
- `pos_purchase_orders:pos_suppliers`
- `pos_purchase_orders:pos_outlets`
- `pos_stock_transfers:pos_outlets`
- `pos_sale_items:pos_outlets`

---

### P3-04: Kolom `merchant_operating_hours` Tidak Dipakai
Tabel `merchant_operating_hours` (jadwal per-hari) sudah dibuat tapi tidak dipakai. Semua logika jam operasional masih pakai kolom `is_open`, `open_time`, `close_time` di tabel `merchants`.

---

## 🟢 P4 — FITUR BARU / FUTURE

### P4-01: Server-Sent Events (SSE) untuk Realtime
Implementasi SSE di Express untuk menggantikan Supabase Realtime Channels. Endpoint: `GET /api/sse/:userId`

### P4-02: Mode Offline POS (PWA + IndexedDB)
IndexedDB untuk cache data produk & transaksi saat offline. Sync otomatis saat koneksi kembali.

### P4-03: Printer Thermal ESC/POS
Integrasi Web Serial API untuk printer thermal. Fallback ke `window.print()`.

### P4-04: WhatsApp Notifikasi Otomatis
Halaman `/admin/whatsapp` sudah ada. Perlu verifikasi integrasi API WhatsApp Business aktual.

### P4-05: Webhook & API Publik POS
REST API + webhook untuk integrasi third-party. Fondasi API key management sudah ada.

---

## Tabel Prioritas Eksekusi

| # | ID | Masalah | File | Status |
|---|----|---------|----|--------|
| 1 | P1-01 | RPC allowlist — 16 fungsi ditambah | `server/routes/db-proxy.ts` | ✅ Selesai |
| 2 | P1-02 | Kolom DB hilang — profiles + product_subscriptions | DB migration | ✅ Selesai |
| 3 | P1-03 | FK_MAP orders:profiles pakai buyer_id | `server/routes/db-proxy.ts` | ✅ Selesai |
| 4 | P3-03 | FK_MAP POS + 30+ relasi baru | `server/routes/db-proxy.ts` | ✅ Selesai |
| 5 | P1-04 | RekomendasisPage query — filter by buyer_id | `RekomendasisPage.tsx` | ✅ Selesai |
| 6 | P1-05 | ReviewsPage sudah ada & bekerja | `ReviewsPage.tsx` | ✅ Sudah Ada |
| 7 | P2-01 | Halaman Review — sudah ada sebelumnya | `ReviewsPage.tsx` | ✅ Sudah Ada |
| 8 | P2-02 | Lazy loading — 150+ halaman dikonversi | `App.tsx` | ✅ Selesai |
| 9 | P2-03 | PWA Workbox — target URL difix ke server lokal | `vite.config.ts` | ✅ Selesai |
| 10 | P3-02 | QueryClient defaultOptions — staleTime 60s | `App.tsx` | ✅ Selesai |
| 11 | P2-04 | AdminUsersPage — sudah benar, profiles.user_id OK | `AdminUsersPage.tsx` | ✅ Sudah OK |
| 12 | P1-06 | Realtime SSE — implementasi pengganti supabase.channel() | Server + client | ✅ Selesai |
