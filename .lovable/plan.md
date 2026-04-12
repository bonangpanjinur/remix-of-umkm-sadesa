

# Status & Rencana Perbaikan Selanjutnya

## Yang SUDAH Selesai

| Item | Status |
|------|--------|
| `.single()` → `.maybeSingle()` pada read queries (TourismDetail, OrderChat, CheckoutPage, adminApi, PaymentConfirmation, dll) | DONE |
| `safeGoBack()` utility + diterapkan di ProductDetail, TourismDetail, OrderTrackingPage | DONE |
| API cache layer (fetchProducts, fetchVillages, fetchTourism) | DONE |
| ETA tracking di OrderTrackingPage | DONE |
| Validasi stok di CartPage | DONE |
| Auto-show rating dialog setelah ride selesai | DONE |
| Chat penumpang-driver di RideTrackingPage | DONE |
| Pendapatan ojek terpisah di CourierEarningsPage | DONE |
| Export CSV dari DailySummaryCard | DONE |
| Search bar di semua halaman utama | DONE |
| Toast feedback add to cart | DONE |
| "Lihat Lebih Banyak" di homepage | DONE |
| Chat badge di BottomNav | DONE |
| Grouping menu di AccountPage | DONE |
| Push notif trigger untuk ride baru (SQL migration) | DONE |

---

## Yang BELUM Selesai

### 1. Migrasi di `supabase/migrations/` Belum Dibersihkan (HIGH)
Masih ada **116 file** di `supabase/migrations/`. Backup sudah dibuat di `migrations_backup/`, tapi file asli belum dihapus. Folder migrations harus dikosongkan dan diganti satu file schema tunggal.

### 2. `navigate(-1)` Masih Ada di 17 File (MEDIUM)
`safeGoBack` hanya diterapkan di 3 file (ProductDetail, TourismDetail, OrderTrackingPage). Masih ada 17 file lain yang pakai `navigate(-1)`:
- AuthPage, CartPage (2x), CheckoutPage, MerchantProfilePage
- RegisterCourierPage, RegisterVillagePage, SavedAddressesPage
- RideBookingPage, BuyerChatPage, ReviewsPage, MyReviewsPage
- RecentlyViewedPage, HelpPage, SettingsPage, dan lainnya

### 3. Audio Alert Pesanan Baru di Merchant Dashboard (MEDIUM)
`MerchantDashboardPage` belum punya notifikasi suara. `useRealtimeOrders` sudah punya `playNotificationSound()` internal, tapi `onNewOrder` callback di dashboard tidak memanggil suara tambahan.

### 4. BuyerChatPage Tidak Ada Link di AccountPage (MEDIUM)
Menu "Chat" tidak muncul di halaman Account. Pembeli tidak bisa mengakses riwayat chat tanpa melalui halaman pesanan.

### 5. OrdersPage Tidak Punya Realtime Subscription (MEDIUM)
Pembeli harus refresh manual untuk melihat perubahan status pesanan.

### 6. Empty State di ShopsPage/ExplorePage (LOW)
Tidak ada pesan informatif saat data kosong.

---

## Rencana Implementasi

### Fase 1 — Database Cleanup
1. Hapus semua 116 file di `supabase/migrations/` (backup sudah ada di `migrations_backup/`)
2. File `main_migration.sql` tetap sebagai referensi schema

### Fase 2 — Stabilitas (5 menit)
3. Terapkan `safeGoBack()` di 17 file yang masih pakai `navigate(-1)`
4. Tambah realtime subscription di `OrdersPage.tsx` untuk auto-update status

### Fase 3 — Fitur
5. Verifikasi audio alert di merchant dashboard (cek apakah `useRealtimeOrders` sudah play sound) — jika belum, tambah
6. Tambah link "Chat Saya" di `AccountPage.tsx` dengan badge unread
7. Improve empty states di `ShopsPage.tsx` dan `ExplorePage.tsx`

**Total: ~22 file diubah (17 navigate fix + 3 fitur + 2 database cleanup)**

