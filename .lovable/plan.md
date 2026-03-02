

# Analisis Bug, UX, dan Rencana Perbaikan Komprehensif

## A. Bug yang Ditemukan

### Bug 1: Checkout - `payment_method` tidak disinkronkan saat PICKUP
- **File**: `CheckoutPage.tsx` baris 352-354
- **Masalah**: Saat `deliveryType === 'PICKUP'`, validasi masih meminta lokasi peta (`if (!addressData.location)`), padahal seharusnya tidak perlu
- **Dampak**: User yang pilih "Ambil Sendiri" tetap harus set titik lokasi di peta

### Bug 2: Checkout - Shipping cost tetap dihitung saat free shipping threshold tercapai
- **File**: `CheckoutPage.tsx` baris 107-120
- **Masalah**: `shippingCost` tidak pernah menjadi 0 saat `subtotal >= free_shipping_min_order`. Free shipping badge ditampilkan (baris 1099) tapi biaya tetap dihitung
- **Fix**: Tambah kondisi `if (subtotal >= (shippingSettings?.free_shipping_min_order ?? Infinity)) return 0;`

### Bug 3: OrdersPage - Tombol "Bayar Sekarang" muncul untuk status NEW (COD)
- **File**: `OrdersPage.tsx` baris 665
- **Masalah**: `['NEW', 'PENDING_PAYMENT'].includes(order.status)` menampilkan tombol "Bayar Sekarang" untuk semua pesanan NEW, padahal pesanan COD dengan status NEW tidak perlu bayar -- harus cek `payment_method`
- **Fix**: Cek `payment_method !== 'COD'` sebelum tampilkan tombol bayar

### Bug 4: Admin - Duplikat tombol "Batalkan" di dropdown
- **File**: `AdminOrdersPage.tsx` baris 338-368
- **Masalah**: Ada dua `DropdownMenuItem` yang menampilkan "Tolak Pesanan" dan "Batalkan" untuk status NEW/PROCESSED -- redundan

### Bug 5: Merchant - Kurir Desa button langsung set status ASSIGNED tanpa assign courier_id
- **File**: `MerchantOrdersPage.tsx` baris 752-769
- **Masalah**: Klik "Kurir Desa" langsung update status ke ASSIGNED tapi tidak membuka `CourierAssignDialog` -- pesanan stuck tanpa kurir
- **Fix**: Buka dialog assign kurir alih-alih langsung update status

### Bug 6: Courier Dashboard - Tidak fetch pesanan DELIVERING
- **File**: `CourierDashboardPage.tsx` baris 146
- **Masalah**: `.in('status', ['ASSIGNED', 'PICKED_UP', 'SENT'])` tidak termasuk `DELIVERING`, jadi pesanan self-delivery merchant tidak muncul (ini mungkin intentional, tapi inkonsisten)

### Bug 7: Checkout - `free_shipping_min_order` tidak di-apply ke shipping calculation
- **File**: `CheckoutPage.tsx` baris 107-120
- **Masalah**: `shippingSettings.free_shipping_min_order` di-load tapi tidak dipakai dalam `shippingCost` calculation

## B. Kekurangan UX

### Buyer
1. **Checkout**: Tidak ada loading state saat reverse geocoding -- user bingung kenapa peta "stuck"
2. **Checkout**: Bottom summary bar terlalu tinggi (estimasi ~180px), makan ruang scrollable
3. **Orders**: Tidak ada pull-to-refresh, hanya tombol refresh kecil
4. **Orders**: Tidak ada indikator pesanan COD vs Transfer di kartu pesanan
5. **Tracking**: Peta hanya muncul jika kurir ada GPS -- tidak ada fallback info saat kurir belum aktifkan GPS

### Merchant
1. **Detail Pesanan**: Tidak ada peta mini untuk lihat lokasi pembeli saat PROCESSED
2. **Kurir Desa**: Tidak ada akses ke `CourierAssignDialog` / `CourierMapSelector` dari detail dialog -- hanya "Kurir Desa" button yang langsung set ASSIGNED
3. **Stats**: Tidak ada filter periode (hari ini / minggu ini / bulan ini)
4. **Export CSV**: Tidak include subtotal terpisah dari total

### Kurir
1. **Dashboard**: Tidak ada info pendapatan hari ini (harus ke halaman terpisah)
2. **Dashboard**: Tidak ada peta overview semua pesanan aktif
3. **Order Card**: Tidak ada estimasi jarak & waktu tempuh ke merchant (pickup point)
4. **Chat**: Kurir tidak bisa chat dengan buyer langsung dari dashboard

### Admin
1. **Pesanan**: Tidak ada bulk action (approve multiple, assign multiple)
2. **Pesanan**: Detail dialog (`OrderDetailsDialog`) tidak punya tombol assign kurir langsung -- harus tutup dialog dulu, lalu klik dropdown
3. **Pesanan**: Tidak ada filter by merchant

## C. Rencana Perbaikan (Prioritas Tinggi)

### Fase 1: Fix Bug Kritis (7 file)

1. **`CheckoutPage.tsx`**
   - Fix: Skip validasi lokasi saat `deliveryType === 'PICKUP'`
   - Fix: Implement free shipping logic di `shippingCost` useMemo
   - Kompakkan bottom summary bar

2. **`OrdersPage.tsx`**
   - Fix: Sembunyikan "Bayar Sekarang" untuk pesanan COD
   - Tambah badge metode pembayaran (COD/Transfer) di kartu pesanan
   - Fetch `payment_method` di query

3. **`AdminOrdersPage.tsx`**
   - Fix: Hapus duplikat tombol batalkan
   - Tambah tombol "Assign Kurir" langsung di detail dialog

4. **`MerchantOrdersPage.tsx`**
   - Fix: "Kurir Desa" button → buka `CourierAssignDialog` bukan langsung set ASSIGNED
   - Tambah state untuk courier assign dialog
   - Pass `delivery_lat/lng` dan `merchant location` ke dialog

5. **`CourierDashboardPage.tsx`**
   - Tambah info pendapatan hari ini (fetch dari `courier_earnings` WHERE `created_at = today`)
   - Tambah info merchant name & alamat pickup di order card

6. **`OrderDetailsDialog.tsx`**
   - Tambah tombol "Tugaskan Kurir" di dalam dialog (bukan hanya di dropdown luar)

7. **`CheckoutAddressForm.tsx`**
   - Minor: Perbaiki border highlight saat detail address kosong tapi location sudah ada

### Fase 2: Fitur UX Enhancement (5 file)

8. **`OrdersPage.tsx`** - Tambah badge payment method di setiap kartu pesanan, fetch `payment_method` dari query

9. **`MerchantOrdersPage.tsx`** - Integrate `CourierAssignDialog` dengan `CourierMapSelector` saat merchant pilih "Kurir Desa"

10. **`CourierDashboardPage.tsx`** - Tambah card "Pendapatan Hari Ini" dan info pickup merchant

11. **`CheckoutPage.tsx`** - Ringkasan pembayaran lebih compact, free shipping badge functional

12. **`AdminOrdersPage.tsx`** - Tambah aksi assign kurir dari dalam detail dialog

## Total: ~7 file diubah, 0 migrasi database, 0 file baru

