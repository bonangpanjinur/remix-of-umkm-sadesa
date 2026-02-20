

# Perbaikan Komprehensif Dashboard & Alur Bisnis Merchant

## Masalah yang Ditemukan

### 1. URL Slug 404 - MerchantSlugResolver terlalu ketat
**File:** `src/pages/MerchantSlugResolver.tsx`

Query slug memfilter `status = 'ACTIVE'` DAN `registration_status = 'APPROVED'`. Jika merchant belum disetujui atau statusnya bukan ACTIVE, URL slug akan selalu 404. Selain itu, `navigate('/404')` dipanggil di fase render yang merupakan anti-pattern React.

**Perbaikan:**
- Hapus filter `status` dan `registration_status` dari query slug
- Setelah merchant ditemukan, tampilkan pesan yang sesuai (belum aktif / belum disetujui) alih-alih langsung 404
- Ganti `navigate('/404')` dengan render komponen NotFound langsung

### 2. Toko Selalu Tutup - Logika pengecekan kuota
**File:** `src/pages/MerchantProfilePage.tsx`, `src/lib/api.ts`

Alur saat ini: toko dianggap tutup jika `!hasActiveQuota || !operatingStatus.isCurrentlyOpen`.

Fungsi `checkMerchantHasActiveQuota` mengecek subscription dulu, lalu fallback ke free tier. Free tier mengecek jumlah order bulan ini vs limit (default 100). Jika `app_settings` belum punya key `free_tier_quota`, limit default 100 seharusnya cukup. Tetapi jika ada error saat query, fungsi return `false` -> toko tampil tutup.

**Perbaikan:**
- Tambahkan error handling yang lebih baik di `checkMerchantHasActiveQuota` - default ke `true` jika query gagal (graceful fallback)
- Pastikan `is_open` default `true` di database sudah benar (sudah dikonfirmasi)
- Tambahkan log console yang lebih jelas untuk debugging status toko

### 3. Route Mismatch: `/merchant/withdrawal` vs `/merchant/withdrawals`
**File:** `src/App.tsx` (baris 483)

Sidebar dan dashboard menggunakan `/merchant/withdrawal` (singular), tapi route di App.tsx terdaftar sebagai `/merchant/withdrawals` (plural). Ini menyebabkan halaman penarikan tidak bisa diakses dari sidebar.

**Perbaikan:** Ubah route dari `/merchant/withdrawals` ke `/merchant/withdrawal`

### 4. Statistik Pengunjung - page_views tracking
**File:** `src/lib/pageViewTracker.ts`

RLS policy sudah benar (INSERT untuk semua, SELECT untuk merchant pemilik). Namun `trackPageView` menggunakan in-memory Set yang di-reset setiap reload halaman, dan tidak tracking product views secara otomatis dari halaman ProductDetail.

**Perbaikan:**
- Tambahkan tracking product view di `ProductDetail.tsx` menggunakan `trackPageView`
- Pastikan `page_views` table bisa menerima insert dari user anonim (sudah OK via RLS)

### 5. Analisis Menu Merchant - Error Minor Lainnya

| Masalah | File | Detail |
|---------|------|--------|
| Route withdrawal salah | `App.tsx:483` | `/merchant/withdrawals` -> `/merchant/withdrawal` |
| MerchantSlugResolver terlalu strict | `MerchantSlugResolver.tsx` | Filter status dihapus |
| Quota check error handling lemah | `api.ts:102-129` | Default true jika error |
| Product view tidak di-track | `ProductDetail.tsx` | Tambah trackPageView |

---

## Detail Teknis - File yang Diubah

### File 1: `src/pages/MerchantSlugResolver.tsx`
- Hapus filter `.eq('status', 'ACTIVE')` dan `.eq('registration_status', 'APPROVED')` dari query slug
- Tambahkan pengecekan status SETELAH merchant ditemukan - jika tidak aktif, tampilkan pesan khusus
- Ganti `navigate('/404')` dengan render inline komponen "tidak ditemukan"
- Tambahkan try-catch yang lebih baik

### File 2: `src/lib/api.ts` (fungsi `checkMerchantHasActiveQuota`)
- Wrap seluruh fungsi dalam try-catch
- Jika terjadi error, return `true` (graceful fallback - lebih baik toko tampil buka daripada salah tutup)
- Tambahkan console.warn untuk debugging

### File 3: `src/App.tsx` (baris 483)
- Ubah `/merchant/withdrawals` menjadi `/merchant/withdrawal`

### File 4: `src/pages/ProductDetail.tsx`
- Tambahkan call `trackPageView({ merchantId, productId, pageType: 'product' })` setelah product data berhasil di-load

### File 5: `src/pages/MerchantProfilePage.tsx`
- Perbaiki logika `isClosed` agar lebih robust - pisahkan alasan tutup (quota vs jam operasional vs manual)

### Total: 5 file diubah, 0 migration baru

