

# Analisis & Perbaikan Bug Kurir dan Merchant

## Bug yang Ditemukan

### Bug 1 (Kritis): CourierDashboardPage — "Akses Ditolak" padahal sudah terdaftar
**Penyebab utama**: Alur `fetchCourierData` memiliki beberapa masalah:

1. Jika query `ride_requests` count gagal (misal RLS policy "Drivers can view searching rides" membutuhkan courier `is_available = true` dan `status = 'ACTIVE'`), error dilempar di tengah fungsi SETELAH `setCourier` dipanggil — tapi karena throw terjadi sebelum `setCourier` bisa berjalan penuh, courier tetap null.
2. Jika `registration_status !== 'APPROVED'`, fungsi return tanpa set courier — user melihat "Akses Ditolak" bukan pesan "Akun dalam verifikasi" (karena toast muncul sekilas lalu hilang, tapi UI tetap "Akses Ditolak").
3. Error handling terlalu agresif: satu kegagalan (misal ride_requests) membatalkan seluruh fetch dan menampilkan error generic.

**Fix**:
- Pisahkan fetch courier data dan fetch ride count/orders ke blok try-catch terpisah
- Saat `registration_status !== 'APPROVED'`, tampilkan UI khusus "Menunggu Verifikasi" (bukan "Akses Ditolak")
- Saat `registration_status === 'REJECTED'`, tampilkan UI khusus "Ditolak"

### Bug 2: ProtectedRoute vs CourierDashboardPage — double gate
**File**: `src/App.tsx` + `src/pages/CourierDashboardPage.tsx`
- Route `/courier` dilindungi `ProtectedRoute allowedRoles={['courier', 'admin']}`
- Tapi `CourierDashboardPage` juga redirect ke `/auth` jika no user, dan tampilkan "Akses Ditolak" jika no courier record
- User dengan role `courier` tapi courier record masih PENDING akan melihat "Akses Ditolak" — membingungkan

**Fix**: Hapus redirect manual ke `/auth` di `CourierDashboardPage` (sudah ditangani ProtectedRoute). Tampilkan state yang berbeda berdasarkan `registration_status`.

### Bug 3: Merchant dashboard — masalah serupa
**File**: `src/pages/merchant/MerchantDashboardPage.tsx`
- Tidak ada UI untuk merchant PENDING/REJECTED — hanya blank jika `!merchantData`
- Perlu dicek apakah merchant juga punya masalah yang sama

### Bug 4: RegisterCourierPage & RegisterMerchantPage — tidak insert `user_roles`
- Saat registrasi kurir, hanya insert ke tabel `couriers`, tidak insert role `courier` ke `user_roles`
- Role baru ditambahkan saat admin approve via `approveCourier()`
- Ini berarti user PENDING tidak bisa akses `/courier` sama sekali (diblock ProtectedRoute)
- Masalah sama untuk merchant registration

**Fix**: Ada 2 opsi:
- **Opsi A**: Biarkan role ditambahkan saat approve, tapi buat route `/courier` tidak memerlukan role `courier` (hapus `allowedRoles` dari ProtectedRoute, biarkan page handle auth sendiri)
- **Opsi B**: Insert role saat registrasi
- **Pilihan: Opsi A** — karena kita ingin user bisa melihat status pendaftaran mereka

## Rencana Implementasi

### 1. Fix CourierDashboardPage — handle semua registration states
**File**: `src/pages/CourierDashboardPage.tsx`
- Hapus redirect manual ke `/auth` (ProtectedRoute sudah handle)
- Pisahkan fetch courier profile dari fetch ride count & orders (try-catch terpisah)
- Tampilkan UI berbeda untuk:
  - `registration_status === 'PENDING'` → kartu "Menunggu Verifikasi Admin" dengan animasi
  - `registration_status === 'REJECTED'` → kartu "Pendaftaran Ditolak" dengan alasan + tombol daftar ulang
  - `courierData === null` → "Belum Terdaftar" + tombol daftar
  - `registration_status === 'APPROVED'` → dashboard normal (existing)

### 2. Fix Route Protection — izinkan akses tanpa role khusus
**File**: `src/App.tsx`
- Ubah route `/courier` dari `allowedRoles={['courier', 'admin']}` menjadi tanpa `allowedRoles` (hanya require authenticated)
- Sama untuk `/merchant` routes — ubah menjadi hanya require authenticated
- Biarkan page component yang handle role/status checking

### 3. Fix MerchantDashboardPage — handle registration states
**File**: `src/pages/merchant/MerchantDashboardPage.tsx`
- Tambah UI untuk merchant PENDING, REJECTED, dan null states
- Mirip dengan courier dashboard fix

### 4. Tambah refetchRoles setelah admin approve
**File**: `src/lib/adminApi.ts` — sudah benar, tidak perlu diubah
- `approveCourier` dan `approveMerchant` sudah insert role ke `user_roles`

## Total: 3 file utama diubah
1. `src/pages/CourierDashboardPage.tsx` — fix error handling + registration state UI
2. `src/pages/merchant/MerchantDashboardPage.tsx` — fix registration state UI
3. `src/App.tsx` — relax route protection untuk courier & merchant routes

