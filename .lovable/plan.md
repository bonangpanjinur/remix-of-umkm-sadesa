

# Analisis Komprehensif: Bug, Fitur Kurang, dan Rencana Perbaikan

## A. Bug yang Ditemukan

### Bug 1: Ojek Desa — Tidak Ada Akses dari BottomNav / Homepage (KRITIS UX)
- **Masalah**: Fitur Ojek Desa sudah ada (`/ride`, `/ride/:id`, `/ride/history`) tapi **tidak ada akses navigasi** dari BottomNav, Homepage, atau menu buyer. Penumpang harus ketik URL manual.
- **Fix**: Tambah tombol/menu "Ojek Desa" di Homepage (Quick Access Grid) dan/atau BottomNav atau halaman Explore.

### Bug 2: Ojek Desa — Tracking Page Tidak Ada Peta Real-time (MEDIUM)
- **File**: `RideTrackingPage.tsx`
- **Masalah**: Halaman tracking hanya menampilkan status timeline berbasis teks. Tidak ada komponen `CourierMap` untuk lihat posisi driver secara real-time, padahal infrastruktur broadcast sudah tersedia.
- **Fix**: Integrasikan `CourierMap` di `RideTrackingPage` dengan `courierId` dari driver yang accept ride.

### Bug 3: Ojek Desa — Tidak Ada Rating Setelah Perjalanan Selesai (MEDIUM)
- **Masalah**: Kolom `rating` dan `rating_comment` sudah ada di tabel `ride_requests`, tapi `RideTrackingPage` dan `RideHistoryPage` tidak punya UI untuk submit rating setelah COMPLETED.
- **Fix**: Tambah dialog/inline rating di `RideTrackingPage` saat status COMPLETED.

### Bug 4: Ojek Desa — Race Condition saat Accept Ride (MEDIUM)
- **File**: `CourierRidesPage.tsx` baris 118-126
- **Masalah**: Dua driver bisa accept ride yang sama secara bersamaan. Query `.eq('status', 'SEARCHING')` tidak atomic. Bisa terjadi 2 driver ter-assign ke 1 penumpang.
- **Fix**: Buat RPC function `accept_ride` yang melakukan update + check dalam satu transaksi atomik.

### Bug 5: Ojek Desa — Penumpang Bisa Cancel Setelah ACCEPTED (LOW)
- **File**: `RideTrackingPage.tsx` baris 159
- **Masalah**: `canCancel = ['SEARCHING', 'ACCEPTED'].includes(ride.status)` — penumpang bisa batalkan setelah driver sudah diterima tanpa notifikasi ke driver.
- **Fix**: Tambah konfirmasi "Driver sudah ditemukan, yakin batalkan?" dan kirim notifikasi ke driver.

### Bug 6: Checkout — `formatFullAddress` Import dari AddressSelector (MINOR)
- **File**: `CheckoutPage.tsx` baris 19
- **Masalah**: `import { formatFullAddress } from '@/components/AddressSelector'` — import dari komponen UI yang seharusnya utility. Bukan bug fungsional tapi code smell.

### Bug 7: BottomNav — Status Order yang Tidak Valid di Filter (MINOR)
- **File**: `BottomNav.tsx` baris 44
- **Masalah**: `.in('status', [..., 'PROCESSING', 'ON_DELIVERY'])` — status `PROCESSING` dan `ON_DELIVERY` tidak ada dalam `STATUS_CONFIG` di `OrdersPage.tsx`. Seharusnya `PROCESSED` dan `DELIVERING`.

### Bug 8: Merchant Orders — Kurir Desa Button Masih Workaround (MEDIUM)
- **File**: `MerchantOrdersPage.tsx` baris 753-758
- **Masalah**: Tombol "Kurir Desa" masih workaround (`TODO: open courier assign dialog`) — hanya set status ke PROCESSED tanpa benar-benar membuka dialog assign kurir. Pesanan butuh langkah ekstra dari dropdown.

## B. Fitur yang Kurang

### Buyer
1. **Tidak ada entrypoint Ojek Desa** — butuh tombol di Homepage atau BottomNav
2. **Tidak ada rating driver ojek** — tabel sudah support, UI belum
3. **Tidak ada notifikasi push ke penumpang** saat driver accept ride
4. **Tidak ada peta di tracking ojek** — hanya teks

### Merchant
1. **Kurir Desa button masih workaround** — tidak langsung buka dialog assign
2. **Tidak ada notifikasi ke merchant** saat pesanan ojek lewat dekat toko mereka (future)

### Kurir/Driver
1. **Tidak ada notifikasi push** saat ada ride baru di area mereka
2. **Tidak ada filter jarak** di daftar ride available — semua ride ditampilkan tanpa filter proximity
3. **Tidak ada earnings tracking khusus ojek** — pendapatan ride belum terintegrasi ke `courier_earnings`

### Admin
1. **Admin Rides Page** tidak ada pengaturan tarif inline — harus ke Settings
2. **Admin tidak bisa cancel/force-complete** ride dari halaman admin rides

## C. Rencana Perbaikan & Pengembangan

### Fase 1: Fix Bug Ojek + Integrasi (5 file diubah)

1. **`src/pages/Index.tsx`** — Tambah card "Ojek Desa" di Quick Access atau Hero section dengan link ke `/ride`

2. **`src/pages/ride/RideTrackingPage.tsx`**:
   - Integrasikan `CourierMap` dengan `courierId={ride.driver_id}` untuk peta real-time
   - Tambah dialog rating saat status COMPLETED (update `ride_requests.rating` dan `rating_comment`)
   - Tambah konfirmasi cancel saat status ACCEPTED

3. **`src/pages/ride/RideHistoryPage.tsx`** — Tampilkan rating bintang yang sudah diberikan, tombol "Beri Rating" untuk yang belum

4. **`src/components/layout/BottomNav.tsx`** — Fix status filter: ganti `PROCESSING` → `PROCESSED`, `ON_DELIVERY` → `DELIVERING`

5. **`src/pages/courier/CourierRidesPage.tsx`** — Tambah info jarak ride dari posisi kurir saat ini

### Fase 2: Atomic Accept + Earnings (1 migrasi DB, 2 file)

6. **Migrasi SQL**: Buat RPC `accept_ride(p_ride_id UUID, p_courier_id UUID)` yang:
   - Cek status masih SEARCHING
   - Update status ke ACCEPTED + set driver_id dalam satu transaksi
   - Return success/fail (mencegah race condition)

7. **`CourierRidesPage.tsx`** — Ganti direct update dengan `supabase.rpc('accept_ride', ...)`

8. **`CourierRidesPage.tsx`** — Saat COMPLETED, insert ke `courier_earnings` dengan type `'RIDE'`

### Fase 3: Fix Merchant Kurir Assignment (1 file)

9. **`MerchantOrdersPage.tsx`** — Import dan gunakan `CourierAssignDialog` langsung dari tombol "Kurir Desa" di detail dialog, bukan workaround PROCESSED

### Total Estimasi:
- 1 migrasi DB (RPC `accept_ride`)
- 0 file baru
- ~7 file diubah
- Tidak ada tabel baru

