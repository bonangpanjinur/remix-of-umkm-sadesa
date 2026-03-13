

# Analisis Bug & Rencana Perbaikan

## Bug yang Ditemukan

### BUG 1: `.single()` pada `app_settings` di PaymentConfirmationPage (MEDIUM)
**File:** `src/pages/PaymentConfirmationPage.tsx` (line 89)
Menggunakan `.single()` untuk mengambil `admin_payment_info` dari `app_settings`. Jika key ini belum ada, akan throw PGRST116 error dan menghentikan loading informasi pembayaran.
**Fix:** Ganti `.single()` → `.maybeSingle()`.

### BUG 2: `.single()` pada `app_settings` di CheckoutPage (MEDIUM)
**File:** `src/pages/CheckoutPage.tsx` (line 241)
Query `admin_payment_info` menggunakan `.single()` — jika belum diisi admin, checkout akan error.
**Fix:** Ganti `.single()` → `.maybeSingle()`.

### BUG 3: `.single()` pada `merchants` di CheckoutPage (LOW)
**File:** `src/pages/CheckoutPage.tsx` (line 220)
Query merchant by ID menggunakan `.single()`. Ini aman karena ID pasti unik, tapi jika merchant dihapus sementara ada item di cart, akan crash. Lebih aman pakai `.maybeSingle()` dengan guard.
**Fix:** Ganti `.single()` → `.maybeSingle()` dan tambah guard.

### BUG 4: `.single()` pada `OrdersPage.handleContactSeller` (LOW)
**File:** `src/pages/OrdersPage.tsx` (line 430)
Fetch merchant `user_id` pakai `.single()`. Jika merchant dihapus, akan error.
**Fix:** Ganti `.single()` → `.maybeSingle()`.

### BUG 5: `WishlistPage.handleAddToCart` — Missing `isAvailable` Property (MEDIUM)
**File:** `src/pages/buyer/WishlistPage.tsx` (lines 161-172)
Objek yang dikirim ke `addToCart()` tidak menyertakan `isAvailable: true`. Walau saat ini `isAvailable === false` (bukan `undefined`) yang dicek, ini bisa menyebabkan masalah di masa depan jika guard diperketat.
**Fix:** Tambahkan `isAvailable: true` dan `isMerchantOpen: true` ke objek product.

### BUG 6: `MerchantGroupCard` — `.single()` pada merchant lookup (LOW)
**File:** `src/components/merchant/MerchantGroupCard.tsx` (line 225)
Lookup merchant by `user_id` pakai `.single()` — aman di kasus normal tapi bisa crash jika merchant belum diregistrasi.
**Fix:** Ganti `.single()` → `.maybeSingle()`.

### BUG 7: `codSecurity` — `.single()` pada profiles (MEDIUM)
**File:** `src/lib/codSecurity.ts` (lines 231, 275)
Fungsi `recordCODFailure` dan `checkCODEligibility` pakai `.single()` pada profiles. Jika profil belum dibuat (edge case), akan crash.
**Fix:** Ganti `.single()` → `.maybeSingle()` dan tambah early return.

---

## Rencana Implementasi

### Prioritas 1: Fix `.single()` pada payment flows (Bug 1-2)
- `src/pages/PaymentConfirmationPage.tsx` line 89: `.single()` → `.maybeSingle()`
- `src/pages/CheckoutPage.tsx` line 241: `.single()` → `.maybeSingle()`

### Prioritas 2: Fix `.single()` pada checkout & order contact (Bug 3-4)
- `src/pages/CheckoutPage.tsx` line 220: `.single()` → `.maybeSingle()` + guard
- `src/pages/OrdersPage.tsx` line 430: `.single()` → `.maybeSingle()`

### Prioritas 3: Fix missing product properties di WishlistPage (Bug 5)
- `src/pages/buyer/WishlistPage.tsx` lines 161-172: Tambah `isAvailable`, `isMerchantOpen`, `hasQuota`

### Prioritas 4: Fix `.single()` pada merchant & COD (Bug 6-7)
- `src/components/merchant/MerchantGroupCard.tsx` line 225: `.single()` → `.maybeSingle()`
- `src/lib/codSecurity.ts` lines 231, 275: `.single()` → `.maybeSingle()` + early return

**Total: 6 file diubah, 0 file dihapus, 0 migrasi database**

