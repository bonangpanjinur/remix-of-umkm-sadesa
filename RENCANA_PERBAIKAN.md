# DesaMart — Rencana Perbaikan Bug

> Dibuat: 8 Mei 2026 | Stack: React 18 + Vite + Express + PostgreSQL (Replit)

---

## Status Ringkasan

| Prioritas | Total | Selesai | Sisa |
|-----------|-------|---------|------|
| 🔴 Kritis  | 4     | 4       | 0    |
| 🟠 Tinggi  | 4     | 4       | 0    |
| 🟡 Sedang  | 4     | 4       | 0    |
| 🔵 Rendah  | 4     | 3       | 1    |

---

## 🔴 KRITIS — Crash / Auth Mati Total

### K-01: Tabel `public.users` tidak ada ✅ SELESAI
- **Dampak:** Seluruh login/register/validasi sesi crash di server (`server/auth.ts` line 192, 220, 253)
- **Perbaikan:** Buat tabel `users(id, email, full_name, password_hash, replit_id, avatar_url, is_active, last_login_at, created_at, updated_at)`
- **File:** Dieksekusi langsung via SQL pada database

### K-02: Tabel `user_villages` tidak ada ✅ SELESAI
- **Dampak:** Semua halaman Desa Admin, `RegisterVillagePage`, `adminApi`, `DesaDashboardPage`, dll. (14+ file) crash saat fetch data
- **Perbaikan:** Buat tabel `user_villages(id, user_id, village_id, role, created_at)` dengan FK ke `villages`
- **File:** Dieksekusi langsung via SQL pada database

### K-03: Tabel `village_events` tidak ada ✅ SELESAI
- **Dampak:** `DesaEventPage.tsx` dan `VerifikatorEventPage.tsx` crash total — tidak bisa tampil, buat, atau edit event desa
- **Perbaikan:** Buat tabel `village_events` dengan kolom lengkap (title, description, date, village_id, status, dll.)
- **File:** Dieksekusi langsung via SQL pada database

### K-04: Kolom `products.original_price` tidak ada ✅ SELESAI
- **Dampak:** `SearchResultsPage.tsx` (baris 42) query crash → halaman pencarian produk error untuk semua user; `FlashSaleManager.tsx` juga terpengaruh
- **Perbaikan:** `ALTER TABLE products ADD COLUMN original_price INTEGER` + UPDATE set nilai awal = price
- **File:** Dieksekusi langsung via SQL pada database

---

## 🟠 TINGGI — Fitur Utama Tidak Berfungsi

### T-01: Validasi password tidak konsisten ✅ SELESAI
- **Dampak:** Frontend accept min 6 karakter tanpa syarat lain; backend tolak jika < 8 karakter atau tidak mengandung angka → user bingung saat register gagal
- **Perbaikan:** Samakan schema Zod di `AuthPage.tsx` → min 8 char + harus ada huruf + harus ada angka
- **File:** `src/pages/AuthPage.tsx`

### T-02: Push broadcast tanpa pengecekan role admin ✅ SELESAI
- **Dampak:** User biasa yang login bisa kirim push notification ke seluruh pengguna aplikasi
- **Perbaikan:** Tambah cek `authUser.roles.includes('admin')` di awal handler `POST /api/push/broadcast`
- **File:** `server/routes/push.ts`

### T-03: Key `homepage_layout` tidak ada di `app_settings` ✅ SELESAI
- **Dampak:** `useHomepageLayout.ts` dan `BrandingAppearanceSettings.tsx` selalu dapat null → kustomisasi layout homepage tidak tersimpan dan tidak terbaca
- **Perbaikan:** INSERT seed data key `homepage_layout` ke tabel `app_settings`
- **File:** Dieksekusi langsung via SQL pada database

### T-04: Route `/login`, `/auth/login` menghasilkan 404 ✅ SELESAI
- **Dampak:** URL login yang benar adalah `/auth`; semua alias menghasilkan 404 dan halaman "Halamannya Hilang"
- **Perbaikan:** Tambah `<Route path="/login" element={<Navigate to="/auth" replace />} />` dan alias `/auth/login`, `/masuk`
- **File:** `src/App.tsx`

---

## 🟡 SEDANG — Fitur Non-Fungsional / Keamanan

### S-01: `POST /api/pos/sync-stock` adalah placeholder kosong ✅ SELESAI
- **Dampak:** Sync stok antara POS dan marketplace tampak berhasil tapi tidak melakukan apa-apa
- **Perbaikan:** Return HTTP 501 + pesan jelas "belum diimplementasi", log warning ke console
- **File:** `server/index.ts`
- **Sprint 4:** Implementasikan logika sync stok POS ↔ marketplace

### S-02: Webhook `marketplace-order` adalah placeholder ✅ SELESAI
- **Dampak:** Integrasi marketplace → POS menerima data tapi tidak memprosesnya
- **Perbaikan:** Log webhook ke `admin_audit_logs` untuk traceability (non-blocking)
- **File:** `server/index.ts`
- **Sprint 4:** Implementasikan simpan ke `pos_marketplace_orders`

### S-03: CORS default allow semua origin ✅ SELESAI
- **Dampak:** Request dari origin tidak dikenal tidak diblokir di production
- **Perbaikan:** Return HTTP 403 untuk origin tidak dikenal saat `NODE_ENV=production`; di development hanya log warning
- **File:** `server/index.ts`

### S-04: SSE `/subscribe` endpoint non-fungsional ✅ SELESAI
- **Dampak:** Client yang subscribe ke channel tidak menerima event channel-specific (misal: update lokasi kurir)
- **Perbaikan:** Tambah fungsi `addClientChannel(userId, channel)` di `sse-manager.ts`, hubungkan ke handler subscribe
- **File:** `server/routes/sse.ts`, `server/sse-manager.ts`

---

## 🔵 RENDAH — UX / Reliability

### R-01: Race condition di loading roles ✅ SELESAI
- **Dampak:** `loading = false` bisa terjadi sebelum `rolesLoading = false` → halaman protected berkedip "Unauthorized" sejenak
- **Perbaikan:** Ubah urutan di `AuthContext` — set `loading = false` SETELAH `fetchUserRoles` selesai (await, bukan setTimeout)
- **File:** `src/contexts/AuthContext.tsx`

### R-02: SSE reconnect tanpa exponential backoff ✅ SELESAI
- **Dampak:** Di jaringan lambat, koneksi SSE putus-sambung setiap tepat 3 detik, bisa flood server
- **Perbaikan:** Tambah variabel `_sseBackoffMs` — backoff 3s → 6s → 12s → max 60s; reset saat disconnect disengaja
- **File:** `src/integrations/supabase/client.ts`

### R-03: Multi-tab logout tidak sinkron ⬜ BELUM
- **Dampak:** Logout di tab A tidak mempengaruhi tab B sampai ada network request gagal
- **Perbaikan (Sprint 4):** Gunakan `window.addEventListener('storage', ...)` untuk listen perubahan `session_token` di localStorage, lalu trigger logout di semua tab
- **File:** `src/integrations/supabase/client.ts` atau `src/contexts/AuthContext.tsx`

### R-04: WhatsApp log ditulis ke tabel `app_settings` ✅ SELESAI
- **Dampak:** Log `wa_log_xxxxx` ditulis ke tabel konfigurasi → polusi data, sulit dibedakan dari setting asli
- **Perbaikan:** Pindahkan log ke `admin_audit_logs` dengan kolom yang tepat
- **File:** `server/index.ts`

---

## Pekerjaan Sprint 4 (Berikutnya)

| ID | Judul | File Utama |
|----|-------|------------|
| SP4-01 | Implementasi sync stok POS ↔ marketplace | `server/routes/pos.ts` |
| SP4-02 | Simpan `pos_marketplace_orders` dari webhook | `server/index.ts` |
| SP4-03 | Multi-tab logout sync (R-03) | `src/integrations/supabase/client.ts` |
| SP4-04 | Email reset password via SMTP | `server/routes/auth.ts` |
| SP4-05 | File upload persistent (Object Storage) | `server/routes/storage.ts` |
| SP4-06 | Refactor AuthContext dari shim sepenuhnya | `src/contexts/AuthContext.tsx` |
| SP4-07 | Scheduled jobs (expiry voucher, subscription) | `server/cron.ts` (baru) |
| SP4-08 | Cashback auto-credit saat order selesai | `server/routes/orders.ts` |
| SP4-09 | Refund transfer saldo ke pembeli | `server/routes/orders.ts` |

---

## Perubahan Database (Sudah Dijalankan)

```sql
-- K-01
CREATE TABLE public.users (id, email, full_name, password_hash, replit_id, ...);

-- K-02
CREATE TABLE public.user_villages (id, user_id, village_id, role, created_at);

-- K-03
CREATE TABLE public.village_events (id, village_id, title, description, event_date, ...);

-- K-04
ALTER TABLE public.products ADD COLUMN original_price INTEGER;
UPDATE public.products SET original_price = price WHERE original_price IS NULL;

-- T-03
INSERT INTO public.app_settings (key, value, ...) VALUES ('homepage_layout', '{...}', ...);
```
