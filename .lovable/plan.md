
# Analisis Komprehensif UI/UX, Bug, dan Fitur yang Kurang

## A. BUG YANG DITEMUKAN

### Bug Kritis

| # | Bug | Lokasi | Detail |
|---|-----|--------|--------|
| 1 | **Keranjang hilang saat refresh** | `CartContext.tsx` | Cart menggunakan `useState` tanpa persistensi. Saat user refresh halaman, semua item keranjang hilang. Harus menggunakan `localStorage` atau `sessionStorage`. |
| 2 | **Voucher discount tidak dikirim ke order** | `CheckoutPage.tsx` baris 438-461 | Saat insert order, field `voucher_id` tidak ada di tabel `orders`. Discount dihitung di frontend tapi **tidak tersimpan di database** - merchant tidak tahu ada diskon. `merchantTotal` juga tidak dikurangi diskon voucher (baris 418). |
| 3 | **Review tidak update `has_review` di order** | `ReviewsPage.tsx` baris 194 | Setelah submit review, tidak ada update ke `orders.has_review = true`. Akibatnya tombol "Beri Rating" tetap muncul di OrdersPage meski sudah review. |
| 4 | **Reorder crash jika product_id null** | `OrdersPage.tsx` baris 157 | `addToCart` menggunakan `(item as any).product_id || item.id` - jika product sudah dihapus, `id` order_item dipakai sebagai product id, menyebabkan data salah. |
| 5 | **Multi-merchant checkout shipping salah** | `CheckoutPage.tsx` baris 416 | `merchantShipping` sama untuk semua merchant, padahal harusnya dihitung per merchant berdasarkan jarak ke masing-masing toko. |
| 6 | **Status DELIVERING tidak ada di OrderTrackingPage** | `OrderTrackingPage.tsx` | `DeliveryStatusCard` tidak mengenali status `DELIVERING`. Buyer yang pesanannya diantar sendiri oleh merchant tidak bisa melihat progress yang benar. |
| 7 | **Merchant kurir desa: status SENT tanpa assign kurir** | `MerchantOrdersPage.tsx` baris 770-774 | Saat merchant pilih "Kurir Desa", status langsung berubah ke SENT tanpa dialog assign kurir. Pesanan jadi "dikirim" tanpa ada kurir yang ditugaskan. |

### Bug Minor

| # | Bug | Lokasi | Detail |
|---|-----|--------|--------|
| 8 | **Timer ETA checkout salah hitung** | `CheckoutPage.tsx` baris 746-751 | Formula `distanceKm / 25 * 60 * 1.2` mengasumsikan kecepatan 25 km/jam - terlalu cepat untuk desa. Tidak ada perbedaan motor vs jalan kaki. |
| 9 | **Duplikat toast import** | Berbagai file | Beberapa file import dari `sonner`, beberapa dari `@/hooks/use-toast`. Inkonsisten dan bisa menyebabkan toast muncul di dua tempat. |
| 10 | **Stok tidak dikurangi saat checkout** | `CheckoutPage.tsx` | Tidak ada logika untuk mengurangi `products.stock` setelah order berhasil dibuat. Stok bisa oversold. |

---

## B. ANALISIS UI/UX

### Sisi Buyer

| Aspek | Status | Masalah |
|-------|--------|---------|
| **Navigasi** | Baik | BottomNav jelas, 5 tab utama. |
| **Pencarian** | Cukup | Search hanya di homepage header, tidak ada di halaman produk/explore secara global. |
| **Keranjang** | Kurang | Tidak ada indikator jumlah item di header/BottomNav (badge ada tapi tidak dipakai). Tidak ada notifikasi saat item ditambahkan selain toast. |
| **Checkout** | Cukup | Saved address sudah terintegrasi. Tapi flow terlalu panjang (scroll satu halaman). |
| **Order Tracking** | Kurang | Tidak ada peta live tracking kurir. Hanya status text tanpa visualisasi posisi. |
| **Product Detail** | Baik | Ada wishlist, share, review, similar products. |
| **Empty States** | Baik | Semua halaman punya empty state yang informatif. |
| **Loading States** | Baik | Skeleton loaders digunakan konsisten. |

### Sisi Merchant

| Aspek | Status | Masalah |
|-------|--------|---------|
| **Dashboard** | Baik | Welcome card, quick stats, pending orders action. |
| **Order Management** | Cukup | Tabel dengan filter dan sort sudah baik, tapi tidak ada **sound notification** yang benar-benar berfungsi (hanya state, tidak ada audio). |
| **Product Management** | Belum diperiksa mendalam | - |
| **Settings** | Baik | Lengkap: pembayaran, jam operasi, slug, halal. |
| **Mobile Responsiveness** | Cukup | Sidebar collapse di mobile, tapi DataTable sulit digunakan di layar kecil. |
| **Analytics** | Ada | Chart pendapatan dan pesanan 14 hari. |

---

## C. FITUR YANG SEHARUSNYA ADA TAPI BELUM

### Buyer Side

| # | Fitur | Prioritas | Detail |
|---|-------|-----------|--------|
| 1 | **Cart persistence (localStorage)** | Tinggi | Keranjang hilang saat refresh. Harus persist ke localStorage. |
| 2 | **Konfirmasi pesanan diterima oleh buyer** | Tinggi | Saat status DELIVERED, buyer harus bisa konfirmasi "Pesanan Diterima" dari halaman Orders (bukan hanya dari tracking page). |
| 3 | **Notifikasi push/in-app saat status berubah** | Tinggi | Buyer tidak tahu pesanan diproses/dikirim kecuali buka halaman orders. Perlu toast/banner saat realtime update masuk. |
| 4 | **Cancel order oleh buyer** | Sedang | Buyer tidak bisa membatalkan pesanan yang masih NEW/PENDING. Harus ada tombol cancel dengan konfirmasi. |
| 5 | **Riwayat pembayaran** | Sedang | Tidak ada halaman khusus untuk melihat riwayat pembayaran (transfer proof, status). |
| 6 | **Filter produk di halaman merchant** | Sedang | Di MerchantProfilePage, tab Produk tidak ada search/filter. Sulit jika merchant punya banyak produk. |
| 7 | **Notifikasi saat chat baru masuk** | Sedang | Chat in-app sudah ada, tapi tidak ada badge/notifikasi saat ada pesan baru dari merchant. |
| 8 | **Simpan catatan favorit per merchant** | Rendah | Buyer yang sering pesan ke merchant yang sama harus tulis catatan ulang setiap kali. |

### Merchant Side

| # | Fitur | Prioritas | Detail |
|---|-------|-----------|--------|
| 1 | **Sound notification untuk pesanan baru** | Tinggi | Ada state `soundEnabled` tapi tidak ada implementasi audio. Merchant bisa miss pesanan baru. |
| 2 | **Assign kurir saat pilih "Kurir Desa"** | Tinggi | Dialog pilih kurir tidak dibuka saat merchant memilih kurir desa. Pesanan langsung SENT tanpa kurir. |
| 3 | **Stok otomatis berkurang** | Tinggi | Saat pesanan masuk, stok produk tidak otomatis berkurang. Bisa terjadi overselling. |
| 4 | **Dashboard mobile card view** | Sedang | DataTable di MerchantOrdersPage sulit digunakan di mobile. Perlu card view alternatif. |
| 5 | **Batch accept pesanan** | Sedang | Tidak bisa terima beberapa pesanan sekaligus. Harus satu per satu. |
| 6 | **Template pesan cepat untuk chat** | Sedang | Merchant harus ketik manual setiap balas chat. Perlu template siap pakai. |
| 7 | **Laporan harian otomatis** | Rendah | DailySummaryCard sudah ada di dashboard, tapi tidak ada export/kirim ke WhatsApp. |
| 8 | **Multi-image product di order detail** | Rendah | Order detail merchant hanya tampilkan nama produk, tidak ada foto. |

---

## D. RENCANA PERBAIKAN (Prioritas)

### Fase 1: Bug Kritis (Harus segera diperbaiki)

1. **Cart persistence ke localStorage** - `CartContext.tsx`
   - Simpan items ke localStorage setiap perubahan
   - Load dari localStorage saat init

2. **Fix voucher discount di checkout** - `CheckoutPage.tsx`
   - Kurangi `merchantTotal` dengan `voucherDiscount`
   - Simpan info voucher di order (notes atau field baru)

3. **Fix review has_review update** - `ReviewsPage.tsx`
   - Setelah insert review, update `orders.has_review = true`

4. **Fix kurir desa tanpa assign** - `MerchantOrdersPage.tsx`
   - Buka dialog assign kurir saat pilih "Kurir Desa"
   - Jangan langsung set status SENT

5. **Stock decrement saat order** - `CheckoutPage.tsx`
   - Kurangi `products.stock` berdasarkan quantity yang dipesan

6. **DELIVERING status di OrderTrackingPage** - `OrderTrackingPage.tsx` dan `DeliveryStatusCard.tsx`
   - Tambah handling untuk status DELIVERING

### Fase 2: UX Enhancement

7. **Buyer cancel order** - `OrdersPage.tsx`
8. **Sound notification merchant** - `MerchantOrdersPage.tsx`
9. **In-app notification saat status berubah** - `OrdersPage.tsx`
10. **Assign kurir dialog** - `MerchantOrdersPage.tsx`

### Fase 3: Fitur Tambahan

11. Chat notification badge
12. Mobile card view untuk merchant orders
13. Template pesan merchant
14. Filter produk di merchant profile

---

## Ringkasan Perubahan Fase 1

| # | File | Perubahan |
|---|------|-----------|
| 1 | `src/contexts/CartContext.tsx` | Persist cart ke localStorage |
| 2 | `src/pages/CheckoutPage.tsx` | Fix voucher discount calculation, stock decrement |
| 3 | `src/pages/buyer/ReviewsPage.tsx` | Update `orders.has_review` setelah submit |
| 4 | `src/pages/merchant/MerchantOrdersPage.tsx` | Fix kurir desa assign flow |
| 5 | `src/pages/OrderTrackingPage.tsx` | Tambah DELIVERING status handling |
| 6 | `src/components/courier/DeliveryStatusCard.tsx` | Tambah DELIVERING di timeline |

**Total Fase 1: 6 file diubah, 0 migrasi database**
