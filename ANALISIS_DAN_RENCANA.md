# DesaMart — Analisis Komprehensif & Rencana Perbaikan

> Dibuat: Mei 2026 | Stack: React 18 + Vite + Express + PostgreSQL (Replit)
> File ini adalah **satu-satunya sumber kebenaran** untuk rencana perbaikan.
> Update terakhir: Sprint 2 selesai (10 item security sudah dikerjakan)

---

## PROGRESS SPRINT

| Sprint | Selesai | Item |
|---|---|---|
| ✅ Sprint 1 | 6 item | S1, S2, S5, S10, B5, B7 |
| ✅ Sprint 2 | 5 item | S3, S4, S6, S7, S8 |
| ⬜ Sprint 3 (berikutnya) | — | B1, B2, F3, O1, O5 |

---

## RINGKASAN EKSEKUTIF

| Kategori | Total | Selesai | Belum |
|---|---|---|---|
| Keamanan | 10 | **9** ✅ | 1 |
| Bug / Potensi Bug | 10 | **3** ✅ | 7 |
| Optimasi | 8 | 0 | 8 |
| Fitur Bisnis Urgent | 9 | 0 | 9 |

---

## 1. KEAMANAN

### ✅ S1 — SELESAI: INSERT / UPDATE / DELETE Tanpa Autentikasi

**File:** `server/routes/db-proxy.ts`
**Sprint 1** — Route INSERT/UPDATE/DELETE kini wajib login. Tiga tabel publik (`product_views`, `search_history`, `merchant_visitors`) dikecualikan via `PUBLIC_WRITE_TABLES`. Request tanpa token langsung `401 Unauthorized`.

---

### ✅ S2 — SELESAI: DELETE / UPDATE Tanpa Filter = Hapus Semua Data

**File:** `server/routes/db-proxy.ts`
**Sprint 1** — UPDATE dan DELETE sekarang wajib ada minimal satu filter. Tanpa filter → `400 Bad Request`. Tidak ada lagi risiko `DELETE FROM orders` tanpa `WHERE`.

---

### ✅ S3 — SELESAI: SSE Broadcast ke Semua Client (Data Leak Antar User)

**File:** `server/sse-manager.ts`
**Sprint 2** — `broadcastDbEvent()` kini routing berdasarkan `user_id` atau `buyer_id` di record. Tabel sensitif (`notifications`, `orders`, `withdrawal_requests`, dll.) hanya dikirim ke user yang bersangkutan. Tabel publik (produk, toko) tetap broadcast ke semua.

---

### ✅ S4 — SELESAI: Session Token Muncul di URL (Replit Callback)

**File:** `server/routes/auth.ts`, `src/integrations/supabase/client.ts`
**Sprint 2** — Replit OAuth callback sekarang mengirim `?code=` (one-time code, TTL 1 menit) bukan `?token=`. Frontend exchange code ke token via `POST /api/auth/exchange-code`, lalu URL dibersihkan via `history.replaceState`. Token tidak pernah ada di browser history.

---

### ✅ S5 — SELESAI: Push Subscribe Tanpa Verifikasi User

**File:** `server/routes/push.ts`, `src/hooks/usePushNotification.ts`
**Sprint 1** — `user_id` kini diambil dari session token di server (bukan dari `req.body`). Frontend mengirim `Authorization: Bearer <token>` bukan `user_id`. Tidak bisa mendaftarkan subscription atas nama orang lain.

---

### ✅ S6 — SELESAI: CORS Wildcard untuk Semua Endpoint

**File:** `server/index.ts`
**Sprint 2** — Ganti `*` dengan whitelist: domain Replit dev (`REPLIT_DEV_DOMAIN`), subdomain `*.replit.dev`, `*.replit.app`, dan localhost. `Access-Control-Allow-Credentials: true` ditambahkan.

---

### ✅ S7 — SELESAI: Rate Limiting Hanya di Client-Side

**File:** `server/auth.ts`, `server/routes/auth.ts`
**Sprint 2** — Rate limiter in-memory di server: **10 percobaan / 15 menit per IP** untuk login dan register. Melewati batas → `429 Too Many Requests`. Counter reset otomatis setelah login berhasil.

---

### ✅ S8 — SELESAI: Session In-Memory (Hilang Saat Restart)

**File:** `server/auth.ts`, `server/index.ts`
**Sprint 2** — Tabel `sessions` dan `auth_codes` dibuat otomatis di PostgreSQL saat server start. `createSession`, `getSessionUser`, `deleteSession` semuanya async dan query ke DB. Session expired dibersihkan setiap 1 jam. Semua user tetap login setelah server restart.

---

### ⬜ S9 — BELUM: File Upload Tanpa Validasi Tipe Konten

**File:** `server/routes/storage.ts`

Upload file hanya mengambil ekstensi dari nama file string, tidak memvalidasi magic bytes konten file. Attacker bisa upload file `.php` atau `.js` dengan ekstensi `.jpg`.

**Solusi:**
```ts
import { fileTypeFromBuffer } from 'file-type';
const type = await fileTypeFromBuffer(buffer);
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
if (!type || !ALLOWED_TYPES.includes(type.mime)) {
  return res.status(400).json({ error: "Tipe file tidak diizinkan" });
}
```

---

### ✅ S10 — SELESAI: Validasi Password Lemah

**File:** `server/routes/auth.ts`
**Sprint 1** — Register dan update-password menolak password < 8 karakter atau tidak mengandung kombinasi huruf + angka.

---

## 2. BUG DAN POTENSI BUG

### ⬜ B1 — BELUM: POSDashboard N+1 Query (7 HTTP Calls Sequential)

**File:** `src/pages/pos/POSDashboardPage.tsx`

Loop di `fetchDashboardStats` melakukan **13 request HTTP sequential** setiap render. Ini lambat dan memboroskan koneksi DB.

**Solusi:** Satu query SQL GROUP BY:
```sql
SELECT DATE_TRUNC('day', created_at) as day, SUM(total) as total
FROM pos_sales
WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY 1 ORDER BY 1
```
Atau tambahkan endpoint `/api/pos/dashboard-stats` yang mengembalikan semua data sekaligus.

---

### ⬜ B2 — BELUM: useMerchantQuota Sequential Loop per Merchant

**File:** `src/hooks/useMerchantQuota.ts`

Di checkout dengan 3 merchant = 6 request sequential. Memperlambat proses checkout secara signifikan.

**Solusi:**
```ts
const results = await Promise.all(merchantIds.map(id => fetchMerchantQuota(id)));
```

---

### ⬜ B3 — BELUM: File Upload ke Local Filesystem (Tidak Persistent)

**File:** `server/routes/storage.ts`

Gambar produk, foto profil, bukti refund disimpan di `uploads/` di container Replit. File hilang saat container di-recycle atau server redeploy. Semua gambar akan broken di produksi.

**Solusi:** Integrasi ke object storage eksternal (Cloudflare R2, Backblaze B2, atau Replit Object Storage). Lihat F2.

---

### ⬜ B4 — BELUM: AuthContext Masih Bergantung pada Supabase Auth Shim

**File:** `src/contexts/AuthContext.tsx`

Semua fungsi auth (`onAuthStateChange`, `getSession`, `signInWithPassword`) masih melewati shim `supabase.auth.*`. Jika shim tidak trigger event dengan benar, state auth bisa tidak sinkron antar tab.

**Solusi:** Refactor AuthContext untuk langsung call `/api/auth/*` tanpa melewati shim.

---

### ✅ B5 — SELESAI: React Router Future Flag Warnings

**File:** `src/App.tsx`
**Sprint 1** — Ditambah `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` ke `BrowserRouter`. Warning di console sudah hilang.

---

### ⬜ B6 — BELUM: Email Reset Password Tidak Terkirim

**File:** `src/pages/ForgotPasswordPage.tsx`

Halaman reset password ada di frontend tetapi tidak ada backend yang benar-benar mengirim email. User yang klik "Lupa Password" tidak akan menerima apapun. Bergantung pada F1 (Email SMTP).

---

### ✅ B7 — SELESAI: Xendit Webhook Validasi Signature Lemah

**File:** `server/index.ts`
**Sprint 1** — Validasi diperketat: jika `callback_token` dikonfigurasi maka wajib cocok, jika belum dikonfigurasi ada warning log sebagai pengingat admin.

---

### ⬜ B8 — BELUM: Scheduled Jobs Tidak Ada Scheduler

**File:** `server/routes/db-proxy.ts`

RPC `auto_cancel_pending_orders` dan `auto_complete_delivered_orders` ada di allowlist tapi tidak ada yang memanggilnya secara terjadwal. Bergantung pada F3 (Cron Job).

---

### ⬜ B9 — BELUM: Cashback Balance Tidak Ada Logika Auto-Credit

**File:** `src/pages/buyer/CashbackPage.tsx`

Kolom `cashback_balance` ada di `profiles` tapi tidak ada server-side logic yang otomatis kredit cashback saat order `DONE`. Bergantung pada F7.

---

### ⬜ B10 — BELUM: Refund Tidak Ada Logika Transfer Saldo

**File:** `src/pages/admin/AdminRefundsPage.tsx`

Admin hanya mengubah `status` refund. Tidak ada debit merchant, kredit buyer, atau pencatatan mutasi keuangan. Bergantung pada F4.

---

## 3. OPTIMASI

### ⬜ O1 — BELUM: POSKasirPage.tsx Terlalu Besar (1525 Baris)

**File:** `src/pages/pos/POSKasirPage.tsx`

Satu file mengandung cart, dialog payment, loyalty, barcode scanner, held bills, promo — semua state di satu komponen menyebabkan re-render berlebihan.

**Solusi:** Pecah menjadi: `POSCart.tsx`, `POSPaymentDialog.tsx`, `POSLoyaltySection.tsx`, `POSHeldBills.tsx`.

---

### ⬜ O2 — BELUM: Image Upload via Base64 (Inefisien, +33% Ukuran)

**File:** `server/routes/storage.ts`

Upload gambar di-encode ke base64 di browser dan dikirim sebagai JSON. Untuk foto 2MB → dikirim 2.7MB.

**Solusi:** Gunakan `multipart/form-data` dengan `multer`.

---

### ⬜ O3 — BELUM: React Query staleTime Seragam untuk Semua Data

**File:** `src/App.tsx`

Semua query pakai `staleTime: 60_000`. Data statis (categories, wilayah) bisa di-cache 1 jam. Data dinamis (orders, notifications) seharusnya lebih sering refresh.

---

### ⬜ O4 — BELUM: FK Join di DB Proxy Belum Optimal

**File:** `server/routes/db-proxy.ts`

Query SELECT dengan relasi sudah menggunakan `LEFT JOIN LATERAL` di server, tapi query untuk relasi nested-nested masih menggunakan subquery inline yang bisa dioptimasi lebih lanjut dengan CTE.

---

### ⬜ O5 — BELUM: SSE Heartbeat Interval Tanpa Max Connection Timeout

**File:** `server/routes/sse.ts`

Setiap koneksi SSE membuat `setInterval(25s)`. Jika `req.on('close')` tidak terpanggil akibat timeout paksa, interval bisa bocor memory.

**Solusi:**
```ts
const MAX_MS = 30 * 60 * 1000;
const timeout = setTimeout(() => res.end(), MAX_MS);
req.on("close", () => { clearInterval(heartbeat); clearTimeout(timeout); });
```

---

### ⬜ O6 — BELUM: useMerchantQuota Loop Sequential (lihat B2)

Impact ganda: bug dan performance issue di checkout.

---

### ⬜ O7 — BELUM: Suspense Fallback Tidak Konsisten

**File:** `src/App.tsx`

`React.lazy()` sudah diimplementasi untuk 150+ halaman tetapi beberapa halaman besar tidak punya skeleton fallback yang sesuai.

---

### ⬜ O8 — BELUM: Cart di localStorage Tidak Ada Batas Ukuran

**File:** `src/contexts/CartContext.tsx`

Cart disimpan di `localStorage` tanpa validasi ukuran. Jika user menambah 100+ item, JSON bisa melebihi batas localStorage browser (5MB).

---

## 4. FITUR BISNIS URGENT

### ⬜ F1 — BELUM: Email Notifikasi (Konfirmasi Order, Reset Password)

Tidak ada SMTP atau email service. User tidak bisa reset password, merchant tidak dapat notifikasi order via email.

**Rencana:** Nodemailer + SMTP (Gmail/Mailgun/Resend). Template HTML untuk: konfirmasi order, reset password, verifikasi email, status pesanan.

---

### ⬜ F2 — BELUM: Object Storage Persistent (Pengganti Local Filesystem)

Semua foto produk dan profil hilang saat container Replit di-recycle.

**Rencana:** Cloudflare R2 (gratis 10GB) atau Backblaze B2. Migrasi `server/routes/storage.ts` untuk upload ke bucket eksternal.

---

### ⬜ F3 — BELUM: Scheduler / Cron Job untuk Otomasi Bisnis

RPC auto-cancel dan auto-complete order ada tapi tidak ada yang memanggilnya secara terjadwal.

**Rencana:**
```ts
import cron from 'node-cron';
cron.schedule('*/30 * * * *', () => runRPC('auto_cancel_pending_orders'));
cron.schedule('0 2 * * *', () => runRPC('auto_complete_delivered_orders'));
```

---

### ⬜ F4 — BELUM: Refund Processing Otomatis (Transfer Saldo)

Saat admin approve refund: tidak ada debit merchant, kredit buyer, atau pencatatan mutasi keuangan.

**Rencana:** Endpoint `POST /api/refunds/:id/process` dengan database transaction (BEGIN/COMMIT).

---

### ⬜ F5 — BELUM: Halaman Komplain / Dispute Buyer dengan Bukti Foto

Buyer tidak punya cara formal untuk mengajukan komplain dengan bukti foto setelah barang diterima.

**Rencana:** Halaman `/orders/:id/dispute` dengan form komplain, upload foto, status tracking, notifikasi merchant + admin.

---

### ⬜ F6 — BELUM: Export Laporan Keuangan (PDF / CSV)

Halaman laporan ada tapi tidak ada tombol export. Merchant butuh export untuk akuntansi.

**Rencana:** Endpoint `GET /api/reports/export?format=csv&month=2026-05`. PDF dengan `pdfkit`.

---

### ⬜ F7 — BELUM: Cashback Auto-Credit Logic di Server

Field `cashback_balance` ada di DB tapi tidak ada kode yang mengisinya otomatis saat order `DONE`.

**Rencana:** Trigger server saat update status order ke `DONE`: kredit cashback berdasarkan persentase dari `cashback_rules`.

---

### ⬜ F8 — BELUM: Verifikasi Merchant dengan Status Tracking Jelas

Merchant baru tidak tahu status verifikasi mereka. Tidak ada notifikasi perubahan status.

**Rencana:** Halaman `/merchant/verification-status` dengan progress steps. Notifikasi admin saat ada merchant baru menunggu. (Butuh F1 untuk email.)

---

### ⬜ F9 — BELUM: Analytics Merchant yang Lebih Kaya

Saat ini grafik dasar. Belum ada: produk paling sering di-wishlist, konversi cart-to-order, AOV trend, perbandingan bulan ini vs lalu.

---

## STATUS LENGKAP — SEMUA ITEM

| ID | Judul | Prioritas | Estimasi | Status |
|---|---|---|---|---|
| **KEAMANAN** | | | | |
| S1 | Auth di INSERT/UPDATE/DELETE | 🔴 Kritis | 2 jam | ✅ Sprint 1 |
| S2 | Guard DELETE/UPDATE tanpa filter | 🔴 Kritis | 1 jam | ✅ Sprint 1 |
| S3 | SSE broadcast per-user | 🔴 Kritis | 4 jam | ✅ Sprint 2 |
| S4 | Token di URL → exchange code | 🔴 Kritis | 2 jam | ✅ Sprint 2 |
| S5 | Push subscribe verifikasi user | 🔴 Kritis | 1 jam | ✅ Sprint 1 |
| S6 | CORS restrict origin | 🟠 Penting | 1 jam | ✅ Sprint 2 |
| S7 | Rate limit di server | 🟠 Penting | 3 jam | ✅ Sprint 2 |
| S8 | Session persistent di DB | 🟠 Penting | 4 jam | ✅ Sprint 2 |
| S9 | Validasi magic bytes file upload | 🟠 Penting | 2 jam | ⬜ Belum |
| S10 | Validasi kekuatan password | 🟠 Penting | 1 jam | ✅ Sprint 1 |
| **BUG** | | | | |
| B1 | POS Dashboard N+1 queries | 🔴 Kritis | 3 jam | ⬜ Belum |
| B2 | useMerchantQuota sequential | 🔴 Kritis | 2 jam | ⬜ Belum |
| B3 | File upload tidak persistent | 🔴 Kritis | 1 hari | ⬜ Belum (lihat F2) |
| B4 | Refactor AuthContext dari shim | 🔴 Kritis | 4 jam | ⬜ Belum |
| B5 | React Router future flags | 🟠 Penting | 30 menit | ✅ Sprint 1 |
| B6 | Email reset password | 🟠 Penting | — | ⬜ Belum (lihat F1) |
| B7 | Xendit webhook signature | 🟠 Penting | 1 jam | ✅ Sprint 1 |
| B8 | Scheduled jobs tidak ada | 🟠 Penting | — | ⬜ Belum (lihat F3) |
| B9 | Cashback auto-credit | 🟠 Penting | — | ⬜ Belum (lihat F7) |
| B10 | Refund saldo transfer | 🟠 Penting | — | ⬜ Belum (lihat F4) |
| **OPTIMASI** | | | | |
| O1 | Pecah POSKasirPage.tsx | 🔴 High | 1 hari | ⬜ Belum |
| O2 | Upload multipart bukan base64 | 🟠 Penting | 3 jam | ⬜ Belum |
| O3 | staleTime per query | 🟠 Penting | 2 jam | ⬜ Belum |
| O4 | DB join efficiency | 🟠 Penting | 4 jam | ⬜ Belum |
| O5 | SSE connection max timeout | 🟢 Minor | 1 jam | ⬜ Belum |
| O6 | useMerchantQuota paralel | 🟠 Penting | — | ⬜ Belum (lihat B2) |
| O7 | Suspense fallback konsisten | 🟢 Minor | 2 jam | ⬜ Belum |
| O8 | Cart localStorage size limit | 🟢 Minor | 30 menit | ⬜ Belum |
| **FITUR** | | | | |
| F1 | Email notifikasi (SMTP) | 🔴 Urgent | 2 hari | ⬜ Belum |
| F2 | Object storage persistent | 🔴 Urgent | 1 hari | ⬜ Belum |
| F3 | Cron job / scheduler | 🔴 Urgent | 4 jam | ⬜ Belum |
| F4 | Refund processing otomatis | 🔴 Urgent | 1 hari | ⬜ Belum |
| F5 | Halaman dispute/komplain buyer | 🔴 Urgent | 1 hari | ⬜ Belum |
| F6 | Export laporan PDF/CSV | 🟠 Penting | 1 hari | ⬜ Belum |
| F7 | Cashback auto-credit server | 🟠 Penting | 4 jam | ⬜ Belum |
| F8 | Status verifikasi merchant | 🟠 Penting | 1 hari | ⬜ Belum |
| F9 | Analytics merchant richer | 🟢 Nice-to-have | 2 hari | ⬜ Belum |

---

## REKOMENDASI SPRINT BERIKUTNYA

### Sprint 3 — Bug & Performance (estimasi ~1 hari)
1. **B1** — POS Dashboard query N+1 → satu endpoint `/api/pos/dashboard-stats`
2. **B2 / O6** — useMerchantQuota paralel dengan `Promise.all`
3. **O5** — SSE connection max timeout (quick fix)
4. **S9** — Validasi magic bytes file upload
5. **O1** — Mulai pecah POSKasirPage.tsx

### Sprint 4 — Fitur Bisnis Kritikal (estimasi ~3 hari)
1. **F3** — Cron job: auto-cancel order, auto-complete delivered
2. **F2 + B3** — Object storage persistent (Cloudflare R2)
3. **F1 + B6** — Email SMTP + reset password
4. **F4 + B10** — Refund processing dengan transfer saldo
5. **F7 + B9** — Cashback auto-credit saat order DONE
