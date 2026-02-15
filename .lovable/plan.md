
# Phase 6: Peningkatan UI/UX untuk Pembeli dan Pedagang

## A. PEMBELI - Peningkatan Utama

### 1. Homepage: Loading Skeleton yang Lebih Baik
- **Masalah**: Saat loading, hanya spinner sederhana ditampilkan. Ini terasa lambat dan tidak profesional.
- **Solusi**: Ganti spinner dengan skeleton loader yang menyerupai layout sebenarnya (hero skeleton, category pills skeleton, product grid skeleton).
- **File**: `src/pages/Index.tsx`

### 2. ProductCard: Hapus Rating Hardcoded & Tambah Jumlah Terjual
- **Masalah**: Di `ProductDetail.tsx` baris 249, rating hardcoded "4.8" -- ini menipu pembeli. `ProductCard.tsx` juga tidak menampilkan informasi engagement.
- **Solusi**: Tampilkan rating sebenarnya dari merchant (sudah ada `rating_avg`) dan tambahkan badge "Terjual X" dari `view_count` atau order count.
- **File**: `src/pages/ProductDetail.tsx`, `src/components/ProductCard.tsx`

### 3. ProductDetail: Tambah Tab Review dari Pembeli
- **Masalah**: Halaman produk tidak menampilkan ulasan sama sekali. Pembeli tidak bisa melihat feedback dari pembeli lain.
- **Solusi**: Tambahkan section "Ulasan Pembeli" di bawah deskripsi, fetch dari tabel `reviews` berdasarkan `merchant_id` dan filter `product_id` (jika ada) atau tampilkan ulasan merchant.
- **File**: `src/pages/ProductDetail.tsx`

### 4. ProductDetail: Tambah Produk Serupa / Rekomendasi
- **Masalah**: Setelah melihat satu produk, tidak ada cara mudah untuk menemukan produk serupa.
- **Solusi**: Tambahkan section "Produk Serupa" di bawah ulasan, fetch produk dari kategori yang sama atau merchant yang sama.
- **File**: `src/pages/ProductDetail.tsx`

### 5. CartPage: Grupkan Item per Merchant
- **Masalah**: Item keranjang ditampilkan flat tanpa pengelompokan. Membingungkan jika beli dari beberapa toko.
- **Solusi**: Grupkan item berdasarkan `merchantName` dengan header merchant di setiap grup.
- **File**: `src/pages/CartPage.tsx`

### 6. OrdersPage: Skeleton Loader & Pull-to-Refresh Feel
- **Masalah**: Loading state hanya spinner. Order card tidak menampilkan ringkasan item (nama produk pertama).
- **Solusi**: Gunakan `OrderCardSkeleton` yang sudah ada, tambahkan nama produk pertama di setiap order card.
- **File**: `src/pages/OrdersPage.tsx`

### 7. Header: Tambah Search Bar di Homepage
- **Masalah**: Untuk mencari produk, pembeli harus ke halaman Jelajah dulu. Tidak ada shortcut dari homepage.
- **Solusi**: Tambahkan search bar kecil di header yang langsung navigate ke `/explore?q={query}` atau `/search?q={query}`.
- **File**: `src/components/layout/Header.tsx`

### 8. BottomNav: Animasi Active State & Haptic Feedback Visual
- **Masalah**: Bottom navigation terasa datar, tidak ada indikator visual yang kuat untuk tab aktif.
- **Solusi**: Tambah dot indicator atau bar di bawah ikon aktif, dan animasi scale ringan saat tap.
- **File**: `src/components/layout/BottomNav.tsx`

---

## B. PEDAGANG - Peningkatan Utama

### 9. Merchant Dashboard: Welcome Card dengan Ringkasan Cepat
- **Masalah**: Dashboard langsung ke data tanpa konteks. Tidak ada greeting atau ringkasan singkat "Anda punya X pesanan baru hari ini".
- **Solusi**: Tambahkan greeting card di atas yang menampilkan waktu hari + ringkasan cepat (pesanan baru, pendapatan hari ini).
- **File**: `src/pages/merchant/MerchantDashboardPage.tsx`

### 10. Merchant Dashboard: Empty State yang Lebih Informatif
- **Masalah**: Jika tidak ada pesanan menunggu, area "Pesanan Menunggu" tidak muncul tanpa feedback positif.
- **Solusi**: Tampilkan pesan positif "Semua pesanan sudah ditangani" dengan ikon checkmark hijau.
- **File**: `src/pages/merchant/MerchantDashboardPage.tsx`

### 11. QuickStats: Animasi Counter
- **Masalah**: Angka statistik muncul tanpa animasi, terasa statis.
- **Solusi**: Tambahkan animasi counting-up sederhana menggunakan framer-motion pada angka.
- **File**: `src/components/merchant/QuickStats.tsx`

### 12. MerchantLayout: Breadcrumb Navigation
- **Masalah**: Di mobile, tidak jelas di halaman mana pedagang berada. Hanya ada title.
- **Solusi**: Tambahkan subtitle breadcrumb kecil "Dashboard > Produk > Edit" di bawah title pada desktop.
- **File**: `src/components/merchant/MerchantLayout.tsx`

---

## Detail Teknis

### Perubahan File

| No | File | Jenis | Deskripsi |
|----|------|-------|-----------|
| 1 | `src/pages/Index.tsx` | Edit | Skeleton loader saat loading |
| 2 | `src/pages/ProductDetail.tsx` | Edit | Fix rating hardcoded, tambah review section, produk serupa |
| 3 | `src/components/ProductCard.tsx` | Edit | Tambah badge terjual |
| 4 | `src/pages/CartPage.tsx` | Edit | Grupkan item per merchant |
| 5 | `src/pages/OrdersPage.tsx` | Edit | Skeleton loader, nama item pertama |
| 6 | `src/components/layout/Header.tsx` | Edit | Search bar di header |
| 7 | `src/components/layout/BottomNav.tsx` | Edit | Active indicator animasi |
| 8 | `src/pages/merchant/MerchantDashboardPage.tsx` | Edit | Welcome card, empty state pesanan |
| 9 | `src/components/merchant/QuickStats.tsx` | Edit | Animasi counter |
| 10 | `src/components/merchant/MerchantLayout.tsx` | Edit | Breadcrumb di desktop |

### Database
- Tidak ada migrasi database diperlukan
- Semua data (reviews, rating_avg, rating_count) sudah tersedia di tabel yang ada

### Prioritas Implementasi

**Batch 1 - Pembeli Core** (perubahan paling berdampak):
- Homepage skeleton loader
- Fix rating hardcoded di ProductDetail
- Review section di ProductDetail
- Produk serupa di ProductDetail
- Search bar di Header

**Batch 2 - Pembeli Polish**:
- Cart grouping per merchant
- Orders skeleton + item preview
- BottomNav active indicator

**Batch 3 - Pedagang**:
- Welcome card + empty state
- QuickStats animasi
- MerchantLayout breadcrumb
