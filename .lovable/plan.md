

# Rencana Perbaikan Komprehensif

## BAGIAN 1: Konsolidasi Database Migrations

### Masalah
Ada **116 file migrasi** di `supabase/migrations/` yang sangat sulit dikelola. Sudah ada `supabase/main_migration.sql` (2151 baris) sebagai konsolidasi, tapi belum mencakup migrasi terbaru (misal trigger `notify_couriers_new_ride` dari April 2026).

### Rencana
1. **Backup semua 116 file migrasi** ke `supabase/migrations_backup/` (satu folder arsip)
2. **Update `supabase/main_migration.sql`** — tambahkan objek yang belum ada dari migrasi terbaru:
   - Trigger `notify_couriers_new_ride` (dari migrasi April 2026)
   - Fungsi/trigger lain yang ditambahkan setelah file main_migration dibuat
3. **Bersihkan folder `supabase/migrations/`** — ganti dengan satu file migrasi tunggal yang memanggil/mengandung schema lengkap
4. **Hapus file SQL duplikat** di root `supabase/` (`complete_database.sql`, `complete_database_v3.sql`, `complete_migration_v4.sql`, `complete_migration_v5.sql`, `fixed_migration.sql`, `fix_*.sql`, `reset_database.sql`, `data_reconciliation.sql`, `monitoring_prevention.sql`, `comprehensive_fix.sql`) — semua sudah terkonsolidasi di `main_migration.sql`

---

## BAGIAN 2: Bug yang Ditemukan

### BUG 1: `.single()` pada Read Queries yang Belum Diperbaiki (MEDIUM)
Masih ada `.single()` pada **read queries** yang bisa crash jika data tidak ada:

| File | Konteks |
|------|---------|
| `TourismDetail.tsx` (line 40) | Tourism by ID — bisa crash jika tourism dihapus |
| `OrderChat.tsx` (line 84) | Order lookup — crash jika order dihapus saat chat terbuka |
| `adminApi.ts` (line 166, 286) | Merchant/courier lookup untuk approval — aman karena ada guard, tapi lebih baik pakai `.maybeSingle()` |
| `CheckoutPage.tsx` (line 582) | Merchant user_id lookup saat kirim notifikasi — crash jika merchant dihapus mid-checkout |

**Fix:** Ganti `.single()` → `.maybeSingle()` + null guard pada semua read queries di atas.

### BUG 2: `navigate(-1)` Tanpa Fallback (LOW)
**22 file** menggunakan `navigate(-1)` yang bisa keluar dari app jika user masuk via deep link. Yang paling kritis:
- `ProductDetail.tsx`, `TourismDetail.tsx`, `OrderTrackingPage.tsx` — halaman yang sering diakses via link langsung

**Fix:** Buat utility `safeGoBack(navigate)` yang cek `window.history.length > 1` dan fallback ke `/`.

### BUG 3: Duplikat Data Fetch Tanpa Cache (LOW-MEDIUM)
`Index.tsx`, `ExplorePage.tsx`, `ProductsPage.tsx`, `TourismPage.tsx` semua memanggil `fetchProducts()`/`fetchVillages()`/`fetchTourism()` secara independen tanpa caching. Navigasi antar halaman = API calls berulang.

**Fix:** Wrap fetch functions dengan simple in-memory cache (TTL 60 detik) di `api.ts`.

### BUG 4: OrdersPage Realtime Subscription Tidak Cleanup (LOW)
Realtime subscription yang ditambahkan sebelumnya perlu diverifikasi cleanup pada unmount untuk menghindari memory leak.

---

## BAGIAN 3: Fitur yang Kurang / Belum Sempurna

### FITUR 1: Merchant Dashboard — Tidak Ada Audio Alert untuk Pesanan Baru (MEDIUM)
`MerchantDashboardPage` menggunakan `useRealtimeOrders` tapi tidak ada suara notifikasi saat pesanan masuk. `CourierRidesPage` sudah punya — merchant belum.

**Fix:** Tambah Web Audio API beep saat `onNewOrder` callback dipanggil.

### FITUR 2: BuyerChatPage Tidak Terintegrasi ke Account Menu (MEDIUM)
`BuyerChatPage.tsx` sudah ada tapi perlu diverifikasi apakah link ke halaman ini ada di `AccountPage.tsx`.

**Fix:** Pastikan menu "Chat" ada di Account dengan badge unread.

### FITUR 3: Empty State di ShopsPage/ExplorePage Tidak Informatif (LOW)
Jika tidak ada data, empty state hanya menampilkan teks generik tanpa CTA.

**Fix:** Tambah empty state dengan panduan kontekstual.

### FITUR 4: Merchant Tidak Bisa Lihat Lokasi Kurir Sebelum Assign (LOW)
`CourierAssignDialog` hanya daftar teks tanpa peta preview.

**Fix:** Embed `CourierMapSelector` sebagai view tambahan di dialog.

---

## Rencana Implementasi

### Fase 1 — Database Consolidation (3 aksi)
1. Pindahkan 116 file dari `supabase/migrations/` ke `supabase/migrations_backup/`
2. Update `supabase/main_migration.sql` dengan objek terbaru (trigger ride notifications dll)
3. Hapus file SQL duplikat dari root `supabase/`

### Fase 2 — Bug Fixes (4 file)
4. Fix `.single()` → `.maybeSingle()` di `TourismDetail.tsx`, `OrderChat.tsx`, `CheckoutPage.tsx`, `adminApi.ts`
5. Buat utility `safeGoBack()` di `src/lib/utils.ts` dan terapkan di halaman detail utama (`ProductDetail`, `TourismDetail`, `OrderTrackingPage`)
6. Tambah simple cache layer di `src/lib/api.ts` untuk `fetchProducts`, `fetchVillages`, `fetchTourism`

### Fase 3 — Feature Improvements (3 file)
7. Audio alert pesanan baru di `MerchantDashboardPage.tsx`
8. Verifikasi & fix integrasi `BuyerChatPage` di `AccountPage.tsx`
9. Improve empty states di `ShopsPage.tsx` dan `ExplorePage.tsx`

**Total: ~10 file diubah, 0 migrasi database baru, 116 file migrasi diarsipkan**

