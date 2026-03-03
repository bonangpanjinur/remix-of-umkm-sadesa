

# Analisis Bug & Rencana Perbaikan + Pengembangan Ojek Desa

## A. Bug yang Ditemukan

### Bug 1: Rating Toko Tidak Pernah Update (KRITIS)
- **Masalah**: Tidak ada trigger database yang memperbarui `merchants.rating_avg` dan `merchants.rating_count` saat review baru di-insert. Nilai rating yang tampil di toko adalah nilai statis dari seed data (4.8, 4.9, dst). Review baru dari buyer tidak berpengaruh terhadap angka rating yang ditampilkan.
- **Akar masalah**: Tabel `reviews` tidak memiliki trigger `AFTER INSERT` untuk recalculate rating di tabel `merchants`.
- **Fix**: Buat DB migration berisi trigger function `update_merchant_rating()` yang menghitung ulang `AVG(rating)` dan `COUNT(*)` dari `reviews` lalu update `merchants.rating_avg` dan `merchants.rating_count`. Trigger dipasang pada `INSERT`, `UPDATE`, dan `DELETE` di tabel `reviews`.

### Bug 2: Checkout PICKUP Masih Validasi Alamat Lengkap (MEDIUM)
- **File**: `CheckoutPage.tsx` baris 346-354
- **Masalah**: Saat user pilih "Ambil Sendiri" (`deliveryType === 'PICKUP'`), validasi masih memaksa `province`, `city`, `district`, `village` terisi. Tapi karena peta disembunyikan (`hideMap=true`) dan manual address selector sudah dihapus, user tidak punya cara untuk mengisi field ini — checkout akan selalu gagal validasi untuk PICKUP jika profil user belum punya alamat.
- **Fix**: Skip validasi `address.province/city/district/village` saat `deliveryType === 'PICKUP'`. Hanya validasi nama dan telepon.

### Bug 3: Checkout Address Form Masih Import AddressSelector yang Tidak Dipakai
- **File**: `CheckoutAddressForm.tsx` baris 5
- **Masalah**: `AddressSelector` masih di-import meskipun sudah tidak dirender setelah penghapusan manual selector. Dead import yang membengkakkan bundle.
- **Fix**: Hapus import `AddressSelector` dan state `showAddressSelector`.

### Bug 4: ReviewsPage Tidak Update Rating Merchant
- **File**: `ReviewsPage.tsx` baris 194-202
- **Masalah**: Setelah insert review, hanya `orders.has_review` yang di-update. Tidak ada mekanisme untuk recalculate `merchants.rating_avg` — ini terkait Bug 1, tapi fix trigger di DB akan menyelesaikan ini secara otomatis.

## B. Rencana Perbaikan

### Fase 1: Fix Rating (1 migrasi DB)
1. **Migrasi SQL**: Buat function `update_merchant_rating()` + trigger pada tabel `reviews`
```text
CREATE FUNCTION update_merchant_rating()
  → SELECT AVG(rating), COUNT(*) FROM reviews WHERE merchant_id = NEW/OLD.merchant_id
  → UPDATE merchants SET rating_avg = avg, rating_count = count
  → TRIGGER on INSERT/UPDATE/DELETE
```

### Fase 2: Fix Checkout (1 file)
2. **`CheckoutPage.tsx`**: Skip validasi address fields saat `deliveryType === 'PICKUP'`
3. **`CheckoutAddressForm.tsx`**: Cleanup dead import `AddressSelector` dan state `showAddressSelector`

## C. Rencana Pengembangan: Fitur Ojek Desa (Ride-hailing)

Fitur ini memungkinkan penumpang memesan ojek untuk perjalanan antar lokasi (bukan hanya pengiriman makanan/barang).

### Arsitektur
```text
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Penumpang    │────▷│  ride_requests   │◁────│  Kurir/Driver    │
│  (Buyer App)  │     │  (tabel baru)    │     │  (Courier App)   │
└──────────────┘     └─────────────────┘     └──────────────────┘
       │                     │                        │
       │  1. Pilih titik     │  3. Broadcast ke       │  4. Accept
       │     jemput & antar  │     driver terdekat     │     ride
       │  2. Lihat estimasi  │                        │  5. Navigate
       │     harga & jarak   │                        │     ke pickup
       └─────────────────────┘                        └──────────────
```

### Database (Migrasi)
- Tabel baru `ride_requests`:
  - `id`, `passenger_id` (uuid → auth.users), `driver_id` (uuid → couriers, nullable)
  - `pickup_lat/lng`, `pickup_address`
  - `destination_lat/lng`, `destination_address`
  - `distance_km`, `estimated_fare`, `final_fare`
  - `status`: `SEARCHING` → `ACCEPTED` → `PICKED_UP` → `IN_TRANSIT` → `COMPLETED` / `CANCELLED`
  - `accepted_at`, `picked_up_at`, `completed_at`, `cancelled_at`, `cancellation_reason`
  - `created_at`, `updated_at`
- RLS policies: passenger bisa buat & lihat miliknya, driver bisa lihat & update yang di-assign, admin full access
- Realtime publication untuk live tracking

### Frontend — Penumpang (3 file baru)
1. **`RideBookingPage.tsx`**: Halaman pesan ojek
   - Peta fullscreen dengan 2 marker (jemput & antar)
   - Input alamat jemput (GPS auto / ketik)
   - Input alamat tujuan
   - Estimasi jarak + tarif (gunakan `app_settings` key `ride_fare_settings`: base_fare, per_km_fare)
   - Tombol "Pesan Ojek" → insert `ride_requests` → subscribe realtime untuk cari driver

2. **`RideTrackingPage.tsx`**: Halaman tracking setelah driver accept
   - Peta realtime posisi driver (subscribe broadcast `courier-tracking-*`)
   - Status timeline: Mencari → Driver Ditemukan → Dijemput → Dalam Perjalanan → Selesai
   - Info driver (nama, kendaraan, foto, nomor HP)
   - Tombol hubungi & batalkan

3. **`RideHistoryPage.tsx`**: Riwayat perjalanan + rating driver

### Frontend — Kurir/Driver (2 file diubah)
4. **`CourierDashboardPage.tsx`**: Tambah tab/section "Ojek" 
   - Daftar ride_requests terdekat yang status SEARCHING
   - Tombol "Terima" → update status ACCEPTED + set driver_id
   - Navigasi ke titik jemput, lalu ke tujuan

5. **`CourierSidebar.tsx`**: Tambah menu "Ojek Desa"

### Frontend — Admin (1 file baru)
6. **`AdminRidesPage.tsx`**: Kelola semua ride requests, lihat statistik, tarif settings

### Routing
- `/ride` → RideBookingPage
- `/ride/:id` → RideTrackingPage  
- `/ride/history` → RideHistoryPage
- `/admin/rides` → AdminRidesPage

### Estimasi Total
- 1 migrasi DB (rating trigger)
- 1 migrasi DB (ride_requests table + RLS + realtime)
- 3 file baru (buyer ride pages)
- 1 file baru (admin rides)
- ~4 file diubah (checkout fix, courier dashboard, sidebar, App.tsx routing)

