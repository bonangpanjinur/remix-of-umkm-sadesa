

# Analisis Bug Sistem & Rencana Perbaikan

---

## Bug yang Ditemukan

### BUG 1: `checkPaymentStatus` — Double Request & Dead Code (Severity: HIGH)
**File:** `src/lib/paymentApi.ts` (lines 48-71)

Fungsi `checkPaymentStatus` melakukan **dua request** ke endpoint yang sama:
1. `supabase.functions.invoke(...)` — hasilnya diabaikan (variabel `data` dan `error` tidak digunakan)
2. `fetch(...)` — ini yang sebenarnya dipakai

Request pertama membuang bandwidth dan bisa error secara diam-diam. Parameter `invoiceId` juga tidak diteruskan ke request pertama.

**Fix:** Hapus panggilan `supabase.functions.invoke(...)` yang tidak dipakai. Cukup gunakan `fetch()`.

---

### BUG 2: `isXenditEnabled` Menggunakan `.single()` Tanpa Guard (Severity: MEDIUM)
**File:** `src/lib/paymentApi.ts` (line 81)

`.single()` akan throw PGRST116 jika key `payment_xendit` tidak ada di `app_settings`. Seharusnya `.maybeSingle()`.

**Fix:** Ganti `.single()` → `.maybeSingle()`.

---

### BUG 3: `CheckoutPage` — `.single()` pada `app_settings` (Severity: MEDIUM)
**File:** `src/pages/CheckoutPage.tsx` (line 80)

`supabase.from('app_settings').select('value').eq('key', 'shipping_base_fee').single()` — akan gagal jika setting belum ada. Seharusnya `.maybeSingle()`.

**Fix:** Ganti `.single()` → `.maybeSingle()`.

---

### BUG 4: `RegisterMerchantPage` — `.single()` pada `verifikator_codes` (Severity: LOW)
**File:** `src/pages/RegisterMerchantPage.tsx` (line 274)

Menggunakan `.single()` untuk lookup kode verifikator. Jika kode tidak ditemukan, ini akan throw error alih-alih return null. Seharusnya `.maybeSingle()`.

**Fix:** Ganti `.single()` → `.maybeSingle()`.

---

### BUG 5: `HalalRegistrationInfo` — `.single()` dengan `.limit(1)` (Severity: LOW)
**File:** `src/components/merchant/HalalRegistrationInfo.tsx` (line 27)

`.limit(1).single()` redundan dan `.single()` bisa error jika tidak ada data.

**Fix:** Ganti `.limit(1).single()` → `.limit(1).maybeSingle()`.

---

### BUG 6: Duplicate RLS Policies pada Tabel `orders` (Severity: MEDIUM)
**Database:** Tabel `orders` memiliki **policy yang tumpang tindih**:
- `orders_buyer_access` (FOR ALL) dan `Buyers can create/view/update own orders` (spesifik per command)
- `orders_merchant_access` (FOR ALL) menggunakan `is_order_merchant(id)` (1-param) dan `Merchants can view/update` menggunakan `is_order_merchant(auth.uid(), merchant_id)` (2-param)
- `orders_courier_access` (FOR ALL) dan `Couriers can view/update assigned orders`

Ini menyebabkan evaluasi RLS ganda (performance hit) dan potensi konflik logika.

**Fix:** Hapus policy duplikat via migrasi — cukup pertahankan versi `FOR ALL` yang lebih sederhana (`orders_admin_access`, `orders_buyer_access`, `orders_merchant_access`, `orders_courier_access`), lalu hapus yang granular.

---

### BUG 7: Duplicate RLS Policies pada Tabel `couriers` (Severity: LOW)
**Database:** Tabel `couriers` memiliki policy redundan:
- `couriers_admin_access` (is_admin()) vs `Admins can manage couriers` (has_role 'admin')
- `couriers_own_access` (FOR ALL) vs `Couriers can view/update own data`
- `couriers_public_read` vs `Public can view approved couriers`

**Fix:** Hapus policy duplikat, pertahankan satu set yang konsisten.

---

### BUG 8: Duplicate RLS Policies pada Tabel `merchants` (Severity: LOW)
**Database:** Tabel `merchants` memiliki:
- `Authenticated users can view active merchants` dan `Authenticated users view active merchants basic info` — dua policy SELECT yang overlap
- `Merchants can view own data` sudah dicakup oleh `Authenticated users view active merchants basic info`

**Fix:** Konsolidasi menjadi satu policy SELECT untuk authenticated users.

---

### BUG 9: `useRealtimeOrders` — Stale Closure pada `onNewOrder`/`onOrderUpdate` (Severity: MEDIUM)
**File:** `src/hooks/useRealtimeOrders.ts` (line 124)

`useEffect` dependency array menyertakan `onNewOrder` dan `onOrderUpdate` — callback ini kemungkinan berubah setiap render, menyebabkan channel di-subscribe/unsubscribe terus-menerus.

**Fix:** Gunakan `useRef` untuk menyimpan callback, dan hapus dari dependency array.

---

### BUG 10: `BottomNav` — Polling setiap 30 detik tanpa cleanup saat logout (Severity: LOW)
**File:** `src/components/layout/BottomNav.tsx` (line 51)

Interval refresh badge berjalan terus bahkan ketika user sudah logout (karena dependency hanya `[user]` dan initial render mungkin sudah ada user).

**Fix:** Sudah benar — interval di-clear saat effect re-run. Tidak perlu perubahan.

---

## Rencana Implementasi

### Prioritas 1: Fix `checkPaymentStatus` dead code (Bug 1)
- Hapus `supabase.functions.invoke(...)` call yang tidak digunakan
- 1 file: `src/lib/paymentApi.ts`

### Prioritas 2: Fix semua `.single()` yang seharusnya `.maybeSingle()` (Bug 2-5)
- `src/lib/paymentApi.ts` line 81
- `src/pages/CheckoutPage.tsx` line 80
- `src/pages/RegisterMerchantPage.tsx` line 274
- `src/components/merchant/HalalRegistrationInfo.tsx` line 27

### Prioritas 3: Fix stale closure pada `useRealtimeOrders` (Bug 9)
- `src/hooks/useRealtimeOrders.ts` — gunakan `useRef` untuk callback

### Prioritas 4: Cleanup duplicate RLS policies (Bug 6-8)
- Satu migrasi SQL untuk DROP policy duplikat pada `orders`, `couriers`, `merchants`

**Total: 5 file kode + 1 migrasi database**

