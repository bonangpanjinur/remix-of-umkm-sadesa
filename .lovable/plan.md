

# Rencana Perbaikan Bug

## Bug yang Ditemukan

### Bug #1: React forwardRef Warning di RideBookingPage (HIGH — Console Error)
**Lokasi:** `src/components/ui/alert-dialog.tsx` baris 51 (`AlertDialogFooter`) dan baris 46 (`AlertDialogHeader`)

**Masalah:** Komponen `AlertDialogFooter` dan `AlertDialogHeader` adalah function components biasa (bukan `forwardRef`), tapi Radix UI's `Slot` (lewat `Slottable`) berusaha mem-passing ref ke dalamnya. Ini muncul sebagai warning di console:
```
Warning: Function components cannot be given refs.
Check the render method of `RideBookingPage`.
```
Warning muncul setiap kali AlertDialog dirender (di RideBookingPage dan halaman lain yang pakai komponen ini).

**Fix:** Bungkus `AlertDialogFooter` dan `AlertDialogHeader` dengan `React.forwardRef`.

---

### Bug #2: Storage Bucket `payment-proofs` Bersifat Publik (MEDIUM — Security)
**Lokasi:** Database — bucket `storage.buckets`

**Masalah:** Bucket `payment-proofs` saat ini `public = true`, artinya bukti pembayaran (yang bisa berisi info bank/rekening pembeli) dapat diakses dan **di-listing** oleh siapa saja. Linter Supabase juga mengeluhkan ini lewat warning "Public Bucket Allows Listing".

**Fix:** 
- Set `payment-proofs.public = false`
- Tambahkan RLS policy `storage.objects` agar hanya buyer pemilik order, merchant terkait, dan admin yang bisa SELECT file payment-proof
- Update kode upload/baca payment proof untuk pakai signed URL

---

### Bug #3: 9 File Masih Pakai `.single()` Tanpa Guard (LOW-MEDIUM — Stability)
**Lokasi:** 9 file (CheckoutPage, RideBookingPage, RegisterVillagePage, MerchantPOSPage, AssignPackageDialog, VillageAddDialog, useSavedAddresses, AdminBackupPage, AdminBroadcastPage, VerifikatorDashboardPage)

**Masalah:** `.single()` melempar error jika row count ≠ 1. Untuk INSERT umumnya aman, tapi jika ada constraint violation atau RLS reject, error mentah ditampilkan ke user.

**Fix:** Audit setiap penggunaan; ganti ke `.maybeSingle()` untuk read queries dan tambah error handling proper untuk insert queries yang sensitif.

---

### Bug #4: `safeGoBack` Sendiri Pakai `navigate(-1)` Internal (LOW — Verifikasi)
**Lokasi:** `src/lib/utils.ts` baris 10

**Masalah:** Ini sebenarnya **bukan bug** — `navigate(-1)` di dalam `safeGoBack()` adalah implementasi internal yang fallback ke `/` jika history kosong. Hanya perlu diverifikasi logikanya benar.

**Fix:** Verifikasi `safeGoBack` punya guard `window.history.length > 1` sebelum panggil `navigate(-1)`. Jika tidak, perbaiki.

---

## Rencana Implementasi

### Fase 1 — Console Error & Security (Critical)
1. **Fix AlertDialogFooter & AlertDialogHeader** — bungkus dengan `React.forwardRef` di `src/components/ui/alert-dialog.tsx`
2. **Privatisasi bucket `payment-proofs`** via SQL migration:
   - `UPDATE storage.buckets SET public = false WHERE id = 'payment-proofs'`
   - Tambah RLS policy: hanya owner order + merchant + admin bisa SELECT
3. **Update kode payment proof** untuk pakai `createSignedUrl()` saat menampilkan bukti

### Fase 2 — Stability
4. **Verifikasi & perbaiki `safeGoBack`** di `src/lib/utils.ts` — pastikan ada guard history length
5. **Audit & ganti `.single()` → `.maybeSingle()`** pada read queries di 9 file (skip yang murni INSERT-with-select)

**Total: ~12 file diubah, 1 migrasi SQL**

