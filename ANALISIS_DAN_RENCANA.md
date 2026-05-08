# DesaMart — Panduan Pengerjaan Sprint 4

> Stack: React 18 + Vite + Express + PostgreSQL (Replit)
> Update terakhir: Sprint 3 selesai — Sprint 4 belum dimulai
> **File ini adalah panduan implementasi, bukan dokumen analisis.**

---

## PROGRESS SPRINT

| Sprint | Selesai | Item |
|---|---|---|
| ✅ Sprint 1 | 6 item | S1, S2, S5, S10, B5, B7 |
| ✅ Sprint 2 | 5 item | S3, S4, S6, S7, S8 |
| ✅ Sprint 3 | 5 item | **B1, B2, O5, S9, O1** |
| 🔄 Sprint 4 (berikutnya) | 0/9 | B3, B4, B6, B8, B9, B10, O2, O3, O4 |

---

## SPRINT 4 — URUTAN PENGERJAAN

```
B6 → B3 → B4 → O2 → B8 → B9 → B10 → O3 → O4
```

Estimasi total: **~2–3 hari kerja**

---

## B6 — Email Reset Password

**Estimasi:** 2 jam
**Status:** ⬜ Belum
**File:** `server/routes/auth.ts`

Tambahkan endpoint `/api/auth/forgot-password` yang mengirim email reset menggunakan SMTP (env: SMTP_HOST, SMTP_USER, SMTP_PASS).

---

## B3 — File Upload Persistent (Object Storage)

**Estimasi:** 3 jam
**Status:** ⬜ Belum
**File:** `server/routes/storage.ts`

Saat ini file upload disimpan di folder `uploads/` lokal — hilang setiap deploy ulang. Perlu migrasi ke Replit Object Storage atau persistent volume.

---

## B4 — Refactor AuthContext dari Shim

**Estimasi:** 2 jam
**Status:** ⬜ Belum
**File:** `src/contexts/AuthContext.tsx`

AuthContext masih menggunakan shim Supabase. Perlu diganti agar sepenuhnya pakai session server (`/api/auth/me`).

---

## O2 — Upload Multipart (Ganti Base64)

**Estimasi:** 2 jam
**Status:** ⬜ Belum
**File:** `server/routes/storage.ts`, komponen upload di frontend

Saat ini upload menggunakan base64 (boros bandwidth 33%). Ganti dengan multipart/form-data menggunakan `multer`.

---

## B8 — Scheduled Jobs

**Estimasi:** 3 jam
**Status:** ⬜ Belum

Beberapa fitur butuh job terjadwal: expiry voucher, expiry subscription, dll. Implementasi dengan `node-cron` di server.

---

## B9 — Cashback Auto-Credit

**Estimasi:** 2 jam
**Status:** ⬜ Belum

Cashback dari order selesai belum otomatis dikreditkan ke saldo pelanggan.

---

## B10 — Refund Saldo Transfer

**Estimasi:** 3 jam
**Status:** ⬜ Belum

Refund order belum memindahkan saldo kembali ke pembeli.

---

## O3 — staleTime per Query

**Estimasi:** 1 jam
**Status:** ⬜ Belum

Beberapa query React Query tidak punya `staleTime` sehingga refetch terlalu sering.

---

## O4 — DB Join Efficiency

**Estimasi:** 2 jam
**Status:** ⬜ Belum

Beberapa endpoint masih melakukan N+1 query. Optimasi dengan JOIN atau CTE.

---

## STATUS ITEM LENGKAP

| ID | Judul | Sprint | Status |
|---|---|---|---|
| S1 | Auth di INSERT/UPDATE/DELETE | 1 | ✅ Selesai |
| S2 | Guard DELETE/UPDATE tanpa filter | 1 | ✅ Selesai |
| S3 | SSE broadcast per-user | 2 | ✅ Selesai |
| S4 | Token di URL → exchange code | 2 | ✅ Selesai |
| S5 | Push subscribe verifikasi user | 1 | ✅ Selesai |
| S6 | CORS restrict origin | 2 | ✅ Selesai |
| S7 | Rate limit di server | 2 | ✅ Selesai |
| S8 | Session persistent di DB | 2 | ✅ Selesai |
| S9 | Validasi magic bytes file upload | 3 | ✅ Selesai |
| S10 | Validasi kekuatan password | 1 | ✅ Selesai |
| B1 | POS Dashboard N+1 queries | 3 | ✅ Selesai |
| B2 | useMerchantQuota sequential | 3 | ✅ Selesai |
| B3 | File upload tidak persistent | 4 | ⬜ Sprint 4 |
| B4 | Refactor AuthContext dari shim | 4 | ⬜ Sprint 4 |
| B5 | React Router future flags | 1 | ✅ Selesai |
| B6 | Email reset password | 4 | ⬜ Sprint 4 |
| B7 | Xendit webhook signature | 1 | ✅ Selesai |
| B8 | Scheduled jobs tidak ada | 4 | ⬜ Sprint 4 |
| B9 | Cashback auto-credit | 4 | ⬜ Sprint 4 |
| B10 | Refund saldo transfer | 4 | ⬜ Sprint 4 |
| O1 | Pecah POSKasirPage.tsx | 3 | ✅ Selesai |
| O2 | Upload multipart bukan base64 | 4 | ⬜ Sprint 4 |
| O3 | staleTime per query | 4 | ⬜ Sprint 4 |
| O4 | DB join efficiency | 4 | ⬜ Sprint 4 |
| O5 | SSE connection max timeout | 3 | ✅ Selesai |
| O6 | useMerchantQuota paralel | 3 | ✅ Selesai (= B2) |
| O7 | Suspense fallback konsisten | 4 | ⬜ Sprint 4 |
| O8 | Cart localStorage size limit | 4 | ⬜ Sprint 4 |
| F1 | Email notifikasi (SMTP) | 4 | ⬜ Sprint 4 |
| F2 | Object storage persistent | 4 | ⬜ Sprint 4 |
| F3 | Cron job / scheduler | 4 | ⬜ Sprint 4 |
| F4 | Refund processing otomatis | 4 | ⬜ Sprint 4 |
| F5 | Halaman dispute/komplain buyer | 4 | ⬜ Sprint 4 |
| F6 | Export laporan PDF/CSV | 4 | ⬜ Sprint 4 |
| F7 | Cashback auto-credit server | 4 | ⬜ Sprint 4 |
| F8 | Status verifikasi merchant | 4 | ⬜ Sprint 4 |
| F9 | Analytics merchant richer | 4 | ⬜ Sprint 4 |
