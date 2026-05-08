# DesaMart — Analisis Komprehensif & Rencana Perbaikan

> Dibuat: Mei 2026 | Stack: React 18 + Vite + Express + PostgreSQL (Replit)
> File ini adalah **satu-satunya sumber kebenaran** untuk rencana perbaikan.

---

## RINGKASAN EKSEKUTIF

| Kategori | Temuan Kritis | Temuan Penting | Total |
|---|---|---|---|
| Keamanan | 5 | 5 | 10 |
| Bug / Potensi Bug | 5 | 5 | 10 |
| Optimasi | 4 | 4 | 8 |
| Fitur Bisnis Urgent | 5 | 4 | 9 |

---

## 1. KEAMANAN

### 🔴 S1 — KRITIS: INSERT / UPDATE / DELETE Tanpa Autentikasi

**File:** `server/routes/db-proxy.ts` (baris 407–520)

Route `POST /api/db/insert`, `/api/db/update`, `/api/db/delete` **tidak memanggil `getUser()`** sebelum eksekusi. Fungsi `getUser()` sudah ada di file yang sama (baris 240) tetapi hanya digunakan untuk SELECT. Siapa pun — termasuk request yang tidak login — dapat:
- Menyisipkan data palsu ke tabel mana saja (orders, merchants, profiles, dll.)
- Mengubah harga produk, status order, atau saldo wallet
- Menghapus record tanpa batasan

**Solusi:**
```ts
// Tambahkan di awal setiap route INSERT/UPDATE/DELETE:
router.post("/insert", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  // ... lanjut eksekusi
});
```
Untuk operasi sensitif (update wallet, order status), tambahkan juga validasi kepemilikan data.

---

### 🔴 S2 — KRITIS: DELETE / UPDATE Tanpa Filter = Hapus Semua Data

**File:** `server/routes/db-proxy.ts`

Jika `filters` kosong atau tidak dikirim, query DELETE akan menjadi:
```sql
DELETE FROM public.orders RETURNING *
```
Ini menghapus **seluruh tabel**. Tidak ada guard terhadap operasi ini.

**Solusi:**
```ts
// Wajibkan minimal satu filter untuk DELETE dan UPDATE:
if (!filters || !Array.isArray(filters) || filters.length === 0) {
  return res.status(400).json({ error: "filters are required for delete/update" });
}
```

---

### 🔴 S3 — KRITIS: SSE Broadcast ke Semua Client (Data Leak Antar User)

**File:** `server/sse-manager.ts`, `server/routes/db-proxy.ts`

Fungsi `broadcastDbEvent()` mengirim setiap perubahan DB (INSERT/UPDATE/DELETE) ke **semua** koneksi SSE yang aktif via `allClients`. Artinya:
- Notifikasi order user A terkirim juga ke user B
- Data chat, status order, saldo — semuanya bocor ke semua sesi yang terhubung

**Solusi:** Filter broadcast berdasarkan `userId` yang relevan:
```ts
// Di broadcastDbEvent, tambahkan field target_user_id
// Hanya kirim ke client milik user tersebut
export function broadcastToUser(userId: string, payload: object) {
  const userClients = clients.get(userId) || [];
  for (const c of userClients) sendEvent(c.res, payload);
}
```

---

### 🔴 S4 — KRITIS: Session Token Muncul di URL (Replit Callback)

**File:** `server/routes/auth.ts` (baris ~120)

```ts
return res.redirect(`/?auth=success&token=${token}`);
```

Token session yang diredirect ke URL akan:
- Masuk ke browser history
- Muncul di Referer header saat user mengklik link lain
- Tercatat di server access logs

**Solusi:** Gunakan HttpOnly cookie untuk menyampaikan token, bukan query string:
```ts
res.cookie("session_token", token, { httpOnly: true, sameSite: "lax", maxAge: 7*24*60*60*1000 });
return res.redirect("/");
```

---

### 🔴 S5 — KRITIS: Push Subscribe Tanpa Verifikasi User

**File:** `server/routes/push.ts` (baris ~30)

```ts
const { user_id, subscription } = req.body; // user_id dari body, tidak diverifikasi!
```

Siapapun bisa mendaftarkan push subscription dengan `user_id` orang lain, sehingga bisa menerima notifikasi push milik user lain.

**Solusi:** Ambil `user_id` dari sesi yang terautentikasi, bukan dari body:
```ts
router.post("/subscribe", async (req, res) => {
  const user = await getUser(req); // dari session token
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const userId = user.id; // bukan dari req.body
  // ...
});
```

---

### 🟠 S6 — PENTING: CORS Wildcard untuk Semua Endpoint

**File:** `server/index.ts` (baris 14–18)

```ts
"Access-Control-Allow-Origin": "*"
```

Semua endpoint termasuk yang butuh autentikasi menerima request dari origin mana saja. Untuk endpoint publik ini OK, tetapi untuk `/api/auth/*` dan `/api/db/*` seharusnya dibatasi ke origin app sendiri.

**Solusi:**
```ts
const allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:5000"];
app.use(cors({ origin: allowedOrigins, credentials: true }));
```

---

### 🟠 S7 — PENTING: Rate Limiting Hanya di Client-Side

**File:** `src/lib/rateLimit.ts`

Rate limiting login/register/checkout berjalan sepenuhnya di browser (in-memory Map). Dapat dibypass dengan:
- Membuka tab baru / incognito
- Mengirim request langsung via curl/Postman
- Refresh halaman

**Solusi:** Implementasi rate limiting di server (`server/routes/auth.ts`) menggunakan `express-rate-limit` atau Redis-based counter di PostgreSQL.

---

### 🟠 S8 — PENTING: Session In-Memory (Hilang Saat Restart)

**File:** `server/auth.ts` (baris 156)

```ts
const sessions = new Map<string, { userId: string; expiresAt: number }>();
```

Setiap kali server Express restart (deployment, error crash, dll), semua session hilang. Seluruh user yang sedang login akan keluar tiba-tiba.

**Solusi:** Simpan session di PostgreSQL:
```sql
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 🟠 S9 — PENTING: File Upload Tanpa Validasi Tipe Konten

**File:** `server/routes/storage.ts`

Upload file hanya mengambil ekstensi dari `filePath` string (`split(".").pop()`), tidak memvalidasi konten file (magic bytes). Attacker bisa upload file `.php` atau `.js` dengan ekstensi `.jpg`.

**Solusi:** Validasi MIME type menggunakan library seperti `file-type`:
```ts
import { fileTypeFromBuffer } from 'file-type';
const type = await fileTypeFromBuffer(buffer);
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
if (!type || !ALLOWED_TYPES.includes(type.mime)) {
  return res.status(400).json({ error: "File type not allowed" });
}
```

---

### 🟠 S10 — PENTING: Validasi Password Lemah

**File:** `server/routes/auth.ts`

Tidak ada validasi panjang minimum atau kompleksitas password. User bisa mendaftar dengan password `"1"`.

**Solusi:**
```ts
if (password.length < 8) {
  return res.status(400).json({ error: "Password minimal 8 karakter" });
}
```

---

## 2. BUG DAN POTENSI BUG

### 🔴 B1 — BUG: POSDashboard N+1 Query (7 HTTP Calls Sequential)

**File:** `src/pages/pos/POSDashboardPage.tsx` (fungsi `fetchDashboardStats`)

```ts
// Loop ini melakukan 7 query terpisah satu per satu!
for (let i = 6; i >= 0; i--) {
  const { data } = await supabase.from('pos_sales').select('total')
    .eq('tenant_id', tenantId)...
  salesChart.push(...)
}
```

Setiap render POSDashboard membuat **7 + 6 = 13 request HTTP** secara sequential. Ini lambat dan memboroskan koneksi DB.

**Solusi:** Ganti dengan satu query SQL GROUP BY:
```sql
SELECT DATE_TRUNC('day', created_at) as day, SUM(total) as total
FROM pos_sales
WHERE tenant_id = $1 AND outlet_id = $2
  AND created_at >= NOW() - INTERVAL '7 days'
  AND status = 'completed'
GROUP BY 1 ORDER BY 1
```

---

### 🔴 B2 — BUG: useMerchantQuota Sequential Loop per Merchant

**File:** `src/hooks/useMerchantQuota.ts`

```ts
for (const merchantId of merchantIds) {
  // 2 query per merchant — sequential!
  const { data: merchant } = await supabase.from('merchants').select(...)
  const { data: subscriptions } = await supabase.from('merchant_subscriptions').select(...)
}
```

Di halaman checkout dengan 3 merchant, ini = 6 request sequential. Memperlambat proses checkout secara signifikan.

**Solusi:** Gunakan `Promise.all()` atau satu query batch:
```ts
const results = await Promise.all(merchantIds.map(id => fetchMerchantQuota(id)));
```

---

### 🔴 B3 — BUG: File Upload ke Local Filesystem (Tidak Persistent)

**File:** `server/routes/storage.ts`, `server/index.ts`

Gambar produk, foto profil, dan bukti refund disimpan di folder `uploads/` di filesystem lokal container Replit. File ini **hilang** saat:
- Server restart/redeploy
- Container di-recycle oleh Replit

Semua gambar produk yang sudah diupload akan broken setelah deployment berikutnya.

**Solusi Sementara:** Mount ke volume persistent, atau gunakan Replit Object Storage / Cloudflare R2.

---

### 🔴 B4 — BUG: AuthContext Masih Punya Supabase Auth Shim Dependency

**File:** `src/contexts/AuthContext.tsx`

```ts
const { data: { subscription } } = supabase.auth.onAuthStateChange(...)
supabase.auth.getSession()
supabase.auth.signInWithPassword(...)
```

Semua ini bergantung pada implementasi shim di `src/integrations/supabase/client.ts`. Jika shim untuk `auth.onAuthStateChange` tidak benar-benar trigger event saat session berubah (misal setelah login di tab lain), state auth bisa tidak sinkron.

**Solusi:** Refactor AuthContext untuk langsung call `/api/auth/*` tanpa melewati shim Supabase.

---

### 🔴 B5 — BUG: React Router Future Flag Warnings (Console Noise)

**File:** `src/App.tsx`

Browser console menampilkan warning React Router v7 di setiap page load:
```
⚠️ React Router Future Flag Warning: v7_startTransition
⚠️ React Router Future Flag Warning: v7_relativeSplatPath
```

**Solusi:** Tambahkan future flags di BrowserRouter:
```tsx
<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
```

---

### 🟠 B6 — POTENSI BUG: Email Reset Password Tidak Terkirim

**File:** `src/pages/ForgotPasswordPage.tsx`, `server/routes/auth.ts`

Halaman reset password ada di frontend (`/forgot-password`) tetapi tidak ada endpoint backend yang benar-benar mengirim email. Supabase Auth yang dulu menangani ini sudah dihapus. User yang klik "Lupa Password" tidak akan menerima email apapun.

---

### 🟠 B7 — POTENSI BUG: Xendit Webhook Tidak Validasi Signature

**File:** `server/index.ts` (sekitar baris 220–260)

Endpoint `POST /api/xendit/webhook` menerima semua request tanpa memverifikasi `X-CALLBACK-TOKEN` dari Xendit (atau jika ada pengecekan, perlu diverifikasi). Attacker bisa memalsukan webhook payment success untuk memproses order tanpa bayar.

**Solusi:** Validasi header `x-callback-token` terhadap `XENDIT_WEBHOOK_TOKEN` env var.

---

### 🟠 B8 — POTENSI BUG: Scheduled Jobs Tidak Punya Scheduler

**File:** `server/routes/db-proxy.ts` (ALLOWED_RPCS)

RPC `auto_cancel_pending_orders` dan `auto_complete_delivered_orders` ada di allowlist tapi tidak ada scheduler (cron job) yang memanggil ini secara otomatis. Order tidak akan pernah auto-cancel atau auto-complete kecuali ada trigger manual.

---

### 🟠 B9 — POTENSI BUG: Cashback Balance Tidak Ada Logika Auto-Credit

**File:** `src/integrations/supabase/types.ts`, `src/pages/buyer/CashbackPage.tsx`

Kolom `cashback_balance` ada di `profiles` tapi tidak ada server-side logic yang otomatis kredit cashback saat order `DONE`. Frontend hanya menampilkan saldo, tidak ada transaksi yang mencatatnya.

---

### 🟠 B10 — POTENSI BUG: Refund Tidak Ada Logika Transfer Saldo

**File:** `src/pages/admin/AdminRefundsPage.tsx`

UI refund ada (approve/reject) tapi saat admin approve refund, tidak ada kode yang:
1. Mendebit saldo merchant
2. Mengkredit wallet/cashback buyer
3. Mencatat mutasi keuangan

Admin hanya mengubah `status` refund, bukan memproses transfer uang yang sebenarnya.

---

## 3. OPTIMASI

### 🔴 O1 — HIGH IMPACT: POSKasirPage.tsx Terlalu Besar (1525 Baris)

**File:** `src/pages/pos/POSKasirPage.tsx`

Satu file dengan 1525 baris mengandung:
- Antarmuka cart
- Dialog payment
- Logika loyalty/member
- Barcode scanner
- Held bills (tagihan ditahan)
- Promo dan voucher

Ini menyebabkan re-render berlebihan karena semua state di satu komponen. Juga sulit di-maintain.

**Solusi:** Pecah menjadi komponen terpisah:
- `POSCart.tsx` — manajemen item keranjang
- `POSPaymentDialog.tsx` — dialog proses pembayaran
- `POSLoyaltySection.tsx` — member & poin
- `POSHeldBills.tsx` — tagihan ditahan

---

### 🔴 O2 — HIGH IMPACT: Image Upload via Base64 (Inefisien)

**File:** `server/routes/storage.ts`, klien yang upload

Upload gambar saat ini di-encode ke base64 di browser, dikirim sebagai JSON. Base64 menambah overhead **~33%** ukuran file. Untuk foto produk 2MB, dikirim 2.7MB.

**Solusi:** Gunakan `multipart/form-data` dengan `multer`:
```ts
import multer from 'multer';
const upload = multer({ dest: 'uploads/tmp/' });
router.post("/upload", upload.single('file'), async (req, res) => {
  // req.file sudah tersedia
});
```

---

### 🟠 O3 — PENTING: React Query staleTime Seragam untuk Semua Data

**File:** `src/App.tsx`

Semua query menggunakan `staleTime: 60_000` (1 menit). Data seperti `categories`, `wilayah`, `app_settings` sangat jarang berubah dan bisa di-cache jauh lebih lama, sementara data seperti `orders` dan `notifications` harus lebih sering refresh.

**Solusi:** Set `staleTime` per query:
```ts
// Data statis
useQuery({ queryKey: ['categories'], staleTime: 60 * 60 * 1000 }) // 1 jam

// Data dinamis
useQuery({ queryKey: ['orders', userId], staleTime: 30_000 }) // 30 detik
```

---

### 🟠 O4 — PENTING: FK Join di DB Proxy Tidak Menggunakan Database JOIN

**File:** `server/routes/db-proxy.ts`

Query SELECT dengan relasi (misal orders + merchants + products) dilakukan dengan **multiple round-trips**: query utama dulu, lalu query FK untuk setiap relasi. Ini N+1 di level server.

**Solusi:** Manfaatkan PostgreSQL JOIN langsung atau gunakan query yang lebih efisien dengan `WITH` CTE.

---

### 🟠 O5 — PENTING: SSE Heartbeat Memory Leak Saat Koneksi Banyak

**File:** `server/routes/sse.ts`

Setiap koneksi SSE membuat `setInterval(25000)`. Dengan 1000 user aktif = 1000 interval berjalan. Jika cleanup `req.on('close')` tidak selalu terpanggil (misal timeout paksa), interval bisa tidak pernah dibersihkan.

**Solusi:** Tambahkan timeout maksimum koneksi dan pastikan cleanup berjalan:
```ts
const MAX_CONNECTION_MS = 30 * 60 * 1000; // 30 menit
const timeout = setTimeout(() => res.end(), MAX_CONNECTION_MS);
req.on("close", () => { clearInterval(heartbeat); clearTimeout(timeout); });
```

---

### 🟠 O6 — PENTING: `useMerchantQuota` Dipanggil di Checkout dengan Loop Sequential

Sudah disebutkan di B2. Impact ganda: bug dan performance issue di checkout.

---

### 🟢 O7 — MINOR: Lazy Loading Sudah Ada, Tapi Suspense Fallback Tidak Konsisten

**File:** `src/App.tsx`

`React.lazy()` sudah diimplementasi untuk 150+ halaman. Namun beberapa halaman mungkin tidak punya `<Suspense>` fallback yang baik (hanya loading spinner generic). Untuk halaman besar seperti POSKasirPage, fallback skeleton yang sesuai akan meningkatkan UX.

---

### 🟢 O8 — MINOR: Cart di localStorage Tidak Ada Batas Ukuran

**File:** `src/contexts/CartContext.tsx`

Cart disimpan di `localStorage` tanpa validasi ukuran. Jika user menambah 100+ item, JSON bisa melebihi batas localStorage browser (5MB).

---

## 4. FITUR BISNIS URGENT

### 🔴 F1 — URGENT: Email Notifikasi (Konfirmasi Order, Reset Password, Verifikasi Akun)

**Status:** Belum ada implementasi sama sekali

Saat ini tidak ada SMTP atau email service. Dampak bisnis:
- User tidak bisa reset password (flow ada, email tidak terkirim)
- Konfirmasi order hanya via notifikasi in-app (tidak ada email backup)
- Merchant tidak mendapat notifikasi order baru via email

**Rencana:** Integrasi dengan Nodemailer + SMTP (Gmail/Mailgun/Resend):
- Template HTML untuk: konfirmasi order, reset password, verifikasi email, notifikasi status pesanan
- Endpoint `/api/email/send` di server
- Trigger otomatis dari order status changes

---

### 🔴 F2 — URGENT: Object Storage Persistent (Pengganti Local Filesystem)

**Status:** Upload ke `uploads/` — tidak survive restart

Semua foto produk, foto profil, bukti refund akan hilang setiap kali container di-recycle. Ini akan menyebabkan semua gambar broken di produksi.

**Rencana:**
- Gunakan **Cloudflare R2** (gratis 10GB) atau **Backblaze B2**
- Atau gunakan Replit Object Storage jika tersedia
- Migrasi `server/routes/storage.ts` untuk upload ke bucket eksternal
- Update `publicUrl` agar mengarah ke CDN URL

---

### 🔴 F3 — URGENT: Scheduler / Cron Job untuk Otomasi Bisnis

**Status:** RPC ada, tidak ada yang memanggilnya secara terjadwal

Proses bisnis yang seharusnya otomatis:
- Auto-cancel order pending > 24 jam
- Auto-complete order yang sudah 3 hari DELIVERED
- Auto-generate laporan bulanan kas
- Cleanup expired chat dan push subscriptions
- Flash sale auto-start dan auto-end berdasarkan jadwal

**Rencana:** Implementasi cron job sederhana di `server/index.ts`:
```ts
import cron from 'node-cron';
cron.schedule('*/30 * * * *', () => runRPC('auto_cancel_pending_orders'));
cron.schedule('0 2 * * *', () => runRPC('auto_complete_delivered_orders'));
```

---

### 🔴 F4 — URGENT: Refund Processing Otomatis (Transfer Saldo)

**Status:** Hanya UI approve/reject, tidak ada transfer nyata

Saat admin approve refund:
1. Saldo merchant harus didebit
2. Wallet buyer harus dikredit (atau cashback)
3. Mutasi keuangan harus tercatat
4. Notifikasi harus terkirim ke buyer

**Rencana:** Server endpoint `POST /api/refunds/:id/process`:
```ts
// Gunakan database transaction:
BEGIN;
  UPDATE merchant_subscriptions SET ... -- debit merchant
  UPDATE profiles SET cashback_balance = cashback_balance + amount WHERE user_id = buyer_id;
  INSERT INTO financial_mutations ...;
  UPDATE refund_requests SET status = 'approved', processed_at = now();
COMMIT;
```

---

### 🔴 F5 — URGENT: Komplain / Dispute Buyer dengan Bukti Foto

**Status:** Belum ada halaman khusus buyer untuk komplain

Saat ini buyer tidak punya cara formal untuk mengajukan komplain dengan bukti foto setelah barang diterima. Hanya ada chat order yang terbatas.

**Rencana:** Halaman baru `/orders/:id/dispute`:
- Form komplain dengan upload bukti foto (maks 3 foto)
- Kategori masalah (barang rusak, tidak sesuai, tidak datang)
- Status tracking komplain
- Notifikasi ke merchant dan admin
- Admin bisa mediasi dan putuskan refund

---

### 🟠 F6 — PENTING: Export Laporan Keuangan (PDF / Excel)

**Status:** Halaman laporan ada tapi tidak ada tombol export

Merchant dan admin butuh export data untuk akuntansi, laporan pajak, dan rekonsiliasi.

**Rencana:**
- Export CSV untuk daftar transaksi (mudah diimplementasi)
- Export PDF untuk laporan ringkasan bulanan (gunakan `pdfkit` atau `puppeteer`)
- Endpoint: `GET /api/reports/export?format=csv&month=2026-05&type=sales`

---

### 🟠 F7 — PENTING: Cashback Auto-Credit Logic di Server

**Status:** Field `cashback_balance` ada di DB tapi tidak ada kode yang mengisinya

Cashback harus dikreditkan otomatis saat order status berubah ke `DONE` berdasarkan persentase yang dikonfigurasi admin.

**Rencana:** Trigger di server saat update status order:
```ts
if (newStatus === 'DONE') {
  const cashbackPercent = await getCashbackSettings();
  const cashback = order.total * cashbackPercent;
  await creditCashback(order.buyer_id, cashback, order.id);
}
```

---

### 🟠 F8 — PENTING: Verifikasi Merchant Otomatis dengan Halaman Status

**Status:** Merchant mendaftar tapi tidak ada tracking status verifikasi yang jelas

Merchant yang baru mendaftar tidak tahu kapan dan apakah verifikasi mereka diproses. Tidak ada notifikasi email (lihat F1) dan status di dashboard kurang informatif.

**Rencana:**
- Halaman `/merchant/verification-status` dengan progress step yang jelas
- Email notifikasi saat status berubah (butuh F1 selesai dulu)
- Admin diberi notifikasi saat ada merchant baru menunggu verifikasi

---

### 🟢 F9 — NICE-TO-HAVE: Laporan Analytics Merchant yang Lebih Kaya

**File:** `src/pages/merchant/MerchantAnalyticsPage.tsx`

Saat ini menampilkan grafik dasar. Fitur yang akan meningkatkan nilai bisnis:
- Produk paling sering ditambah ke wishlist (intent data)
- Konversi cart-to-order per produk
- Rata-rata nilai order (AOV) trend
- Perbandingan bulan ini vs bulan lalu dengan persentase growth

---

## STATUS & PRIORITAS PENGERJAAN

| ID | Judul | Prioritas | Estimasi | Status |
|---|---|---|---|---|
| S1 | Auth di INSERT/UPDATE/DELETE | 🔴 Kritis | 2 jam | ✅ Sprint 1 |
| S2 | Guard DELETE/UPDATE tanpa filter | 🔴 Kritis | 1 jam | ✅ Sprint 1 |
| S3 | SSE broadcast per-user | 🔴 Kritis | 4 jam | ⬜ Belum |
| S4 | Token di URL → Cookie | 🔴 Kritis | 2 jam | ⬜ Belum |
| S5 | Push subscribe verifikasi user | 🔴 Kritis | 1 jam | ✅ Sprint 1 |
| S6 | CORS restrict origin | 🟠 Penting | 1 jam | ⬜ Belum |
| S7 | Rate limit di server | 🟠 Penting | 3 jam | ⬜ Belum |
| S8 | Session persistent di DB | 🟠 Penting | 4 jam | ⬜ Belum |
| S9 | Validasi file upload | 🟠 Penting | 2 jam | ⬜ Belum |
| S10 | Validasi kekuatan password | 🟠 Penting | 1 jam | ✅ Sprint 1 |
| B1 | POS Dashboard N+1 queries | 🔴 Kritis | 3 jam | ⬜ Belum |
| B2 | useMerchantQuota sequential | 🔴 Kritis | 2 jam | ⬜ Belum |
| B3 | File upload tidak persistent | 🔴 Kritis | 1 hari | ⬜ Belum |
| B4 | Refactor AuthContext dari shim | 🔴 Kritis | 4 jam | ⬜ Belum |
| B5 | React Router future flags | 🟠 Penting | 30 menit | ✅ Sprint 1 |
| B6 | Email reset password | 🟠 Penting | Lihat F1 | ⬜ Belum |
| B7 | Xendit webhook signature | 🟠 Penting | 1 jam | ✅ Sprint 1 |
| B8 | Scheduled jobs | 🟠 Penting | Lihat F3 | ⬜ Belum |
| B9 | Cashback auto-credit | 🟠 Penting | Lihat F7 | ⬜ Belum |
| B10 | Refund saldo transfer | 🟠 Penting | Lihat F4 | ⬜ Belum |
| O1 | Pecah POSKasirPage.tsx | 🔴 High | 1 hari | ⬜ Belum |
| O2 | Upload multipart bukan base64 | 🟠 Penting | 3 jam | ⬜ Belum |
| O3 | staleTime per query | 🟠 Penting | 2 jam | ⬜ Belum |
| O4 | DB join efficiency | 🟠 Penting | 4 jam | ⬜ Belum |
| O5 | SSE connection timeout | 🟢 Minor | 1 jam | ⬜ Belum |
| O8 | Cart localStorage size limit | 🟢 Minor | 30 menit | ⬜ Belum |
| F1 | Email notifikasi (SMTP) | 🔴 Urgent | 2 hari | ⬜ Belum |
| F2 | Object storage persistent | 🔴 Urgent | 1 hari | ⬜ Belum |
| F3 | Cron job / scheduler | 🔴 Urgent | 4 jam | ⬜ Belum |
| F4 | Refund processing otomatis | 🔴 Urgent | 1 hari | ⬜ Belum |
| F5 | Halaman dispute/komplain buyer | 🔴 Urgent | 1 hari | ⬜ Belum |
| F6 | Export laporan PDF/CSV | 🟠 Penting | 1 hari | ⬜ Belum |
| F7 | Cashback logic server-side | 🟠 Penting | 4 jam | ⬜ Belum |
| F8 | Status verifikasi merchant | 🟠 Penting | 6 jam | ⬜ Belum |
| F9 | Analytics merchant lebih kaya | 🟢 Nice | 2 hari | ⬜ Belum |

---

## URUTAN PENGERJAAN YANG DISARANKAN

### Sprint 1 — Keamanan Kritis (1–2 hari)
1. **S1** — Auth INSERT/UPDATE/DELETE *(paling bahaya)*
2. **S2** — Guard DELETE/UPDATE tanpa filter
3. **S5** — Push subscribe verifikasi user
4. **S10** — Validasi password minimum
5. **B5** — React Router future flags *(cepat)*
6. **B7** — Xendit webhook signature

### Sprint 2 — Stabilitas (2–3 hari)
1. **S8** — Session persistent di PostgreSQL
2. **S4** — Token di URL → HttpOnly Cookie
3. **B4** — Refactor AuthContext dari shim
4. **F3** — Cron job / scheduler
5. **S7** — Rate limit server-side

### Sprint 3 — Performance & Data Safety (2–3 hari)
1. **F2** — Object storage persistent *(data bisa hilang kapan saja)*
2. **B1** — POS Dashboard N+1 queries
3. **B2** — useMerchantQuota sequential
4. **S3** — SSE broadcast per-user
5. **O2** — Upload multipart

### Sprint 4 — Fitur Bisnis (3–5 hari)
1. **F1** — Email notifikasi (SMTP)
2. **F4** — Refund processing otomatis
3. **F5** — Halaman dispute/komplain buyer
4. **F7** — Cashback auto-credit
5. **F6** — Export laporan CSV/PDF

---

*File ini diperbarui setiap kali ada item yang selesai dikerjakan.*
