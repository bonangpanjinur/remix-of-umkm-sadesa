

# Analisis Kekurangan Fitur & Rencana Perbaikan

## A. Fitur yang Kurang untuk Pembeli (Buyer)

### 1. Tidak Ada Estimasi Waktu Pengiriman (ETA) di Order Tracking
**Masalah:** Halaman `OrderTrackingPage` menampilkan status dan peta, tapi tidak menunjukkan estimasi kapan pesanan sampai. Library `etaCalculation.ts` sudah ada tapi tidak digunakan di halaman tracking pembeli.

**Fix:** Tampilkan ETA berdasarkan jarak kurir ke tujuan (kalkulasi Haversine + kecepatan rata-rata). Update real-time saat posisi kurir berubah.
- File: `src/pages/OrderTrackingPage.tsx`

### 2. Tidak Ada Notifikasi Real-time untuk Perubahan Status Pesanan
**Masalah:** `OrdersPage` hanya fetch sekali saat load. Tidak ada realtime subscription — pembeli harus manual refresh untuk melihat update status.

**Fix:** Tambah Supabase realtime subscription pada tabel `orders` filtered by `buyer_id` untuk auto-update status pesanan.
- File: `src/pages/OrdersPage.tsx`

### 3. Tidak Ada Rating Setelah Ride Selesai (Ojek)
**Masalah:** `RideTrackingPage` sudah punya dialog rating, tapi tidak ada prompt otomatis. Rating bisa terlewat karena user harus klik manual.

**Fix:** Auto-show rating dialog 2 detik setelah status berubah ke `COMPLETED`.
- File: `src/pages/ride/RideTrackingPage.tsx`

### 4. Cart Tidak Validasi Stok Real-time
**Masalah:** `CartContext` menyimpan data produk dari saat ditambahkan. Jika stok habis atau harga berubah sebelum checkout, pembeli tidak tahu sampai error di checkout.

**Fix:** Tambah validasi stok saat buka halaman cart — bandingkan stok aktual dari DB, tampilkan warning jika stok kurang atau produk sudah tidak aktif.
- File: `src/pages/CartPage.tsx`

### 5. Tidak Ada Riwayat Chat yang Bisa Diakses dari Akun
**Masalah:** Chat hanya bisa diakses dari konteks pesanan tertentu. Tidak ada halaman daftar chat untuk pembeli (berbeda dengan `MerchantChatPage` dan `CourierChatPage` yang sudah ada).

**Fix:** Buat `BuyerChatPage` yang sudah ada tapi perlu diverifikasi apakah terintegrasi dengan baik dan bisa diakses dari menu Account.
- File: `src/pages/buyer/BuyerChatPage.tsx`, `src/pages/AccountPage.tsx`

---

## B. Fitur yang Kurang untuk Ojek Desa

### 6. Driver Tidak Bisa Melihat Riwayat Pendapatan per Ride
**Masalah:** `CourierEarningsPage` menampilkan pendapatan dari delivery saja. Pendapatan dari ojek (ride) tidak terpisah dan tidak ditampilkan secara detail.

**Fix:** Tambah tab atau section "Pendapatan Ojek" di halaman earnings kurir yang query dari `ride_requests` WHERE `status = 'COMPLETED'` dan `driver_id` matches.
- File: `src/pages/courier/CourierEarningsPage.tsx`

### 7. Tidak Ada Notifikasi Push untuk Ride Baru
**Masalah:** `CourierRidesPage` sudah punya notifikasi suara in-app, tapi tidak ada push notification saat app di background. Driver bisa kehilangan pesanan.

**Fix:** Tambah insert ke tabel `notifications` saat ride request dibuat, targetkan semua kurir aktif di radius tertentu.
- File: Migrasi SQL (trigger pada `ride_requests` INSERT)

### 8. Penumpang Tidak Bisa Chat dengan Driver
**Masalah:** Fitur `OrderChat` sudah mendukung `buyer_courier` chat type, tapi di `RideTrackingPage` tidak ada tombol chat ke driver.

**Fix:** Tambah tombol chat di `RideTrackingPage` saat status `ACCEPTED` atau `PICKED_UP`, menggunakan komponen `OrderChat` yang sudah ada.
- File: `src/pages/ride/RideTrackingPage.tsx`

---

## C. Fitur yang Kurang untuk Pedagang (Merchant)

### 9. Tidak Ada Notifikasi Suara untuk Pesanan Baru di Dashboard
**Masalah:** `MerchantDashboardPage` menggunakan `useRealtimeOrders` untuk real-time updates, tapi tidak ada notifikasi suara saat pesanan baru masuk (berbeda dengan `CourierRidesPage` yang sudah ada suara).

**Fix:** Tambah audio notification (beep) saat `onNewOrder` callback dipanggil dari realtime hook, dengan toggle on/off yang sudah ada di settings (`notification_sound_enabled`).
- File: `src/pages/merchant/MerchantDashboardPage.tsx`

### 10. Tidak Ada Ringkasan Pendapatan Harian yang Bisa Di-export
**Masalah:** `DailySummaryCard` dan chart menampilkan data, tapi `SalesExport` hanya tersedia di halaman analytics. Merchant tidak bisa quick-export dari dashboard.

**Fix:** Tambah tombol export CSV/PDF ringkas di `DailySummaryCard`.
- File: `src/components/merchant/DailySummaryCard.tsx`

### 11. Merchant Tidak Bisa Melihat Lokasi Kurir Sebelum Assign
**Masalah:** `CourierAssignDialog` menampilkan daftar kurir tersedia, tapi tidak ada peta preview posisi kurir relatif terhadap toko sebelum merchant memilih. `CourierMapSelector` ada tapi tidak diintegrasikan ke dialog assign.

**Fix:** Embed `CourierMapSelector` ke dalam `CourierAssignDialog` sebagai tab/view alternatif.
- File: `src/components/admin/CourierAssignDialog.tsx`

---

## Rencana Implementasi (Prioritas)

### Fase 1 — Buyer Experience (Dampak Tinggi)
1. **ETA di Order Tracking** — `OrderTrackingPage.tsx` (+30 baris)
2. **Realtime order status** — `OrdersPage.tsx` (+25 baris subscription)
3. **Validasi stok di Cart** — `CartPage.tsx` (+40 baris)

### Fase 2 — Ojek Improvements
4. **Chat penumpang-driver** — `RideTrackingPage.tsx` (+20 baris)
5. **Auto-show rating dialog** — `RideTrackingPage.tsx` (+10 baris)
6. **Pendapatan ojek terpisah** — `CourierEarningsPage.tsx` (+50 baris)

### Fase 3 — Merchant Productivity
7. **Notifikasi suara pesanan baru** — `MerchantDashboardPage.tsx` (+30 baris)
8. **Peta kurir di assign dialog** — `CourierAssignDialog.tsx` (+15 baris)
9. **Export dari daily summary** — `DailySummaryCard.tsx` (+25 baris)

### Fase 4 — Backend Support
10. **Push notif ride baru** — 1 migrasi SQL (trigger)
11. **Buyer chat page integration** — verifikasi `BuyerChatPage` + link di Account

**Total: ~11 file diubah/ditambah, 1 migrasi database**

