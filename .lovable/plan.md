

# Analisis Bug Semua Role: Buyer, Verifikator, Merchant, Admin Desa, Super Admin

## A. BUG LINTAS ROLE

### Bug 1: `console.log` masih tersebar di production code
- **File terdampak**:
  - `src/hooks/useRealtimeStats.ts` -- 5 log statements (baris 157, 180, 199, 218, 237)
  - `src/pages/admin/AdminTransactionQuotaPage.tsx` -- 1 log (baris 159)
  - `src/lib/promotions.ts` -- 2 placeholder logs (baris 66, 72)
  - `src/lib/adminApi.ts` -- 1 log (baris 562)
  - `src/lib/pushNotification.ts` -- 3 logs (baris 44, 50, 81)
- **Dampak**: Console penuh di production, noise saat debugging
- **Fix**: Hapus semua `console.log`, pertahankan `console.error`/`console.warn`

### Bug 2: Placeholder phone di RegisterCourierPage
- **File**: `src/pages/RegisterCourierPage.tsx` baris 198
- **Masalah**: Placeholder masih `08xxxxxxxxxx` padahal validasi telepon sudah diubah untuk menerima format bebas
- **Fix**: Ganti placeholder ke `Nomor telepon`

### Bug 3: Placeholder phone di RegisterVillagePage
- **File**: `src/pages/RegisterVillagePage.tsx` baris 189
- **Masalah**: Placeholder `08xxxxxxxxxx` tidak sesuai dengan validasi telepon baru
- **Fix**: Ganti placeholder

---

## B. BUG BUYER

### Bug 4: Cart menyimpan data produk lama di localStorage
- **File**: `src/contexts/CartContext.tsx`
- **Masalah**: Cart di-persist ke localStorage. Jika harga produk berubah antara session, buyer tetap melihat harga lama sampai produk dihapus/ditambahkan ulang. Checkout akan menggunakan harga lama dari cart, bukan harga terkini dari database.
- **Dampak**: Potensi selisih harga saat checkout. Untungnya `CheckoutPage` sudah fetch harga dari DB, tapi cart UI menampilkan harga lama.
- **Fix**: Saat cart dimuat, validasi harga produk terhadap database

### Bug 5: Buyer route `/buyer/chat` tidak punya `allowedRoles`
- **File**: `src/App.tsx` baris 288-292
- **Masalah**: Route `/buyer/chat` hanya dilindungi `<ProtectedRoute>` tanpa `allowedRoles`. Ini artinya admin, merchant, courier semua bisa mengakses BuyerChatPage. Seharusnya ini tidak masalah karena chat buyer memang milik user sendiri, tapi secara arsitektur, semua role buyer lainnya (seperti `/wishlist`, `/reviews/mine`) juga tidak punya role restriction -- ini konsisten dan by design.
- **Dampak**: Rendah -- hanya inkonsistensi arsitektur, bukan security issue

---

## C. BUG MERCHANT

### Bug 6: `MerchantSettingsPage` slug preview URL salah
- **File**: `src/pages/merchant/MerchantSettingsPage.tsx` baris 300, 318
- **Masalah**: Preview slug ditampilkan sebagai `{origin}/merchant/{slug}`, tapi route sebenarnya di `App.tsx` adalah `/s/:slug` (baris 594). Merchant akan melihat URL yang salah.
- **Fix**: Ganti `/merchant/` ke `/s/` di preview

### Bug 7: Merchant registration tidak assign role `merchant` ke user
- **File**: `src/pages/RegisterMerchantPage.tsx`
- **Masalah**: Saat merchant register, hanya insert ke tabel `merchants`. Tidak ada insert ke `user_roles`. Role `merchant` baru diberikan saat admin approve (`approveMerchant` di `adminApi.ts` baris ~170). Namun jika `merchant_auto_approve` aktif (baris 335-337), status langsung `APPROVED` tapi role masih belum di-assign. User yang auto-approved tidak akan bisa mengakses `/merchant` karena tidak punya role.
- **Fix**: Jika auto-approve enabled, juga insert role `merchant` ke `user_roles`

---

## D. BUG VERIFIKATOR

### Bug 8: Verifikator balance calculation salah
- **File**: `src/pages/verifikator/VerifikatorEarningsPage.tsx` baris 75-78
- **Masalah**: `availableBalance = pendingBalance - pendingWithdrawal`. Ini menghitung saldo tersedia sebagai earning PENDING dikurangi withdrawal PENDING. Seharusnya earning PENDING berarti belum dibayar, jadi bukan saldo yang bisa ditarik. Yang seharusnya tersedia adalah earning yang sudah PAID dikurangi total withdrawal yang sudah APPROVED/COMPLETED dan PENDING.
- **Fix**: Refactor kalkulasi balance agar lebih akurat

### Bug 9: Verifikator tidak bisa melihat detail merchant (sheet)
- **File**: `src/pages/verifikator/VerifikatorMerchantsPage.tsx`
- **Masalah**: `MerchantDetailSheet` digunakan, tapi saat fetch data, hanya kolom terbatas yang diambil. Komponen detail sheet mungkin membutuhkan field tambahan yang tidak di-fetch.
- **Dampak**: Ringan -- sheet tetap bisa terbuka, field kosong ditampilkan sebagai `-`

---

## E. BUG ADMIN DESA

### Bug 10: Admin Desa tidak cek `user_villages` fallback saat kelola wisata
- **File**: `src/pages/desa/DesaTourismPage.tsx` baris 106-118
- **Masalah**: Hanya mengecek `user_villages` table. Jika admin desa di-assign langsung melalui `villages.user_id` (bukan melalui `user_villages`), halaman wisata tidak akan menampilkan data. Sementara `DesaDashboardPage.tsx` (baris 42-66) sudah punya fallback ke `villages.user_id`.
- **Fix**: Tambahkan fallback query ke `villages.user_id` seperti di dashboard

---

## F. BUG ADMIN/SUPER ADMIN

### Bug 11: Admin withdrawal rejection race condition
- **File**: `src/pages/admin/AdminWithdrawalsPage.tsx` baris 148-155
- **Masalah**: Saat menolak withdrawal, balance dikembalikan menggunakan:
  ```
  available_balance = merchant.available_balance + withdrawal.amount
  ```
  Tapi `merchant.available_balance` diambil dari data yang di-fetch sebelumnya (saat halaman load), bukan saat rejection. Jika merchant melakukan transaksi lain antara load dan rejection, balance bisa salah.
- **Fix**: Gunakan increment (`available_balance = available_balance + amount`) bukan absolute set

### Bug 12: Admin refund approval tidak mengembalikan saldo ke merchant balance
- **File**: `src/pages/admin/AdminRefundsPage.tsx` baris 141-147
- **Masalah**: Saat refund disetujui, order status diubah ke `REFUNDED` tapi `merchant.available_balance` tidak dikurangi. Dana refund dibayar dari mana? Seharusnya ada deduction dari merchant balance.
- **Fix**: Kurangi `merchants.available_balance` sebesar refund amount saat approval

### Bug 13: Tiga route admin mengarah ke komponen yang sama
- **File**: `src/App.tsx` baris 379-393
- **Masalah**: `/admin/packages`, `/admin/quota-settings`, dan `/admin/transaction-quota` semuanya render `AdminTransactionQuotaPage`. Ini bukan error, tapi membingungkan dan menghasilkan dead routes.
- **Fix**: Pilih satu canonical URL, redirect sisanya

---

## G. RENCANA PERBAIKAN

### Prioritas 1 -- Bug Kritis (Logika & Data)
1. **Fix merchant auto-approve tanpa role assignment** (RegisterMerchantPage) -- user terperangkap tanpa akses
2. **Fix admin withdrawal rejection race condition** (AdminWithdrawalsPage) -- balance bisa salah
3. **Fix admin refund tanpa deduction** (AdminRefundsPage) -- tidak ada balance deduction
4. **Fix verifikator balance calculation** (VerifikatorEarningsPage) -- saldo tampil salah
5. **Fix DesaTourismPage missing village fallback** -- admin desa tidak bisa kelola wisata

### Prioritas 2 -- Bug Tampilan & UX
6. **Fix merchant slug preview URL** (MerchantSettingsPage) -- `/merchant/` -> `/s/`
7. **Fix placeholder telepon** di RegisterCourierPage dan RegisterVillagePage
8. **Hapus semua console.log production** -- 12+ statements di 5 file

### Prioritas 3 -- Cleanup
9. **Deduplikasi admin routes** -- hapus alias `/admin/packages` dan `/admin/quota-settings`

---

## H. DETAIL TEKNIS

```text
File yang perlu diubah:

1. src/pages/RegisterMerchantPage.tsx
   - Setelah insert merchants dengan auto-approve, juga insert user_roles merchant

2. src/pages/admin/AdminWithdrawalsPage.tsx
   - handleReject: gunakan increment SQL bukan absolute set
   - available_balance = available_balance + amount (via RPC atau raw update)

3. src/pages/admin/AdminRefundsPage.tsx
   - handleProcess (approve): kurangi merchants.available_balance

4. src/pages/verifikator/VerifikatorEarningsPage.tsx
   - Perbaiki kalkulasi availableBalance

5. src/pages/desa/DesaTourismPage.tsx
   - Tambah fallback query villages.user_id

6. src/pages/merchant/MerchantSettingsPage.tsx
   - Ganti slug URL dari /merchant/ ke /s/

7. src/pages/RegisterCourierPage.tsx
   - Fix placeholder telepon

8. src/pages/RegisterVillagePage.tsx
   - Fix placeholder telepon

9. src/hooks/useRealtimeStats.ts
   - Hapus 5 console.log

10. src/pages/admin/AdminTransactionQuotaPage.tsx
    - Hapus 1 console.log

11. src/lib/promotions.ts, adminApi.ts, pushNotification.ts
    - Hapus console.log

12. src/App.tsx
    - Hapus duplicate routes /admin/packages, /admin/quota-settings

Total: 12 file, ~13 perbaikan
```

