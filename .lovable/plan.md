
# Analisis Bug, UI/UX, dan Perbaikan Alamat Tersimpan

## 1. Bug yang Ditemukan

### Bug 1: Tabel `saved_addresses` - RLS Policy "Service Role" Bermasalah
**Status**: Tabel ada, RLS aktif, data kosong (0 records)
**Penyebab**: Ada policy `Service role has full access to saved_addresses` yang mengecek `auth.jwt() ->> 'role' = 'service_role'` -- ini tidak akan pernah cocok untuk user biasa. Namun policy INSERT/SELECT/UPDATE/DELETE per-user sudah benar. Kemungkinan besar masalah ada di **environment Live** yang belum memiliki tabel ini, atau ada error silent saat insert yang tidak muncul di UI.

**Solusi**: Membuat migrasi SQL yang memastikan tabel `saved_addresses` lengkap dengan semua policy di environment manapun, dan menambahkan trigger `updated_at`.

### Bug 2: Error `column "email" does not exist` di Tabel `profiles`
**Sumber**: Log database menunjukkan query `SELECT user_id, full_name, email FROM profiles` gagal karena kolom `email` tidak ada.
**Dampak**: Beberapa fitur yang mencoba mengambil email dari profiles akan error.
**Solusi**: Menambahkan kolom `email` ke tabel `profiles` dan mengisi dari `auth.users`.

### Bug 3: Warning `Function components cannot be given refs`
**Sumber**: Console log menunjukkan warning dari React Router di `App.tsx`.
**Dampak**: Tidak crash tapi menandakan beberapa page component yang di-lazy-load perlu `React.forwardRef`.
**Solusi**: Minor, tidak blocking -- bisa diabaikan untuk sekarang.

### Bug 4: Chat sender name kadang muncul "Pengguna" atau "Memuat..."
**Penyebab**: Race condition -- `senderNames` di-fetch setelah messages dimuat, tapi dependency array di `useEffect` tidak stabil (berubah setiap render karena `messages` array baru).
**Solusi**: Fix dependency dan tambahkan proper memoization.

---

## 2. Analisis UI/UX

### Buyer (Pembeli)

| Area | Masalah | Rekomendasi |
|------|---------|-------------|
| BottomNav | Tab "Chat" menggantikan "Toko" -- pembeli kehilangan akses cepat ke daftar toko | Pertimbangkan 5 tab tetap atau gabungkan Chat ke dalam Pesanan |
| Halaman Pesanan | Tidak ada progress bar visual yang jelas untuk status pengiriman | Sudah ada `ORDER_STEPS` tapi perlu dipastikan ditampilkan |
| Alamat Tersimpan | Gagal menyimpan -- ini yang paling kritis | Fix di migration SQL |
| Chat UI | Nama pengirim kadang "Memuat..." | Fix race condition |

### Merchant (Penjual)

| Area | Masalah | Rekomendasi |
|------|---------|-------------|
| Dashboard | Loading data satu per satu (sequential) -- bisa lambat | Gunakan `Promise.all` untuk parallel fetch |
| Chat Penjual | Tab Kurir ada tapi koneksi ke nama kurir belum optimal | Sudah di-fix di iterasi sebelumnya |
| Pengaturan Toko | Form panjang tanpa section collapsible | UX bisa ditingkatkan tapi tidak blocking |

---

## 3. SQL Migrasi untuk Supabase

Berikut SQL yang perlu dijalankan untuk memperbaiki masalah alamat tersimpan dan bug email:

```sql
-- =============================================
-- MIGRASI: Perbaikan saved_addresses + profiles
-- =============================================

-- 1. Pastikan tabel saved_addresses ada dengan benar
CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT 'Rumah',
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province_id TEXT,
  province_name TEXT,
  city_id TEXT,
  city_name TEXT,
  district_id TEXT,
  district_name TEXT,
  village_id TEXT,
  village_name TEXT,
  address_detail TEXT,
  full_address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Aktifkan RLS
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

-- 3. Bersihkan dan buat ulang policies
DROP POLICY IF EXISTS "Service role has full access to saved_addresses" ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can view own addresses" ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON public.saved_addresses;

CREATE POLICY "Users can view own addresses" 
  ON public.saved_addresses FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses" 
  ON public.saved_addresses FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses" 
  ON public.saved_addresses FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses" 
  ON public.saved_addresses FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_saved_addresses_updated_at ON public.saved_addresses;
CREATE TRIGGER set_saved_addresses_updated_at
  BEFORE UPDATE ON public.saved_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Tambahkan kolom email ke profiles (fix bug column "email" does not exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- 6. Backfill email dari auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id
AND p.email IS NULL;

-- 7. Enable realtime untuk saved_addresses
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_addresses;
```

---

## 4. Perbaikan Kode (setelah SQL dijalankan)

### File yang perlu dimodifikasi:

1. **`src/components/chat/OrderChat.tsx`** -- Fix race condition pada sender names (memoize message IDs)
2. **`src/hooks/useSavedAddresses.ts`** -- Tambahkan error logging yang lebih detail untuk debug
3. **`src/pages/merchant/MerchantDashboardPage.tsx`** -- Parallel data fetching dengan `Promise.all`

### Prioritas:
1. Jalankan SQL migrasi di atas (paling penting)
2. Fix chat sender names
3. Perbaikan UX minor
