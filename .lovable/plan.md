
# Analisis Kebutuhan UX Buyer -- Bug, Perbaikan, dan Penyempurnaan

## A. BUG YANG DITEMUKAN

### Bug 1: `console.log` debug di `ProductsPage.tsx`
- **File**: `src/pages/ProductsPage.tsx` baris 26-28
- **Masalah**: Dua statement `console.log` debug (`'Loading products data via fetchProducts...'` dan `'Products data loaded:'`) masih ada di production.
- **Perbaikan**: Hapus kedua `console.log`.

### Bug 2: `OrdersPage` tidak menggunakan `mobile-shell` wrapper
- **File**: `src/pages/OrdersPage.tsx` baris 391, 413
- **Masalah**: Halaman pesanan menggunakan `<div className="min-h-screen ...">` bukan `mobile-shell`. Pada layar lebar, konten melebar tanpa batas 480px, tidak konsisten dengan halaman lain.
- **Perbaikan**: Ganti wrapper ke `mobile-shell`.

### Bug 3: `OrdersPage` header tidak menggunakan `Header` component
- **File**: `src/pages/OrdersPage.tsx` baris 415-431
- **Masalah**: Halaman pesanan menggunakan custom header berwarna `bg-primary` yang berbeda dari semua halaman buyer lainnya (yang menggunakan komponen `<Header />`). Ini menyebabkan inkonsistensi navigasi -- tidak ada tombol Cart, Chat, atau Search di halaman pesanan.
- **Perbaikan**: Gunakan `Header` standar + section judul di bawahnya, atau pertahankan custom header tapi tambahkan navigasi kembali.

### Bug 4: `SearchResultsPage` memuat SEMUA data client-side
- **File**: `src/pages/SearchResultsPage.tsx` baris 41-56
- **Masalah**: `fetchProducts()`, `fetchVillages()`, `fetchTourism()` memuat semua data ke client lalu filter di memori. Untuk database besar ini sangat lambat dan boros bandwidth. Seharusnya menggunakan server-side search (`searchApi.ts` sudah ada tapi tidak digunakan di sini).
- **Perbaikan**: Gunakan `fetchAutocompleteSuggestions` atau query Supabase dengan `.ilike()` filter langsung di server.

### Bug 5: Halaman produk detail tidak menampilkan multiple images
- **File**: `src/pages/ProductDetail.tsx` baris 197-231
- **Masalah**: Hanya satu gambar produk ditampilkan. Tabel `product_images` dan komponen `MultipleImageUpload` sudah ada di merchant side, tapi ProductDetail hanya menampilkan `product.image` (single image). Buyer tidak bisa melihat foto produk dari berbagai sudut.
- **Perbaikan**: Fetch `product_images` dan tampilkan sebagai carousel/gallery.

### Bug 6: `PaymentConfirmationPage` tidak ada countdown/deadline
- **File**: `src/pages/PaymentConfirmationPage.tsx`
- **Masalah**: Meskipun `confirmation_deadline` sudah disimpan di database, halaman pembayaran tidak menampilkan batas waktu pembayaran. Buyer tidak tahu kapan pesanan akan otomatis dibatalkan jika tidak membayar.
- **Perbaikan**: Fetch `confirmation_deadline` dan tampilkan countdown timer.

---

## B. KEKURANGAN UX DAN PENYEMPURNAAN

### B1. Homepage tidak ada "Pull to Refresh"
- **Masalah**: Homepage (`Index.tsx`) tidak mendukung pull-to-refresh atau tombol refresh manual. Data hanya dimuat sekali saat mount. Jika ada produk baru atau promo baru, buyer harus reload browser.
- **Perbaikan**: Tambahkan tombol refresh atau mekanisme pull-to-refresh.

### B2. Tidak ada halaman "Semua Produk" yang mudah diakses dari homepage
- **Masalah**: Homepage menampilkan produk di grid, tapi tidak ada link "Lihat Semua Produk" yang jelas. BottomNav punya `/explore` tapi bukan halaman produk murni. Halaman `/products` ada tapi tidak terhubung dari mana pun secara eksplisit.
- **Perbaikan**: Tambahkan link "Lihat Semua" di section produk homepage yang mengarah ke `/products`.

### B3. Product Detail tidak ada tombol "Beli Langsung"
- **Masalah**: Satu-satunya CTA di ProductDetail adalah "Tambah ke Keranjang" yang langsung redirect ke `/cart`. Tidak ada opsi "Beli Langsung" (langsung ke checkout tanpa melewati cart) untuk pembelian cepat.
- **Perbaikan**: Tambahkan tombol "Beli Langsung" selain "Tambah ke Keranjang".

### B4. Tidak ada konfirmasi setelah "Tambah ke Keranjang" di ProductDetail
- **Masalah**: Di `ProductDetail.tsx` baris 186-188, setelah `addToCart`, user langsung di-navigate ke `/cart`. Ini memutus browsing -- jika user ingin menambahkan beberapa produk, mereka harus terus bolak-balik.
- **Perbaikan**: Tampilkan toast konfirmasi dengan opsi "Lihat Keranjang" alih-alih langsung navigate. Biarkan user tetap di halaman produk.

### B5. Tidak ada indikator "Terjual" (sold count) di kartu produk
- **Masalah**: Kartu produk (`ProductCard`, `ProductCardHorizontal`) tidak menampilkan jumlah terjual. Ini penting untuk social proof -- buyer lebih percaya pada produk yang sudah banyak terjual.
- **Perbaikan**: Fetch `sold_count` dari produk dan tampilkan di kartu (misalnya "50+ terjual").

### B6. Checkout flow tidak ada step indicator
- **Masalah**: `CheckoutPage.tsx` adalah satu halaman panjang tanpa progress indicator. Buyer tidak tahu ada berapa langkah tersisa (alamat, pengiriman, pembayaran, konfirmasi).
- **Perbaikan**: Tambahkan step indicator sederhana di atas form checkout.

### B7. Order tracking tidak ada tombol "Konfirmasi Diterima" yang menonjol
- **Masalah**: Di `OrderTrackingPage.tsx`, saat status `DELIVERED`, tombol "Pesanan Diterima" memang ada tapi terlihat kecil dan bisa terlewat. Buyer sering lupa mengkonfirmasi penerimaan.
- **Perbaikan**: Buat tombol konfirmasi lebih menonjol dengan animasi atau highlight khusus saat status DELIVERED.

### B8. Tidak ada fitur "Bandingkan Produk"
- **Masalah**: Buyer yang melihat produk serupa dari beberapa toko tidak bisa membandingkan harga/spesifikasi secara langsung.
- **Perbaikan**: Ini fitur lanjutan -- bisa ditandai sebagai "Coming Soon" atau diabaikan untuk sekarang.

---

## C. RENCANA PERBAIKAN (Prioritas)

### Prioritas 1 -- Bug dan Inkonsistensi
1. **Hapus console.log di ProductsPage** -- 2 baris debug
2. **Fix OrdersPage layout** -- ganti ke mobile-shell + tambah navigasi konsisten
3. **Perbaiki addToCart flow di ProductDetail** -- toast + opsi alih-alih redirect langsung

### Prioritas 2 -- UX Penting
4. **Tampilkan multiple product images** -- fetch product_images, tampilkan carousel
5. **Tambah countdown di PaymentConfirmationPage** -- tampilkan batas waktu bayar
6. **Tambah link "Lihat Semua Produk" di homepage** -- section header dengan link
7. **Tambah sold count di ProductCard** -- social proof

### Prioritas 3 -- UX Nice-to-Have
8. **Tambah tombol "Beli Langsung" di ProductDetail** -- shortcut ke checkout
9. **SearchResultsPage: server-side search** -- query dengan .ilike() langsung
10. **Step indicator di CheckoutPage** -- visual progress

---

## D. DETAIL TEKNIS

```text
File yang perlu diubah:

1. src/pages/ProductsPage.tsx
   - Hapus console.log baris 26, 28

2. src/pages/OrdersPage.tsx
   - Ganti wrapper dari "min-h-screen" ke "mobile-shell"
   - Opsi: tambahkan back button atau gunakan Header standar

3. src/pages/ProductDetail.tsx
   - Baris 186-188: Ganti navigate('/cart') dengan toast + opsi
   - Tambah fetch product_images untuk gallery/carousel
   - Opsional: tambah tombol "Beli Langsung"

4. src/pages/PaymentConfirmationPage.tsx
   - Fetch confirmation_deadline dari orders table
   - Tambah countdown timer component

5. src/pages/Index.tsx
   - Tambah link "Lihat Semua" pada section "Produk Terdekat" (mengarah ke /products)

6. src/components/ProductCard.tsx
   - Tampilkan sold_count jika > 0 (e.g. "50+ terjual")

7. src/pages/SearchResultsPage.tsx
   - Refactor ke server-side search menggunakan .ilike() atau text search

Total: 7 file utama, ~10 perbaikan
```
