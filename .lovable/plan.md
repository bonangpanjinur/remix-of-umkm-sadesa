
# Analisis dan Rencana Perbaikan Menu Akun

## A. BUG YANG DITEMUKAN

### Bug 1: Wishlist "Add to Cart" menggunakan `stock: 99` hardcoded
- **File**: `src/pages/buyer/WishlistPage.tsx` baris 99
- **Masalah**: Sama seperti bug reorder sebelumnya, saat menambah item wishlist ke keranjang, stok di-hardcode `99`. User bisa memesan melebihi stok sebenarnya.
- **Perbaikan**: Fetch stok aktual dari tabel `products` sebelum menambahkan ke keranjang.

### Bug 2: Wishlist "Add to Cart" tidak menyertakan `merchantId`
- **File**: `src/pages/buyer/WishlistPage.tsx` baris 94
- **Masalah**: `merchantId` diisi string kosong `''`. Ini menyebabkan pengelompokan keranjang berdasarkan toko tidak berfungsi, dan checkout bisa error karena `merchant_id` kosong.
- **Perbaikan**: Fetch `merchant_id` dari relasi produk dan sertakan saat addToCart.

### Bug 3: MyReviewsPage melakukan N+1 query
- **File**: `src/pages/buyer/MyReviewsPage.tsx` baris 51-61
- **Masalah**: Untuk setiap review, dilakukan query terpisah ke `products` dan `merchants` (loop `for` dengan `await`). Jika user punya 20 review, ini menghasilkan 40+ query database. Sangat lambat dan tidak efisien.
- **Perbaikan**: Kumpulkan semua `product_id` dan `merchant_id`, lalu batch query menggunakan `.in()`.

### Bug 4: ReviewsPage tidak memvalidasi review-images storage bucket
- **File**: `src/pages/buyer/ReviewsPage.tsx` baris 147-149
- **Masalah**: Upload ke bucket `review-images` yang mungkin belum ada. Tidak ada error handling yang jelas jika bucket tidak tersedia.
- **Perbaikan**: Tambahkan error handling yang informatif.

### Bug 5: Halaman Pengaturan (SettingsPage) -- fitur non-fungsional
- **File**: `src/pages/SettingsPage.tsx` baris 66-94
- **Masalah**: Kartu "Tampilan" (Mode Gelap) dan "Bahasa" hanya menampilkan teks statis tanpa interaksi apapun. Tombol "Kebijakan Privasi" dan "Syarat & Ketentuan" di-`disabled`. Ini membingungkan pengguna karena terlihat seperti fitur yang rusak.
- **Perbaikan**: Tambahkan toggle dark mode yang fungsional menggunakan `next-themes` (sudah terinstall), dan tambahkan catatan "Segera hadir" pada fitur yang belum tersedia.

### Bug 6: handleProfileSave menimpa data alamat
- **File**: `src/pages/AccountPage.tsx` baris 70-73
- **Masalah**: Saat `handleProfileSave` dipanggil, semua field alamat (province_id, city_id, dll) di-reset ke `null` karena spread `...data` tidak mengandung field alamat. Data alamat yang sudah disimpan oleh `ProfileEditor` (langsung ke Supabase) tetap aman di database, tapi state lokal menjadi tidak sinkron -- alamat hilang dari tampilan sampai halaman di-refresh.
- **Perbaikan**: Setelah save, refetch profil dari database alih-alih merge manual.

### Bug 7: Terakhir Dilihat menggunakan localStorage saja
- **File**: `src/pages/buyer/RecentlyViewedPage.tsx`
- **Masalah**: Data "Terakhir Dilihat" disimpan hanya di localStorage, bukan di database (`page_views` table sudah ada). Ini berarti:
  - Data hilang saat user ganti device/browser
  - Data hilang saat clear cache
  - Tidak sinkron dengan `page_views` yang sudah di-track ke database oleh `trackPageView`
- **Perbaikan**: Tetap gunakan localStorage untuk performa, tapi tambahkan fallback fetch dari tabel `page_views` jika localStorage kosong.

### Bug 8: NotificationsPage tidak menggunakan mobile-shell layout
- **File**: `src/pages/NotificationsPage.tsx` baris 133
- **Masalah**: Menggunakan `<div className="min-h-screen ...">` bukan `<div className="mobile-shell ...">` seperti halaman lain. Ini menyebabkan layout inkonsisten pada layar lebar -- konten melebar tanpa batas.
- **Perbaikan**: Ganti wrapper ke `mobile-shell` dan gunakan `Header` komponen yang konsisten.

---

## B. KEKURANGAN UX

### B1. Menu duplikat di Akun
- **Masalah**: Quick Access Grid (baris 220-238) dan daftar menu (baris 308-395) menampilkan item yang sama: Chat, Wishlist, Alamat, dan Bantuan muncul di kedua tempat. Ini membingungkan dan membuang ruang.
- **Perbaikan**: Quick Access Grid cukup untuk shortcut. Hapus duplikasi di menu list, atau bedakan kontennya.

### B2. Menu "Pesanan Saya" menggunakan ikon Store
- **File**: `AccountPage.tsx` baris 314
- **Masalah**: Menu "Pesanan Saya" menggunakan ikon `Store` (toko), bukan ikon yang mewakili pesanan seperti `Package` atau `ShoppingBag`.
- **Perbaikan**: Ganti ikon ke `Package`.

### B3. Menu list tidak tersembunyi untuk user yang belum login
- **Masalah**: Menu seperti "Pesanan Saya", "Wishlist", "Ulasan Saya", "Terakhir Dilihat", "Alamat Tersimpan", "Notifikasi" tetap tampil meskipun user belum login. Klik akan redirect ke auth, tapi ini UX yang buruk.
- **Perbaikan**: Bungkus menu list dalam kondisi `{user && (...)}` agar hanya tampil saat login.

### B4. Tidak ada fitur "Hapus Akun"
- **Masalah**: Di bagian Privasi & Keamanan (SettingsPage), tidak ada opsi untuk menghapus akun. Ini bisa menjadi masalah regulasi privasi data.
- **Perbaikan**: Tambahkan tombol "Hapus Akun" dengan konfirmasi dialog dan proses penghapusan.

### B5. Tidak ada fitur "Ubah Password"
- **Masalah**: Tidak ada cara bagi user untuk mengganti password dari halaman Pengaturan.
- **Perbaikan**: Tambahkan opsi "Ubah Password" di kartu Privasi & Keamanan.

---

## C. RENCANA PERBAIKAN (Prioritas)

### Prioritas 1 -- Bug Kritis (Data Integrity)
1. Fix Wishlist addToCart: stock hardcode dan merchantId kosong
2. Fix handleProfileSave: refetch profile setelah save
3. Fix NotificationsPage layout: gunakan mobile-shell

### Prioritas 2 -- Performance
4. Fix MyReviewsPage N+1 query: batch fetch dengan `.in()`

### Prioritas 3 -- UX
5. Hapus duplikasi menu di AccountPage
6. Fix ikon "Pesanan Saya" (Store -> Package)
7. Sembunyikan menu list untuk user yang belum login
8. Aktifkan dark mode toggle di SettingsPage
9. Tambahkan fitur Ubah Password di SettingsPage

### Prioritas 4 -- Nice to Have
10. Sinkronisasi "Terakhir Dilihat" dengan tabel page_views
11. Tambah tombol "Hapus Akun" di SettingsPage
12. Tampilkan label "Segera hadir" pada fitur Bahasa

---

## D. DETAIL TEKNIS

```text
File yang perlu diubah:

1. src/pages/buyer/WishlistPage.tsx
   - Fix addToCart: fetch stok dan merchant_id aktual dari products table
   - Ganti stock: 99 dan merchantId: '' dengan data real

2. src/pages/AccountPage.tsx
   - handleProfileSave: panggil fetchProfile() setelah save alih-alih merge manual
   - Hapus duplikasi menu (quick grid vs menu list)
   - Ganti ikon Store -> Package untuk "Pesanan Saya"
   - Bungkus menu list dalam {user && (...)}

3. src/pages/buyer/MyReviewsPage.tsx
   - Ganti loop for-await dengan batch query menggunakan .in()
   - Kumpulkan product_ids dan merchant_ids, query sekali

4. src/pages/NotificationsPage.tsx
   - Ganti wrapper div ke mobile-shell
   - Gunakan komponen Header yang konsisten

5. src/pages/SettingsPage.tsx
   - Tambah dark mode toggle fungsional (useTheme dari next-themes)
   - Tambah fitur "Ubah Password" (supabase.auth.updateUser)
   - Ubah tombol disabled jadi "Segera hadir" label
   - Tambah tombol "Hapus Akun" (opsional)

Total: 5 file, ~12 perbaikan
```
