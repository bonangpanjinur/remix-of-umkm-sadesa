
# Fix URL Merchant & Analisis Dashboard Merchant

## Masalah Utama yang Ditemukan

### 1. StoreQRCode di Dashboard tidak menerima slug
**File:** `MerchantDashboardPage.tsx` (baris 62)

Query fetch merchant hanya mengambil `id, name, is_open, status, registration_status, image_url` -- **tidak mengambil `slug`**. Akibatnya, komponen `StoreQRCode` (baris 232-236) dipanggil tanpa prop `slug`, sehingga QR Code dan link selalu menggunakan UUID.

**Perbaikan:**
- Tambah `slug` ke select query dan interface `MerchantData`
- Pass `slug` ke komponen `StoreQRCode`

### 2. ShareStoreButton juga terdampak
Karena slug tidak di-fetch di dashboard, setiap komponen yang menampilkan link toko dari dashboard akan fallback ke UUID.

### 3. MerchantSettingsPage menggunakan type casting `(data as any).slug`
**File:** `MerchantSettingsPage.tsx` (baris 125)

Ini menandakan field `slug` mungkin belum ada di TypeScript types. Perlu dipastikan akses tanpa `as any`.

---

## Rencana Perubahan

### File 1: `src/pages/merchant/MerchantDashboardPage.tsx`

| Perubahan | Detail |
|-----------|--------|
| Interface `MerchantData` | Tambah field `slug: string \| null` |
| Query select (baris 62) | Tambah `slug` ke daftar kolom |
| StoreQRCode (baris 232-236) | Pass prop `slug={merchant.slug}` |

### File 2: `src/pages/merchant/MerchantSettingsPage.tsx`

| Perubahan | Detail |
|-----------|--------|
| Interface `MerchantData` | Tambah field `slug` jika belum ada (sudah ada di baris 46) |
| Baris 125 | Ubah `(data as any).slug` menjadi `data.slug` karena field sudah ada di interface |

---

## Detail Teknis

### `MerchantDashboardPage.tsx` - 3 perubahan kecil:

1. **Interface** (baris 30-37): Tambah `slug: string | null`
2. **Query** (baris 62): Ubah select menjadi `'id, name, is_open, status, registration_status, image_url, slug'`
3. **StoreQRCode** (baris 232-236): Tambah prop `slug={merchant.slug}`

### `MerchantSettingsPage.tsx` - 1 perubahan:

1. **Baris 125**: Ubah `(data as any).slug || ''` menjadi `data.slug || ''`

### Total: 2 file, 4 perubahan minor
