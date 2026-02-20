
# Analisis Komprehensif Seluruh Sistem DesaMart

---

## A. BUG AKTIF (Harus Diperbaiki)

### Kritis

| # | Bug | Role | Lokasi | Detail |
|---|-----|------|--------|--------|
| 1 | **Status ASSIGNED tidak dikenali buyer** | Buyer | `OrdersPage.tsx` baris 46-58, `OrderTrackingPage.tsx` | `STATUS_CONFIG` tidak memiliki mapping untuk `ASSIGNED` dan `PICKED_UP`. Saat merchant pilih "Kurir Desa", order menjadi `ASSIGNED` tapi buyer melihat status kosong/unknown. `DeliveryStatusCard` juga tidak menampilkan timeline yang benar. |
| 2 | **Merchant Dashboard: Terima pesanan status salah** | Merchant | `MerchantDashboardPage.tsx` baris 324 | Quick action "Terima" mengirim status `PROCESSING` tapi status yang valid di sistem adalah `PROCESSED`. Order akan stuck di status invalid. |
| 3 | **Admin route tanpa role check** | Admin | `App.tsx` baris 367-381 | Route `/admin/packages`, `/admin/quota-settings`, `/admin/transaction-quota` menggunakan `<ProtectedRoute>` tanpa `allowedRoles={['admin']}`. Semua user yang login bisa mengakses halaman quota settings. **Security issue.** |
| 4 | **Reorder: product_id bisa null** | Buyer | `OrdersPage.tsx` baris 157 | `(item as any).product_id` -- jika produk sudah dihapus dari database, `product_id` di `order_items` bisa null, lalu fallback ke `item.id` (UUID order_item) dipakai sebagai product ID, menghasilkan data keranjang yang corrupt. |
| 5 | **Voucher discount tidak disimpan ke database** | Buyer | `CheckoutPage.tsx` baris 459-462 | Diskon voucher hanya dicatat di field `notes` sebagai teks dan `flash_sale_discount` (field yang seharusnya untuk flash sale). Tidak ada field `voucher_id` atau `voucher_discount` di tabel `orders`. Merchant tidak tahu berapa diskon sebenarnya. |
| 6 | **Verifikator reject pakai `prompt()`** | Verifikator | `VerifikatorMerchantsPage.tsx` baris 96-99 | Menggunakan `prompt()` browser native untuk input alasan penolakan. Ini buruk untuk UX dan tidak konsisten dengan UI lainnya yang menggunakan Dialog. Di mobile browser, prompt bisa terblokir. |
| 7 | **COD order tanpa deadline handling** | Buyer+Merchant | `CheckoutPage.tsx` baris 425-427 | `confirmation_deadline` dihitung tapi **tidak ada mekanisme auto-cancel** jika deadline terlewat. Order COD bisa stuck di `PENDING_CONFIRMATION` selamanya. |

### Sedang

| # | Bug | Role | Lokasi | Detail |
|---|-----|------|--------|--------|
| 8 | **Multi-merchant shipping identik** | Buyer | `CheckoutPage.tsx` baris 416 | `merchantShipping` sama untuk semua merchant dalam satu checkout. Seharusnya dihitung berdasarkan jarak ke masing-masing merchant. |
| 9 | **Notification `send_notification` RPC mungkin tidak ada** | Merchant | `CheckoutPage.tsx` baris 526 | Checkout memanggil `supabase.rpc('send_notification', ...)` tapi fungsi ini tidak terverifikasi ada di database. Error di-catch dan di-ignore, tapi notifikasi merchant bisa tidak terkirim. |
| 10 | **Admin Desa dashboard terlalu minimal** | Admin Desa | `DesaDashboardPage.tsx` | Hanya 1 tombol aksi ("Kelola Wisata"). Tidak ada: daftar merchant di desa, statistik pendapatan, grafik pengunjung, notifikasi. |
| 11 | **Verifikator: Tidak ada pagination untuk kas** | Verifikator | `VerifikatorDashboardPage.tsx` | Semua kas payments di-load tanpa limit. Jika grup besar dengan ratusan merchant, halaman akan lambat. |

---

## B. ANALISIS PER ROLE

### 1. BUYER (Pembeli)

**Yang Sudah Baik:**
- Cart persistence ke localStorage sudah diimplementasi
- Realtime order status update via Supabase channel
- Chat in-app dengan merchant sudah berfungsi
- Reorder, review, wishlist, recently viewed tersedia
- Address management terintegrasi

**Yang Kurang/Belum Ada:**

| # | Fitur | Prioritas | Detail |
|---|-------|-----------|--------|
| 1 | **Cancel order** | Tinggi | `OrderCancelDialog` sudah ada sebagai komponen tapi **tidak digunakan di OrdersPage.tsx**. Buyer tidak bisa membatalkan pesanan dari daftar pesanan. |
| 2 | **Status ASSIGNED/PICKED_UP di buyer** | Tinggi | Buyer tidak melihat status kurir sudah ditugaskan/sudah ambil barang. Progress bar salah. |
| 3 | **Konfirmasi pesanan diterima dari OrdersPage** | Sedang | Tombol "Selesaikan Pesanan" hanya ada di `OrderTrackingPage`, tidak di daftar pesanan utama. |
| 4 | **Live tracking kurir di peta** | Sedang | Data lokasi kurir (`current_lat/lng`) sudah ada di database tapi tidak ada peta tracking di `OrderTrackingPage`. |
| 5 | **Notifikasi toast saat status berubah realtime** | Sedang | Realtime update mengubah state tapi tidak ada feedback visual (toast/banner) saat status berubah. |
| 6 | **Riwayat pembayaran** | Rendah | Tidak ada halaman khusus melihat semua bukti transfer dan status pembayaran. |

### 2. MERCHANT (Pedagang)

**Yang Sudah Baik:**
- Dashboard lengkap dengan charts, stats, quota
- Order management dengan filter, search, export
- Self-delivery vs kurir desa sudah ada
- Invoice print, payment verification
- Flash sale, voucher, promo management

**Yang Kurang/Belum Ada:**

| # | Fitur | Prioritas | Detail |
|---|-------|-----------|--------|
| 1 | **Sound notification pesanan baru** | Tinggi | `soundEnabled` state ada tapi tidak ada implementasi Audio API. Merchant bisa miss pesanan. |
| 2 | **Status PROCESSING vs PROCESSED mismatch** | Tinggi | Dashboard quick action mengirim `PROCESSING` (baris 324), order page menggunakan `PROCESSED`. Inkonsistensi status. |
| 3 | **Mobile card view untuk orders** | Sedang | DataTable tidak responsif di mobile. Kolom terpotong, sulit scroll horizontal. |
| 4 | **Batch terima pesanan** | Sedang | Tidak bisa terima beberapa pesanan sekaligus dari MerchantOrdersPage. |
| 5 | **Chat template cepat** | Rendah | Merchant harus ketik manual setiap balas chat. |
| 6 | **Product image di order detail** | Rendah | Dialog order detail merchant tidak menampilkan foto produk. |

### 3. VERIFIKATOR

**Yang Sudah Baik:**
- Dashboard dengan stats (merchant, earnings, kas)
- Trade group management (buat, edit, set fee)
- Kode referral system berfungsi
- Kas payment management (generate, mark paid, reminder)
- Announcement ke grup

**Yang Kurang/Belum Ada:**

| # | Fitur | Prioritas | Detail |
|---|-------|-----------|--------|
| 1 | **Reject dialog proper** | Tinggi | Pakai `prompt()` browser native, bukan Dialog component. |
| 2 | **Laporan kas PDF/export** | Sedang | VerifikatorKasReportPage ada tapi perlu diverifikasi apakah export berfungsi. |
| 3 | **Dashboard statistik grafik** | Sedang | Tidak ada chart earnings over time atau merchant growth. Hanya angka statis. |
| 4 | **Notifikasi saat merchant baru daftar** | Sedang | Verifikator tidak mendapat notifikasi real-time saat ada merchant baru pakai kodenya. |
| 5 | **Withdrawal request** | Rendah | Halaman `VerifikatorEarningsPage` sudah ada tapi perlu diverifikasi alurnya. |

### 4. SUPER ADMIN

**Yang Sudah Baik:**
- Dashboard lengkap dengan realtime stats, charts, activity feed
- Bulk approve/reject pendaftaran
- User management, role management
- Financial reports, withdrawal management
- Backup, broadcast, banners, categories
- System health monitoring

**Yang Kurang/Belum Ada:**

| # | Fitur | Prioritas | Detail |
|---|-------|-----------|--------|
| 1 | **Route security hole** | Tinggi | 3 route admin tanpa `allowedRoles` check (quota pages). |
| 2 | **Audit log viewer detail** | Sedang | `AdminLogsPage` ada tapi perlu diverifikasi apakah menampilkan detail yang cukup. |
| 3 | **Order management cross-merchant** | Sedang | Admin bisa lihat semua order tapi tidak ada fitur intervensi (force cancel, force refund). |
| 4 | **Merchant performance ranking** | Rendah | Tidak ada leaderboard merchant berdasarkan revenue/rating. |

### 5. ADMIN DESA

**Yang Sudah Baik:**
- Dashboard dasar dengan statistik wisata
- Kelola wisata (CRUD tourism)

**Yang Kurang/Belum Ada:**

| # | Fitur | Prioritas | Detail |
|---|-------|-----------|--------|
| 1 | **Dashboard sangat minimal** | Tinggi | Hanya 1 tombol aksi. Tidak ada chart, activity feed, atau notifikasi. |
| 2 | **Daftar merchant di desa** | Sedang | Admin desa tidak bisa melihat merchant yang terdaftar di desanya. |
| 3 | **Statistik pengunjung wisata** | Sedang | View count ada tapi tidak ada chart trend. |
| 4 | **Galeri desa** | Rendah | Tidak ada fitur kelola galeri/foto desa. |
| 5 | **Event/kalender wisata** | Rendah | Tidak ada fitur jadwal event wisata. |

---

## C. RENCANA PERBAIKAN - PRIORITAS

### Fase 1: Bug Kritis & Security (Harus segera)

| # | Perubahan | File |
|---|-----------|------|
| 1 | Fix admin route security: tambah `allowedRoles={['admin']}` di 3 route | `src/App.tsx` |
| 2 | Tambah `ASSIGNED`, `PICKED_UP` ke `STATUS_CONFIG` buyer | `src/pages/OrdersPage.tsx` |
| 3 | Fix merchant dashboard status `PROCESSING` -> `PROCESSED` | `src/pages/merchant/MerchantDashboardPage.tsx` |
| 4 | Tambah `OrderCancelDialog` ke `OrdersPage.tsx` untuk buyer cancel | `src/pages/OrdersPage.tsx` |
| 5 | Guard reorder: skip items dengan product_id null, beri warning | `src/pages/OrdersPage.tsx` |
| 6 | Ganti `prompt()` di verifikator dengan Dialog component | `src/pages/verifikator/VerifikatorMerchantsPage.tsx` |

### Fase 2: UX Enhancement

| # | Perubahan | File |
|---|-----------|------|
| 7 | Sound notification merchant (Audio API) | `src/pages/merchant/MerchantOrdersPage.tsx` |
| 8 | Toast notification saat realtime order update buyer | `src/pages/OrdersPage.tsx` |
| 9 | Tombol "Selesaikan Pesanan" di OrdersPage untuk status DELIVERED | `src/pages/OrdersPage.tsx` |
| 10 | Status DELIVERING/ASSIGNED di DeliveryStatusCard & OrderTrackingPage | `src/components/courier/DeliveryStatusCard.tsx` |

### Fase 3: Fitur Tambahan

| # | Perubahan | File |
|---|-----------|------|
| 11 | Perkaya dashboard Admin Desa (chart, merchant list, notifikasi) | `src/pages/desa/DesaDashboardPage.tsx` |
| 12 | Verifikator chart earnings + merchant growth | `src/pages/verifikator/VerifikatorDashboardPage.tsx` |
| 13 | Mobile card view untuk merchant orders | `src/pages/merchant/MerchantOrdersPage.tsx` |
| 14 | Migrasi SQL: tambah `voucher_id`, `voucher_discount` ke orders | Migrasi SQL + `CheckoutPage.tsx` |

---

## D. RINGKASAN FASE 1

| # | File | Perubahan |
|---|------|-----------|
| 1 | `src/App.tsx` | Fix 3 route admin tanpa allowedRoles |
| 2 | `src/pages/OrdersPage.tsx` | Tambah ASSIGNED/PICKED_UP status, cancel dialog, guard reorder, toast realtime |
| 3 | `src/pages/merchant/MerchantDashboardPage.tsx` | Fix status PROCESSING -> PROCESSED |
| 4 | `src/pages/verifikator/VerifikatorMerchantsPage.tsx` | Ganti prompt() dengan Dialog reject |
| 5 | `src/components/courier/DeliveryStatusCard.tsx` | Tambah ASSIGNED di timeline |

**Total Fase 1: 5 file diubah, 0 migrasi database**
