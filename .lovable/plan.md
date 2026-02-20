
# Perbaikan Frontend: Merchant, Wisata, Pesanan & Bug Fixes

## 1. Merchant Profile Page -- Share Button Fix

**Masalah:** `ShareStoreButton` menggunakan `/store/${merchantId}` sebagai fallback URL, tapi route yang terdaftar di `App.tsx` adalah `/merchant/:id` dan `/store/:id` (keduanya ada). Namun yang lebih penting, saat merchant punya `slug`, link `/s/${slug}` sudah benar. Masalahnya mungkin di cara copy URL yang tidak konsisten.

**Perbaikan di `src/components/merchant/ShareStoreButton.tsx`:**
- Pastikan URL menggunakan route yang sesuai: prioritaskan `/s/${slug}` jika ada slug, fallback ke `/merchant/${merchantId}` (lebih standar)
- Tambahkan prefix `https://` jika belum ada di origin

## 2. Halal Certificate -- Icon + Modal

**Masalah:** Sertifikat halal saat ini ditampilkan sebagai gambar besar langsung di halaman. Seharusnya cukup ikon kecil, dan baru muncul modal/popup saat diklik.

**Perbaikan di `src/pages/MerchantProfilePage.tsx`:**
- Hapus section besar sertifikat halal (baris 356-373 yang menampilkan gambar full)
- Badge "HALAL" yang sudah ada di baris 301-306 tetap dipertahankan sebagai ikon
- Tambahkan state `showHalalModal` dan `Dialog` component
- Klik badge HALAL akan membuka modal yang menampilkan gambar sertifikat

## 3. Chat Penjual Button Fix

**Masalah:** Tombol "Chat Penjual" hanya berfungsi jika pembeli punya order aktif dengan merchant tersebut. Jika tidak ada order, fallback ke WhatsApp -- tapi jika merchant tidak punya nomor telepon, tidak terjadi apa-apa.

**Perbaikan di `src/pages/MerchantProfilePage.tsx`:**
- Jika user belum login: arahkan ke halaman login
- Jika tidak ada order aktif DAN tidak ada nomor telepon: tampilkan toast info "Buat pesanan terlebih dahulu untuk chat dengan penjual"
- Tampilkan tombol "Chat Penjual" selalu (tidak hanya kalau merchant punya phone)
- Jika ada order aktif: buka chat in-app
- Jika tidak ada order tapi ada phone: buka WhatsApp
- Jika tidak ada keduanya: tampilkan notifikasi

## 4. UI/UX Merchant Profile Polish

**Perbaikan di `src/pages/MerchantProfilePage.tsx`:**
- Fix layout yang broken di area "Quick Info" (baris 342-374) -- ada tag penutup `div` yang salah tempat, menyebabkan sertifikat halal berada di dalam Quick Info section
- Rapikan spacing dan visual consistency

## 5. Tourism Page -- Tambah Filter

**Masalah:** Halaman wisata (`TourismPage.tsx`) tidak punya filter sama sekali, hanya list polos.

**Perbaikan di `src/pages/TourismPage.tsx`:**
- Tambahkan filter berdasarkan:
  - **Pencarian** (search bar by nama)
  - **Fasilitas** (dari data `facilities` array di tabel tourism)
  - **Desa/Village** (dari relasi village_id)
- Tambahkan sort: "Terdekat" (default jika GPS aktif) atau "Terpopuler" (by view_count)
- Gunakan UI pattern yang mirip dengan `ExplorePage` -- search bar + filter chips

## 6. Saran Improvisasi Bagian Pesanan

**Perbaikan di `src/pages/OrdersPage.tsx`:**
- Tambahkan pull-to-refresh visual feedback yang lebih baik
- Tambahkan estimasi waktu di status card (misal: "Pesanan baru ~30 menit yang lalu")
- Tambahkan fitur "Hubungi Penjual" langsung dari card order
- Tambahkan progress bar visual di setiap card (misal: step 1 of 4 completed)

## 7. Bug Fixes Lainnya

**Console Error: HeroCarousel ref warning**
- File: `src/components/home/HeroCarousel.tsx`
- Tambahkan `React.forwardRef` wrapper

---

## Detail Teknis -- File yang Diubah

### `src/components/merchant/ShareStoreButton.tsx`
- Fix URL generation: gunakan `/s/${slug}` atau `/merchant/${merchantId}`

### `src/pages/MerchantProfilePage.tsx`
- Fix broken HTML nesting di Quick Info section (div closing tags)
- Hapus inline halal certificate image, ganti dengan modal on click badge
- Perbaiki chat button logic agar selalu muncul dan handle semua case
- Import `Dialog` components

### `src/pages/TourismPage.tsx`
- Tambahkan state untuk search, filter fasilitas, filter desa, sort mode
- Fetch villages data untuk filter dropdown
- Implementasi filter + search UI
- Tambahkan empty state yang informatif

### `src/pages/OrdersPage.tsx`
- Tambahkan progress indicator visual per order card
- Tambahkan relative time ("30 menit lalu")
- Tambahkan quick action "Hubungi Penjual"

### `src/components/home/HeroCarousel.tsx`
- Wrap dengan `React.forwardRef` untuk fix console warning
