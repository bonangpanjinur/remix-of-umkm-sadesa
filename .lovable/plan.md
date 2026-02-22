
# Analisis Bug dan Perbaikan UI/UX - Buyer & Merchant (Batch 3)

## A. BUG YANG DITEMUKAN

### Bug 1: `console.log` masif di `src/lib/api.ts` (Production Leak)
- **File**: `src/lib/api.ts` baris 119, 141, 154, 175, 246, 372, 377, 395, 401, 411, 433
- **Masalah**: 11 statement `console.log` di file API utama yang dipanggil di setiap halaman. Menyebabkan console penuh di production dan memperlambat debugging.
- **Perbaikan**: Hapus semua `console.log` debug, pertahankan hanya `console.error`.

### Bug 2: `getMerchantsWithActiveQuota()` melakukan N+1 query per merchant
- **File**: `src/lib/api.ts` baris 76-96
- **Masalah**: Untuk setiap merchant tanpa subscription, dilakukan query individual ke `orders` untuk cek free tier. Jika ada 50 merchant, ini menghasilkan 50+ query database. Sangat lambat dan menyebabkan homepage loading lama.
- **Perbaikan**: Batch query menggunakan `merchant_id.in(...)` atau gunakan aggregation query.

### Bug 3: `ShopsPage` tidak memfilter merchant berdasarkan `registration_status`
- **File**: `src/pages/ShopsPage.tsx` baris 53-60
- **Masalah**: Query `merchants` tidak menyertakan `.eq('registration_status', 'APPROVED')` atau `.eq('status', 'ACTIVE')`. Merchant yang masih PENDING atau REJECTED bisa muncul di daftar toko (RLS mungkin mencegah ini tergantung user, tapi anon users bisa melihat sesuai policy).
- **Perbaikan**: Tambahkan filter eksplisit `.eq('status', 'ACTIVE').eq('registration_status', 'APPROVED')`.

### Bug 4: `WithdrawalManager` melakukan update balance secara client-side (Race Condition)
- **File**: `src/components/merchant/WithdrawalManager.tsx` baris 158-165
- **Masalah**: Setelah insert `withdrawal_requests`, balance di-update langsung dari client (`available_balance - amount`). Jika dua tab terbuka dan keduanya submit withdrawal bersamaan, saldo bisa minus karena tidak ada locking atau server-side validation.
- **Perbaikan**: Gunakan RPC database function untuk atomic withdrawal atau setidaknya tambahkan validasi server-side.

### Bug 5: `ExplorePage` dan `SearchResultsPage` memiliki `console.log` debug
- **File**: `src/pages/ExplorePage.tsx` baris 51, 57-59
- **Masalah**: Console log di production code.
- **Perbaikan**: Hapus.

### Bug 6: `HelpPage` menggunakan nomor WhatsApp placeholder
- **File**: `src/pages/HelpPage.tsx` baris 98
- **Masalah**: `href="https://wa.me/6281234567890"` dan `support@desamart.id` adalah placeholder yang seharusnya dikonfigurasi dari `app_settings`.
- **Perbaikan**: Fetch dari `app_settings` atau setidaknya tandai sebagai configurable.

### Bug 7: Checkout tidak memvalidasi stok sebelum submit
- **File**: `src/pages/CheckoutPage.tsx` baris 411-584
- **Masalah**: Saat `handleSubmit`, stok produk tidak dicek ulang terhadap database. Jika produk sudah habis antara saat user menambahkan ke keranjang dan saat checkout, pesanan tetap dibuat dan stok bisa minus.
- **Perbaikan**: Tambahkan validasi stok sebelum membuat order.

---

## B. KEKURANGAN UI/UX

### B1. ShopsPage tidak menampilkan status buka/tutup secara visual
- Kartu toko tidak menunjukkan apakah toko sedang buka atau tutup. Buyer baru tahu saat masuk ke detail toko.
- **Perbaikan**: Tambahkan indikator visual (dot hijau/merah atau badge) pada kartu toko.

### B2. ShopsPage tidak menampilkan jumlah produk
- Kartu toko sudah punya data `productCount` tapi tidak ditampilkan di UI.
- **Perbaikan**: Tampilkan jumlah produk pada kartu toko.

### B3. CartPage tidak menampilkan status toko (buka/tutup) per item
- Buyer bisa menambahkan produk saat toko buka, tapi saat checkout toko sudah tutup. CartPage tidak menunjukkan ini.
- **Perbaikan**: Tampilkan indikator status toko pada setiap grup merchant di keranjang.

### B4. ExplorePage menampilkan debug console log
- Sudah disebutkan di Bug 5.

### B5. Merchant halaman produk -- tidak ada indikator `low_stock_threshold`
- Produk dengan stok rendah tidak diberi highlight khusus di tabel produk merchant.
- **Perbaikan**: Tambahkan highlight warning jika stok di bawah threshold.

### B6. MerchantDashboardPage tidak ada tombol "Preview Toko"
- Sudah direncanakan di batch sebelumnya tapi belum diimplementasikan.
- **Perbaikan**: Tambahkan tombol "Lihat Toko Saya" di store status card.

---

## C. RENCANA PERBAIKAN

### Prioritas 1 -- Bug Kritis
1. **Hapus semua `console.log` debug** dari `src/lib/api.ts` dan `src/pages/ExplorePage.tsx`
2. **Fix ShopsPage filter** -- tambah `.eq('status', 'ACTIVE').eq('registration_status', 'APPROVED')`
3. **Fix N+1 query di `getMerchantsWithActiveQuota`** -- batch query order counts
4. **Tambah validasi stok di checkout** -- cek stok real-time sebelum insert order

### Prioritas 2 -- UX Buyer
5. **Tambah indikator buka/tutup di ShopsPage** -- dot + badge pada kartu toko
6. **Tampilkan product count di ShopsPage** -- info jumlah produk per toko
7. **Tambah warning status toko di CartPage** -- indikator per merchant group
8. **Fix HelpPage placeholder** -- fetch kontak dari `app_settings` atau gunakan default yang masuk akal

### Prioritas 3 -- UX Merchant
9. **Tambah tombol "Lihat Toko"** di MerchantDashboardPage store card
10. **Highlight produk stok rendah** di MerchantProductsPage

---

## D. DETAIL TEKNIS

```text
File yang perlu diubah:

1. src/lib/api.ts
   - Hapus 11 console.log statements
   - Refactor getMerchantsWithActiveQuota: batch query order counts
     menggunakan single query dengan group by merchant_id

2. src/pages/ExplorePage.tsx
   - Hapus console.log baris 51, 57-59

3. src/pages/ShopsPage.tsx
   - Tambah .eq('status', 'ACTIVE').eq('registration_status', 'APPROVED')
   - Tambah indikator buka/tutup pada kartu toko
   - Tampilkan productCount

4. src/pages/CartPage.tsx
   - Fetch status toko (is_open) saat mount
   - Tampilkan warning jika toko tutup pada grup merchant

5. src/pages/CheckoutPage.tsx
   - Tambah validasi stok sebelum order creation loop
   - Cek products stock dengan .in('id', productIds)

6. src/pages/merchant/MerchantDashboardPage.tsx
   - Tambah tombol "Lihat Toko Saya" pada store status card

7. src/pages/merchant/MerchantProductsPage.tsx
   - Tambah warning color pada stok rendah (< 5 atau low_stock_threshold)

8. src/pages/HelpPage.tsx
   - Fetch kontak support dari app_settings
   - Fallback ke nilai placeholder saat ini

Total: 8 file, ~10 perbaikan
```
