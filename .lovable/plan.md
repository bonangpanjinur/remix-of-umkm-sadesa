

# Analisis Bug & UI/UX — Rencana Perbaikan

---

## BAGIAN A: BUG

### BUG 1: `.single()` yang Masih Tersisa (MEDIUM)
Meskipun sudah banyak yang diperbaiki, masih ada **~20+ lokasi** menggunakan `.single()` yang rawan crash PGRST116 jika data tidak ditemukan:

| File | Line | Konteks |
|------|------|---------|
| `PaymentConfirmationPage.tsx` | 57, 70 | Order & merchant lookup by ID |
| `MerchantProfilePage.tsx` | 122 | Merchant by ID (bisa dihapus) |
| `AdminMerchantDetailPage.tsx` | 143 | Merchant detail |
| `AdminVillageDetailPage.tsx` | 98 | Village detail |
| `VillageDetailPage.tsx` | 90 | Village detail |
| `WithdrawalManager.tsx` | 150 | Merchant balance |
| `OrderStatusManager.tsx` | 160 | Merchant village lookup |
| `ReviewsPage.tsx` | 55 | Order by ID + buyer |
| `RideTrackingPage.tsx` | 175, 191, 225 | Ride & courier lookups |
| `courierApi.ts` | 59, 89 | Courier lookups |
| `AdminWithdrawalsPage.tsx` | 154 | Merchant balance |
| `AdminRefundsPage.tsx` | 153 | Merchant balance |

**Fix:** Ganti semua `.single()` → `.maybeSingle()` + null guard, kecuali untuk `.insert().select().single()` (yang aman karena pasti return 1 row).

---

### BUG 2: `PaymentConfirmationPage` — Merchant `.single()` Tanpa Guard (MEDIUM)
**File:** `src/pages/PaymentConfirmationPage.tsx` (line 70)
Query merchant payment info pakai `.single()` — jika merchant dihapus saat order masih ada, halaman crash.

**Fix:** `.single()` → `.maybeSingle()`, fallback ke nama "Merchant" sudah ada tapi `.single()` akan crash sebelum sampai ke fallback.

---

### BUG 3: Homepage Memuat Semua Produk Tanpa Limit (LOW-MEDIUM)
**File:** `src/lib/api.ts` → `fetchProducts()`
Homepage memanggil `fetchProducts()` yang mengambil **semua produk** tanpa pagination. Dengan banyak produk, ini menyebabkan:
- Slow initial load
- Excessive memory usage
- Supabase 1000-row default limit tanpa warning

**Fix:** Tambah `.limit(50)` pada query produk untuk homepage, atau implementasi pagination.

---

### BUG 4: `ExplorePage` dan `Index` Load Data Duplikat (LOW)
Kedua halaman memanggil `fetchProducts()`, `fetchVillages()`, `fetchTourism()` secara independen tanpa caching. Navigasi antara keduanya = 6 API call berulang.

**Fix:** Gunakan React Query `useQuery` dengan cache key agar data di-share antar halaman.

---

## BAGIAN B: ANALISIS UI/UX & PERBAIKAN

### UX 1: Search Bar Hanya Muncul di Homepage (HIGH)
**Masalah:** Search bar di `Header` hanya tampil saat `location.pathname === '/'`. Di halaman Toko, Explore, atau Product — user tidak punya akses search cepat tanpa kembali ke homepage.

**Fix:** Tampilkan search bar di semua halaman utama (homepage, explore, shops, products). Buat search bar selalu visible atau tambahkan ikon search di header yang membuka search overlay.

---

### UX 2: Tidak Ada Konfirmasi Visual Saat Add to Cart dari ProductCard (MEDIUM)
**Masalah:** `ProductCard.handleAddToCart` memanggil `addToCart(product, 1)` tanpa feedback (tidak ada toast/animasi). User tidak tahu apakah produk berhasil ditambahkan.

**Fix:** Tambah toast notification atau animasi micro-interaction (badge bounce) saat add to cart dari card grid.

---

### UX 3: Halaman Account Terlalu Panjang dan Flat (MEDIUM)
**Masalah:** `AccountPage` menampilkan semua menu dalam daftar linear tanpa pengelompokan visual. Menu "Pesanan Saya", "Ulasan", "Riwayat Ojek", "Terakhir Dilihat" semuanya terlihat sama — sulit scan cepat.

**Fix:** Kelompokkan menu dalam sections dengan label:
- **Transaksi**: Pesanan, Ulasan, Riwayat Ojek
- **Lainnya**: Terakhir Dilihat, Notifikasi, Pengaturan

---

### UX 4: Empty State di Shops/Explore Tidak Actionable (LOW)
**Masalah:** Jika tidak ada toko/produk di area user, tidak ada guidance jelas (misal: "Coba perluas pencarian" atau "Daftar toko Anda").

**Fix:** Tambah empty state yang lebih informatif dengan CTA kontekstual.

---

### UX 5: Bottom Navigation Tidak Menunjukkan Chat Badge (MEDIUM)
**Masalah:** `BottomNav` menampilkan badge untuk orders dan notifications, tapi chat unread count (dari `useChatUnread`) tidak ditampilkan di mana pun di BottomNav — hanya di Header. Jika user scroll dan header tersembunyi, chat badge tidak terlihat.

**Fix:** Tambahkan chat badge ke tab "Akun" di BottomNav (gabungkan unread notif + chat), atau tambah chat sebagai tab terpisah.

---

### UX 6: Produk Grid di Homepage Menampilkan SEMUA Produk Tanpa "Load More" (MEDIUM)
**Masalah:** Section "Produk Terdekat" di `Index.tsx` (line 200-209) me-render `sortedProducts.map(...)` — semua produk sekaligus. Ini menyebabkan scroll yang sangat panjang dan performa rendering buruk.

**Fix:** Batasi initial render ke 10-20 produk, tambahkan tombol "Lihat Lebih Banyak" atau infinite scroll.

---

### UX 7: Merchant Profile Page Tidak Ada Tombol "Kembali" yang Konsisten (LOW)
**Masalah:** Beberapa halaman detail menggunakan `ArrowLeft` button dengan `navigate(-1)`, tapi jika user masuk via deep link, `navigate(-1)` bisa keluar dari app.

**Fix:** Gunakan `navigate('/')` sebagai fallback jika history kosong.

---

## RENCANA IMPLEMENTASI

### Fase 1 — Bug Fixes (5 file)
1. Fix semua `.single()` → `.maybeSingle()` pada **read queries** (bukan insert)
   - `PaymentConfirmationPage.tsx`, `MerchantProfilePage.tsx`, `AdminMerchantDetailPage.tsx`, `AdminVillageDetailPage.tsx`, `VillageDetailPage.tsx`, `WithdrawalManager.tsx`, `OrderStatusManager.tsx`, `ReviewsPage.tsx`, `RideTrackingPage.tsx`, `courierApi.ts`, `AdminWithdrawalsPage.tsx`, `AdminRefundsPage.tsx`
2. Tambah `.limit(50)` pada `fetchProducts()` untuk homepage

### Fase 2 — UX Improvements (4 file)
3. Search bar visible di semua halaman utama — `Header.tsx`
4. Toast feedback pada `ProductCard.handleAddToCart` — `ProductCard.tsx`
5. Limit produk di homepage + "Lihat Lebih Banyak" — `Index.tsx`
6. Chat badge di BottomNav — `BottomNav.tsx`

### Fase 3 — UX Polish (2 file)
7. Grouping menu di Account — `AccountPage.tsx`
8. Safe back navigation — utility function

**Total: ~14 file diubah, 0 migrasi database**

