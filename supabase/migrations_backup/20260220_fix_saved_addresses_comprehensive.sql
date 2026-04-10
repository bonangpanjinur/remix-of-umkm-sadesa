-- =============================================
-- MIGRASI: Perbaikan Komprehensif saved_addresses
-- =============================================
-- Deskripsi: Memastikan tabel saved_addresses memiliki struktur yang benar,
--            RLS policies yang tepat, dan terdaftar di realtime publication.

-- 1. Pastikan tabel saved_addresses ada dengan struktur yang benar
CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
-- Hapus policy lama yang mungkin bermasalah
DROP POLICY IF EXISTS "Service role has full access to saved_addresses" ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can view own addresses" ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON public.saved_addresses;
DROP POLICY IF EXISTS "Anyone can insert addresses" ON public.saved_addresses;

-- Buat policy baru yang bersih
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

-- 5. Enable realtime untuk saved_addresses (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON pr.prpubid = p.oid
    JOIN pg_class c ON pr.prrelid = c.oid
    WHERE p.pubname = 'supabase_realtime'
    AND c.relname = 'saved_addresses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_addresses;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add table to publication: %', SQLERRM;
END $$;
