

# Rencana Perbaikan & Pengembangan Fitur Ojek Desa

## Analisis Masalah Saat Ini

### Bug & Masalah Fungsional
1. **Reverse geocoding tidak ada** — Saat user tap peta, address hanya "Titik jemput" / "Titik tujuan", bukan alamat sebenarnya
2. **Driver list tidak real-time** — Hanya fetch sekali saat load, tidak subscribe perubahan posisi driver
3. **Tidak ada timeout pencarian** — Status SEARCHING bisa stuck selamanya tanpa auto-cancel
4. **Kurir tidak dapat notifikasi push** saat ada ride baru — hanya realtime postgres_changes yang refresh list
5. **Estimasi waktu tidak ditampilkan** — Buyer hanya lihat jarak & tarif, tidak ada ETA
6. **Input alamat tidak fungsional** — Field address bisa diketik manual tapi tidak melakukan geocoding / search

### Kekurangan UX — Sisi Buyer
1. **Tidak ada konfirmasi sebelum pesan** — Langsung submit tanpa review
2. **Tidak ada indikator loading peta** — Peta leaflet bisa lambat load
3. **Tidak ada animasi searching** yang menarik — Hanya banner static
4. **Tidak bisa batalkan dari halaman booking** jika sudah submit dan kembali
5. **Tidak ada estimasi waktu kedatangan driver** setelah ACCEPTED

### Kekurangan UX — Sisi Kurir
1. **Tidak ada peta di halaman rides** — Kurir tidak bisa lihat visual posisi jemput
2. **Tidak ada info penumpang** (nama) sebelum accept
3. **Tidak ada sound notification** saat ride baru masuk
4. **Tidak bisa lihat rute sebelum accept** — Hanya text alamat

## Rencana Implementasi

### 1. Reverse Geocoding pada Map Click (Buyer)
**File**: `src/pages/ride/RideBookingPage.tsx`
- Import `reverseGeocode` dari `@/hooks/useGeocoding`
- Saat `handleMapClick`, panggil reverse geocode untuk mendapatkan nama jalan/desa
- Update `pickupAddress` / `destAddress` dengan hasil geocoding
- Tambah loading indicator kecil saat geocoding berjalan

### 2. Real-time Driver Position di Booking Page
**File**: `src/pages/ride/RideBookingPage.tsx`
- Subscribe ke Supabase channel untuk `postgres_changes` pada tabel `couriers` (UPDATE)
- Update posisi marker driver secara live
- Tambah interval refresh setiap 15 detik sebagai fallback

### 3. Tambah ETA & Info Waktu
**File**: `src/pages/ride/RideBookingPage.tsx`
- Import `calculateETA`, `formatETA` dari `@/lib/etaCalculation`
- Tampilkan estimasi waktu perjalanan di bottom sheet (di samping jarak & tarif)
- Format: "~12 menit"

### 4. Konfirmasi Sebelum Pesan
**File**: `src/pages/ride/RideBookingPage.tsx`
- Tambah `AlertDialog` konfirmasi sebelum submit
- Tampilkan ringkasan: pickup, tujuan, jarak, tarif, ETA
- Tombol "Konfirmasi Pesan" dan "Batal"

### 5. Auto-cancel Timeout untuk SEARCHING
**File**: `src/pages/ride/RideTrackingPage.tsx`
- Tampilkan countdown timer (misal 5 menit) saat status SEARCHING
- Jika timeout, otomatis update status ke CANCELLED dengan reason "Tidak ada driver tersedia"
- Tampilkan tombol "Coba Lagi" setelah timeout

### 6. Peta Mini di Halaman Rides Kurir
**File**: `src/pages/courier/CourierRidesPage.tsx`
- Tambah peta kecil (150px) di setiap card ride yang menampilkan marker pickup & destination
- Atau tambah 1 peta besar di atas list yang menampilkan semua pickup points
- Gunakan `MapContainer` ringan tanpa interaksi (read-only)

### 7. Sound Notification untuk Kurir
**File**: `src/pages/courier/CourierRidesPage.tsx`
- Tambah audio notification (beep) saat ada ride baru masuk via realtime channel
- Gunakan pattern yang sama dari `CourierDashboardPage` (AudioContext oscillator)

### 8. Info Penumpang & Rute Preview untuk Kurir
**File**: `src/pages/courier/CourierRidesPage.tsx`
- Fetch nama penumpang dari `profiles` table berdasarkan `passenger_id`
- Tampilkan initial/avatar di card ride
- Tambah tombol "Lihat Rute" yang expand peta kecil

### 9. Perbaikan Loading State Peta
**File**: `src/pages/ride/RideBookingPage.tsx`
- Tambah skeleton/spinner overlay saat peta belum load
- Gunakan `whenReady` event dari Leaflet MapContainer

### Total file diubah: 3
1. `src/pages/ride/RideBookingPage.tsx` — Reverse geocoding, realtime drivers, ETA, konfirmasi, loading
2. `src/pages/ride/RideTrackingPage.tsx` — Auto-cancel timeout, ETA driver
3. `src/pages/courier/CourierRidesPage.tsx` — Peta, sound, info penumpang

