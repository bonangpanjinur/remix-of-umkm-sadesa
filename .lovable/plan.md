
# Analisis UI/UX dan Bug - Buyer & Merchant

## A. BUG YANG DITEMUKAN

### Bug 1: Tombol "Beri Rating" mengarah ke route yang mungkin error
- **Lokasi**: `OrdersPage.tsx` baris 604
- **Masalah**: Tombol navigasi ke `/orders/${order.id}/review` tapi route ini mengarah ke `ReviewsPage` yang mungkin tidak menerima `orderId` param dengan benar. Perlu verifikasi apakah `ReviewsPage` menghandle param ini.

### Bug 2: Reorder menggunakan `stock: 99` hardcoded
- **Lokasi**: `OrdersPage.tsx` baris 303
- **Masalah**: Saat user menekan "Pesan Lagi", produk ditambahkan ke keranjang dengan `stock: 99` hardcoded, bukan stok aktual. Ini bisa menyebabkan user memesan melebihi stok.

### Bug 3: Cart tidak validasi stok maksimum saat menambah quantity
- **Lokasi**: `CartPage.tsx` baris 147
- **Masalah**: Tombol `+` pada quantity di keranjang tidak ada batas maksimum berdasarkan stok produk. User bisa menambah quantity tanpa batas.

### Bug 4: Realtime order update di OrdersPage menggunakan stale closure
- **Lokasi**: `OrdersPage.tsx` baris 271
- **Masalah**: `orders` dalam dependency realtime subscribe mereferensi state lama karena `orders` tidak ada di dependency array useEffect (baris 286). Toast notifikasi mungkin tidak akurat.

### Bug 5: Halaman homepage menampilkan data kosong tanpa fallback yang jelas
- **Lokasi**: `Index.tsx`
- **Masalah**: Console log menunjukkan semua data (products, villages, tourism) kosong. Tidak ada empty state atau CTA untuk admin/merchant menambah data ketika database kosong.

### Bug 6: ShopsPage menampilkan `console.log` di production
- **Lokasi**: `ShopsPage.tsx` baris 50, 62, 102
- **Masalah**: Debug `console.log` statements dibiarkan di production code.

---

## B. KEKURANGAN UI/UX - BUYER

### B1. Homepage kosong tidak informatif
- Ketika belum ada produk/desa/wisata, halaman langsung kosong tanpa pesan atau panduan.
- **Perbaikan**: Tampilkan empty state dengan ilustrasi dan CTA "Mulai Jelajahi" atau info bahwa platform baru diluncurkan.

### B2. Keranjang tidak menampilkan status ketersediaan real-time
- Produk di keranjang tidak dicek ulang ketersediaannya (stok, toko buka/tutup) sebelum checkout.
- **Perbaikan**: Tambahkan pengecekan ketersediaan saat membuka CartPage, tandai item yang sudah tidak tersedia.

### B3. Halaman Pesanan - tab badge menggunakan warna yang sulit dibaca
- Badge count pada tab filter (baris 426) menggunakan `bg-current/10` yang transparansinya tergantung warna parent, bisa tidak terlihat.
- **Perbaikan**: Gunakan warna badge yang konsisten dan kontras tinggi.

### B4. Tidak ada konfirmasi sebelum "Hapus Semua" di keranjang
- Tombol "Hapus Semua" langsung menghapus tanpa konfirmasi dialog.
- **Perbaikan**: Tambahkan dialog konfirmasi sebelum menghapus seluruh keranjang.

### B5. Halaman Auth tidak menampilkan link "Lupa Password" saat mode register
- Ini sudah benar, tapi saat login, posisi "Lupa password" terlalu dekat dengan tombol submit, rentan tertekan tidak sengaja di mobile.
- **Perbaikan**: Beri jarak yang lebih baik atau pindahkan di bawah form.

### B6. ProductDetail - sticky bottom bar menggunakan `position: absolute`
- **Lokasi**: `ProductDetail.tsx` baris 377
- **Masalah**: Menggunakan `absolute` bukan `fixed` atau `sticky`, sehingga bisa tertutup saat scroll panjang.

---

## C. KEKURANGAN UI/UX - MERCHANT

### C1. MerchantSidebar tidak menandai sub-route dengan benar
- **Lokasi**: `MerchantSidebar.tsx` baris 113
- **Masalah**: Pengecekan `isActive` hanya `location.pathname === item.href` (exact match). Halaman seperti `/merchant/products/123` tidak akan menandai menu "Produk" sebagai aktif.
- **Perbaikan**: Gunakan `startsWith` untuk matching.

### C2. Dashboard merchant memuat semua pesanan tanpa limit
- **Lokasi**: `MerchantDashboardPage.tsx` baris 76-79
- **Masalah**: Query `orders` tanpa `.limit()`, bisa sangat lambat jika merchant punya ribuan pesanan.
- **Perbaikan**: Tambahkan limit (misal 100 atau 500) atau filter berdasarkan periode.

### C3. Badge count di sidebar di-fetch tanpa cache/debounce
- **Lokasi**: `MerchantSidebar.tsx`
- **Masalah**: Setiap kali sidebar dirender, 4 query terpisah dijalankan ke database. Tidak ada caching atau pembatasan frekuensi.
- **Perbaikan**: Gunakan react-query atau tambahkan interval refresh.

### C4. Merchant Products page tidak ada fitur search/filter
- Halaman produk merchant hanya menampilkan daftar tabel tanpa search bar atau filter kategori/status.
- **Perbaikan**: Tambahkan search bar dan filter minimal (aktif/nonaktif, kategori).

### C5. Merchant tidak bisa melihat preview toko dari dashboard
- Tidak ada tombol "Lihat Toko" yang langsung membuka halaman profil publik merchant.
- **Perbaikan**: Tambahkan tombol preview di dashboard dan settings.

---

## D. RENCANA PERBAIKAN (Prioritas)

### Prioritas 1 - Bug Fix (Kritis)
1. **Fix reorder stock hardcode** - Ganti `stock: 99` dengan fetch stok aktual atau minimal pakai nilai dari order_items
2. **Fix realtime stale closure** - Tambahkan `orders` ke dependency atau gunakan functional state update
3. **Fix ProductDetail sticky bar** - Ubah dari `absolute` ke `fixed` dengan max-width constraint
4. **Hapus console.log** di ShopsPage

### Prioritas 2 - UX Improvement (Buyer)
5. **Tambah empty state homepage** - Tampilan informatif ketika data kosong
6. **Dialog konfirmasi "Hapus Semua"** di keranjang
7. **Fix tab badge warna** di OrdersPage
8. **Validasi stok di CartPage** - Cek stok real-time saat buka keranjang

### Prioritas 3 - UX Improvement (Merchant)
9. **Fix sidebar active state** - Gunakan `startsWith` untuk sub-route matching
10. **Tambah limit query dashboard** - Batasi fetch orders di dashboard
11. **Cache sidebar badge counts** - Gunakan interval atau react-query
12. **Tambah search/filter produk** - Di halaman MerchantProductsPage
13. **Tambah tombol "Preview Toko"** - Di MerchantDashboardPage

---

## E. DETAIL TEKNIS

```text
File yang perlu diubah:

1. src/pages/OrdersPage.tsx
   - Fix reorder stock (baris 303): fetch stok aktual atau gunakan default yang wajar
   - Fix realtime closure (baris 262-286): gunakan functional state update
   - Fix badge warna (baris 426): ganti bg-current/10 ke warna solid

2. src/pages/ProductDetail.tsx
   - Fix sticky bar (baris 377): ubah absolute ke fixed + max-w-[480px] mx-auto

3. src/pages/CartPage.tsx
   - Tambah konfirmasi dialog sebelum clearCart
   - Tambah validasi stok saat mount

4. src/pages/ShopsPage.tsx
   - Hapus console.log (baris 50, 62, 102)

5. src/pages/Index.tsx
   - Tambah empty state komponen ketika semua data kosong

6. src/components/merchant/MerchantSidebar.tsx
   - Ubah exact match ke startsWith (baris 113)

7. src/pages/merchant/MerchantDashboardPage.tsx
   - Tambah .limit(500) pada query orders
   - Tambah tombol "Preview Toko"

8. src/pages/merchant/MerchantProductsPage.tsx
   - Tambah search input dan filter kategori
```

Total: 8 file, ~13 perbaikan. Disarankan dikerjakan secara bertahap per prioritas.
