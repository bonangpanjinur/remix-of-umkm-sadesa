

# Analisis Bug & Kekurangan UX: Ojek, Kurir, dan Buyer

## A. Bug yang Ditemukan

### Bug 1: BottomNav masih ada menu "Ojek" (HARUS DIHAPUS)
**File**: `src/components/layout/BottomNav.tsx` baris 13
- Menu Ojek (`/ride`) ada di BottomNav — user minta dihapus dari sini
- BottomNav seharusnya hanya: Beranda, Jelajah, Toko, Pesanan, Akun

### Bug 2: Halaman Ojek Booking tidak ada BottomNav / navigasi kembali yang jelas
**File**: `src/pages/ride/RideBookingPage.tsx`
- Layout menggunakan `fixed inset-0` tanpa BottomNav — user terjebak di halaman ini
- Hanya ada tombol back (`ArrowLeft`) yang kecil
- Tidak ada link ke riwayat perjalanan dari halaman booking

### Bug 3: RideTrackingPage & RideHistoryPage tidak ada BottomNav
**File**: `src/pages/ride/RideTrackingPage.tsx`, `src/pages/ride/RideHistoryPage.tsx`
- Kedua halaman hanya punya `Header` tapi tidak ada BottomNav — navigasi putus untuk buyer

### Bug 4: CourierDashboardPage tidak ada link ke Ojek Desa
**File**: `src/pages/CourierDashboardPage.tsx`
- Dashboard kurir hanya menampilkan pesanan pengiriman makanan
- Tidak ada card/link ke `/courier/rides` untuk menerima ojek dari dashboard utama
- Kurir harus tahu dari sidebar saja (yang tersembunyi di mobile)

### Bug 5: CourierRidesPage — tidak ada info jarak ride dari posisi kurir
**File**: `src/pages/courier/CourierRidesPage.tsx`
- Daftar ride available tidak menampilkan jarak dari posisi kurir saat ini
- Kurir tidak bisa prioritaskan ride terdekat

### Bug 6: RideBookingPage — mode "pickup" tetap bisa di-tap setelah GPS set
- Setelah GPS auto-set pickup dan mode pindah ke "destination", user bisa tap input pickup dan mode berubah lagi — membingungkan

## B. Kekurangan UX — Role Buyer

1. **Tidak ada BottomNav di halaman ojek** — Buyer kehilangan navigasi utama saat berada di `/ride`, `/ride/:id`, `/ride/history`
2. **Tidak ada akses ke riwayat ojek dari halaman utama** — Hanya bisa dari `/ride/:id` setelah selesai, tidak ada menu "Riwayat Ojek" di Account page
3. **Halaman booking fullscreen tanpa escape** — Tidak ada tab "Riwayat" atau navigasi tambahan selain tombol back kecil
4. **Tidak ada indikator ride aktif** — Jika buyer punya ride yang sedang berlangsung (SEARCHING/ACCEPTED/PICKED_UP), tidak ada banner/alert di homepage atau booking page

## C. Kekurangan UX — Role Kurir/Driver

1. **Dashboard kurir tidak ada quick access Ojek Desa** — Harus buka sidebar (tersembunyi di mobile) untuk akses `/courier/rides`
2. **Tidak ada badge/notifikasi ride baru** di sidebar atau dashboard
3. **Tidak ada info jarak dari kurir** ke titik jemput di daftar ride available
4. **Tidak ada peta di halaman rides kurir** — Kurir tidak bisa lihat lokasi jemput sebelum accept

## D. Rencana Perbaikan

### 1. Hapus "Ojek" dari BottomNav
**File**: `src/components/layout/BottomNav.tsx`
- Hapus item `{ path: '/ride', icon: Bike, label: 'Ojek' }` dari `navItems`
- BottomNav kembali ke 5 item: Beranda, Jelajah, Toko, Pesanan, Akun

### 2. Tambah BottomNav di halaman ride buyer
**File**: `src/pages/ride/RideHistoryPage.tsx`
- Import dan render `<BottomNav />` di bawah halaman
- Tambah wrapper `mobile-shell` dan `pb-20` untuk spacing

**File**: `src/pages/ride/RideTrackingPage.tsx`
- Import dan render `<BottomNav />` di bawah halaman
- Tambah `pb-20` ke content

**File**: `src/pages/ride/RideBookingPage.tsx`
- Tidak tambah BottomNav (karena fullscreen map), tapi tambahkan:
  - Link/button ke "Riwayat Perjalanan" di header area
  - Banner jika ada ride aktif (query `ride_requests` dengan status SEARCHING/ACCEPTED/PICKED_UP)

### 3. Tambah "Riwayat Ojek" di AccountPage
**File**: `src/pages/AccountPage.tsx`
- Tambah menu item link ke `/ride/history` di section menu buyer, di bawah "Pesanan Terbaru" atau section yang relevan

### 4. Tambah card "Ojek Desa" di CourierDashboardPage
**File**: `src/pages/CourierDashboardPage.tsx`
- Tambah card/link ke `/courier/rides` di area setelah balance card
- Tampilkan jumlah ride available (query count `ride_requests` status SEARCHING)
- Style mirip card History/Earnings yang sudah ada

### 5. Tambah info jarak di CourierRidesPage
**File**: `src/pages/courier/CourierRidesPage.tsx`
- Query posisi kurir dari state/supabase
- Hitung jarak haversine dari posisi kurir ke `pickup_lat/lng` setiap ride
- Tampilkan badge jarak di setiap card ride

### Total: 7 file diubah, 0 file baru, 0 migrasi DB

