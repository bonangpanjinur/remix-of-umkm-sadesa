

# Standarisasi URL Merchant + Analisis & Perbaikan Fitur

## Ringkasan Masalah

Saat ini ada **4 pola URL berbeda** untuk halaman merchant yang sama:

| Pola URL | Dipakai di |
|----------|------------|
| `/store/:id` | `ProductDetail.tsx`, route di `App.tsx` |
| `/merchant/:id` | `ShopsPage.tsx`, `VillageDetailPage.tsx`, route di `App.tsx` |
| `/s/:slug` | `MerchantSlugResolver.tsx`, `MerchantSettingsPage.tsx` |
| `/merchant/dashboard`, `/merchant/settings`, dll | Dashboard merchant (protected) |

Ini membingungkan dan tidak konsisten. Selain itu, **tidak ada trigger otomatis** untuk membuat slug saat merchant baru didaftarkan.

---

## Rencana Perubahan

### 1. Database: Auto-generate slug via trigger

Buat trigger Postgres agar setiap merchant baru otomatis mendapat slug dari nama toko. Fungsi `generate_merchant_slug` sudah ada, tinggal buat trigger-nya.

```text
BEFORE INSERT ON merchants -> auto_set_merchant_slug()
  IF slug IS NULL -> slug = generate_merchant_slug(name)
```

### 2. Route: Konsolidasi ke `/merchant/:slugOrId`

Ubah routing agar satu URL saja yang dipakai:

| Sebelum | Sesudah |
|---------|---------|
| `/store/:id` | Dihapus |
| `/merchant/:id` | Digabung jadi `/merchant/:slugOrId` |
| `/s/:slug` | Tetap ada sebagai alias (redirect) |

Route `/merchant/:slugOrId` akan menggunakan logic:
- Jika parameter cocok format UUID -> query by `id`
- Jika bukan UUID -> query by `slug`

**Penting:** Route protected merchant dashboard (`/merchant/dashboard`, `/merchant/settings`, dll) tidak berubah karena path-nya spesifik dan tidak bentrok dengan `:slugOrId`.

### 3. Update semua link di seluruh aplikasi

| File | Link lama | Link baru |
|------|-----------|-----------|
| `ProductDetail.tsx` (baris 296) | `/store/${merchant.id}` | `/merchant/${merchant.slug \|\| merchant.id}` |
| `ShopsPage.tsx` (baris 289) | `/merchant/${shop.id}` | `/merchant/${shop.slug \|\| shop.id}` |
| `VillageDetailPage.tsx` (baris 391) | `/merchant/${merchant.id}` | `/merchant/${merchant.slug \|\| merchant.id}` |
| `StoreQRCode.tsx` (baris 28) | `/store/${merchantId}` | `/merchant/${slug \|\| merchantId}` |
| `ShareStoreButton.tsx` | Mix `/s/` dan `/merchant/` | `/merchant/${slug \|\| merchantId}` |
| `MerchantSettingsPage.tsx` (baris 300, 318) | `/s/` prefix | `/merchant/` prefix |

### 4. Fetch slug dari database di halaman yang belum fetch

- `ShopsPage.tsx`: Tambah `slug` ke select query (baris 53)
- `ProductDetail.tsx`: Tambah `slug` ke merchant fetch
- `VillageDetailPage.tsx`: Tambah `slug` ke merchants fetch

### 5. MerchantSlugResolver -- upgrade logic

File `MerchantSlugResolver.tsx` diubah agar menerima `:slugOrId`:
- Cek apakah UUID atau slug
- Query sesuai tipe
- Render `MerchantProfilePage` dengan ID yang resolved

### 6. MerchantSettingsPage -- perbaikan UX slug

- Ubah prefix preview dari `/s/` ke `/merchant/`
- Tambahkan validasi real-time ketersediaan slug (debounce query)

### 7. StoreQRCode -- terima prop slug

Komponen `StoreQRCode` perlu menerima prop `slug` tambahan agar QR code mengarah ke URL slug.

---

## Detail Teknis - File yang Diubah

### Migration SQL (1 file baru)
```sql
CREATE OR REPLACE FUNCTION auto_set_merchant_slug()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_merchant_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_merchant_slug
  BEFORE INSERT ON merchants
  FOR EACH ROW EXECUTE FUNCTION auto_set_merchant_slug();
```

### `src/App.tsx`
- Hapus route `/store/:id`
- Ubah `/merchant/:id` menjadi render `MerchantSlugResolver` (bukan langsung `MerchantProfilePage`)

### `src/pages/MerchantSlugResolver.tsx`
- Terima param `:slugOrId` (bukan hanya `:slug`)
- UUID regex check -> query by `id` atau `slug`

### `src/pages/ProductDetail.tsx`
- Fetch `slug` dari merchant data
- Ubah link dari `/store/${id}` ke `/merchant/${slug || id}`

### `src/pages/ShopsPage.tsx`
- Tambah `slug` ke select query dan interface `ShopData`
- Ubah link dari `/merchant/${id}` ke `/merchant/${slug || id}`

### `src/pages/VillageDetailPage.tsx`
- Tambah `slug` ke merchant fetch
- Ubah link ke `/merchant/${slug || id}`

### `src/components/merchant/StoreQRCode.tsx`
- Tambah prop `slug`
- Ubah URL dari `/store/${id}` ke `/merchant/${slug || id}`

### `src/components/merchant/ShareStoreButton.tsx`
- Standarkan ke `/merchant/${slug || id}`

### `src/pages/merchant/MerchantSettingsPage.tsx`
- Ubah prefix `/s/` ke `/merchant/`
- Tambah debounced slug availability check

### Total: 1 migration + 8 file frontend
