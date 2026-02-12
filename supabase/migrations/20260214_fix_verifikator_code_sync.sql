-- 1. Tambahkan kolom verifikator_code jika belum ada
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS verifikator_code text;

-- 2. Tambahkan index untuk performa pencarian (opsional tapi disarankan)
CREATE INDEX IF NOT EXISTS idx_merchants_verifikator_code ON public.merchants(verifikator_code);

-- 3. Perbarui Policy agar Merchant bisa melihat data mereka sendiri
-- Hapus policy lama untuk menghindari konflik
DROP POLICY IF EXISTS "Merchants can view own data" ON public.merchants;
DROP POLICY IF EXISTS "Merchants can update own data" ON public.merchants;

-- Buat policy baru yang mengizinkan akses ke semua kolom (termasuk verifikator_code)
CREATE POLICY "Merchants can view own data"
ON public.merchants FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Merchants can update own data"
ON public.merchants FOR UPDATE
USING (auth.uid() = id);
