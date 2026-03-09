

# Analisis Keseluruhan Sistem DesaMart — Bug, Kekurangan, dan Rencana Pengembangan

---

## A. BUG AKTIF DAN POTENSI BUG

### Bug 1 (Kritis): Halaman sub-merchant bisa diakses tanpa merchant APPROVED
**File**: Semua `src/pages/merchant/*.tsx` kecuali `MerchantDashboardPage.tsx`
- Route `/merchant/*` tidak punya `allowedRoles` (sudah di-relax sebelumnya)
- `MerchantDashboardPage` sudah handle PENDING/REJECTED, tapi semua sub-page (Products, Orders, Settings, Analytics, dll) TIDAK ada pengecekan `registration_status`
- User dengan merchant PENDING bisa akses `/merchant/products`, `/merchant/orders`, dll langsung via URL
- **Fix**: Buat shared guard hook `useMerchantGuard()` yang return merchant data + redirect ke `/merchant` jika belum APPROVED

### Bug 2 (Kritis): Halaman sub-courier bisa diakses tanpa courier APPROVED
**File**: `src/pages/courier/CourierEarningsPage.tsx`, `CourierHistoryPage.tsx`, `CourierWithdrawalPage.tsx`, `CourierDepositPage.tsx`
- Setiap halaman punya `navigate('/auth')` manual (redundan dengan ProtectedRoute)
- Setiap halaman punya pengecekan APPROVED sendiri-sendiri (duplikasi code)
- Halaman `/courier/chat` dan `/courier/rides` TIDAK punya pengecekan registration_status — bisa diakses user apapun
- **Fix**: Buat shared `useCourierGuard()` hook

### Bug 3 (Sedang): Duplikasi redirect logic auth di courier pages
**File**: Semua courier sub-pages
- `navigate('/auth')` dipanggil manual di setiap page padahal `ProtectedRoute` sudah handle ini
- Potensi race condition: ProtectedRoute redirect ke `/auth` tapi courier page juga coba navigate — bisa flash UI

### Bug 4 (Sedang): Notifications page tidak punya limit query
**File**: `src/pages/NotificationsPage.tsx` baris 47-51
- Query `notifications` tanpa `.limit()` — bisa return ribuan row untuk user aktif
- **Fix**: Tambah `.limit(100)` dan infinite scroll

### Bug 5 (Minor): `CourierEarningsPage` menghitung earnings dari `shipping_cost` bukan dari `courier_earnings` table
**File**: `src/pages/courier/CourierEarningsPage.tsx` baris 111-112
- Kalkulasi manual `shipping_cost * commissionRate` alih-alih pakai data aktual dari tabel `courier_earnings`
- Ini bisa mismatch jika admin ubah rate atau ada earning manual

### Bug 6 (Minor): `DesaDashboardPage` cek `villages.user_id` tapi kolom ini tidak ada di schema
**File**: `src/pages/desa/DesaDashboardPage.tsx` baris 57-61
- Fallback query `villages.eq('user_id', user.id)` — tabel `villages` tidak punya kolom `user_id` di schema
- Hanya `user_villages` junction table yang menghubungkan user ke village

### Bug 7 (Minor): Checkout `merchantIds` dependency menggunakan `merchantIds.join(',')` 
**File**: `src/pages/CheckoutPage.tsx` baris 272, 306
- `useEffect` dependency `merchantIds.join(',')` — ini string baru setiap render karena `merchantIds` array baru dari `useMemo`. Bisa trigger re-fetch berulang.

---

## B. KEKURANGAN FITUR PER ROLE

### Role: Buyer (Pembeli)
1. **Tidak ada halaman profil lengkap** — Edit profil hanya dialog kecil, bukan halaman dedicated
2. **Tidak ada fitur "Pesan Lagi"** dari riwayat pesanan
3. **Tidak ada notifikasi push real** — Hanya in-app notifications tanpa push browser
4. **Tidak ada fitur komplain / dispute** selain refund request
5. **Tidak ada tracking pengiriman real-time** di peta untuk buyer (hanya text status)
6. **Tidak ada fitur favorit toko** (hanya wishlist produk)

### Role: Merchant (Pedagang)
1. **Tidak ada guard halaman sub-merchant** — Semua sub-page bisa diakses tanpa merchant APPROVED
2. **Tidak ada fitur chat list** — Hanya chat per-order, tidak ada inbox semua chat
3. **Tidak ada multi-image upload di product** — `MultipleImageUpload` component ada tapi tidak jelas integrasinya
4. **Tidak ada dashboard ringkasan keuangan** — Ada withdrawal tapi tidak ada laporan keuangan lengkap
5. **Tidak ada fitur bulk edit produk** — Harus edit satu per satu

### Role: Kurir (Courier)
1. **Tidak ada guard konsisten** di sub-pages (`/courier/chat`, `/courier/rides`)
2. **Earnings dihitung manual** dari shipping_cost bukan dari `courier_earnings` table
3. **Tidak ada fitur offline mode** — Kurir di daerah sinyal lemah tidak bisa update status
4. **Tidak ada riwayat ojek** — `CourierHistoryPage` hanya delivery, tidak ada ride history
5. **Tidak ada fitur terima/tolak order** dengan timer — Order langsung di-assign tanpa konfirmasi kurir

### Role: Admin Desa
1. **Dashboard sangat minimal** — Hanya stats tourism dan merchant count
2. **Tidak bisa manage merchant di desa** — Hanya lihat count, tidak bisa review
3. **Tidak ada fitur laporan wisata** — Tidak ada export data pengunjung
4. **Tidak ada fitur event/acara desa**

### Role: Verifikator
1. **Tidak ada halaman manage merchant detail** — Hanya list, tidak bisa lihat detail lengkap merchant
2. **Tidak ada notifikasi merchant baru** di dashboard realtime
3. **Tidak ada fitur visit/kunjungan** untuk verifikasi lapangan

### Role: Admin
1. **Tidak ada dashboard keuangan terintegrasi** — Finance page ada tapi terpisah dari overview
2. **Tidak ada fitur manage user detail** — Users page ada tapi kemampuan terbatas
3. **Tidak ada monitoring realtime** yang sebenarnya — Stats di-fetch sekali, bukan streaming

---

## C. RENCANA PERBAIKAN DAN PENGEMBANGAN

### Fase 1: Perbaikan Bug Kritis (7 file)
1. **Buat `useMerchantGuard` hook** — Shared guard untuk semua merchant sub-pages
   - Return `{ merchant, loading }` + auto-redirect ke `/merchant` jika !APPROVED
   - Apply ke: MerchantProductsPage, MerchantOrdersPage, MerchantSettingsPage, MerchantAnalyticsPage, MerchantReviewsPage, MerchantPromoPage, MerchantWithdrawalPage, dll

2. **Buat `useCourierGuard` hook** — Shared guard untuk semua courier sub-pages
   - Return `{ courier, loading }` + auto-redirect ke `/courier` jika !APPROVED
   - Hapus duplikasi `navigate('/auth')` dan pengecekan manual
   - Apply ke: CourierEarningsPage, CourierHistoryPage, CourierWithdrawalPage, CourierDepositPage, CourierChatPage, CourierRidesPage

3. **Fix NotificationsPage** — Tambah `.limit(100)` pada query

4. **Fix DesaDashboardPage** — Hapus fallback query `villages.user_id`

5. **Fix CheckoutPage** — Stabilkan `useEffect` dependencies

### Fase 2: Peningkatan UX Buyer (3 file)
1. **Tambah "Pesan Lagi"** di OrdersPage — Tombol yang menambahkan semua item order ke cart
2. **Tambah tracking peta real-time** di OrderTrackingPage untuk status DELIVERING/SENT
3. **Tambah fitur favorit toko** — Extend wishlist ke merchant level

### Fase 3: Peningkatan UX Merchant (2 file)
1. **Merchant inbox chat** — List semua conversation aktif
2. **Quick action dari notification** — Klik notifikasi langsung buka order detail

### Fase 4: Peningkatan UX Kurir (2 file)
1. **Fix earnings dari `courier_earnings` table** bukan kalkulasi manual
2. **Tambah ride history di CourierHistoryPage** — Tab untuk ojek + delivery

### Fase 5: Peningkatan Admin Desa (1 file)
1. **Tambah list merchant di desa** dengan link ke detail
2. **Tambah export data wisata**

### Total estimasi: ~15 file diubah, 2 file baru (hooks), 0 migrasi DB

### Prioritas implementasi yang disarankan:
**Fase 1 dahulu** karena ini bug keamanan (user bisa akses halaman tanpa otorisasi proper)

