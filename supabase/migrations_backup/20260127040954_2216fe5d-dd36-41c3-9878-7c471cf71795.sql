-- Add verifikator referral system
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS verifikator_code text,
ADD COLUMN IF NOT EXISTS verifikator_id uuid,
ADD COLUMN IF NOT EXISTS trade_group text,
ADD COLUMN IF NOT EXISTS province text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS district text,
ADD COLUMN IF NOT EXISTS subdistrict text,
ADD COLUMN IF NOT EXISTS business_category text DEFAULT 'kuliner',
ADD COLUMN IF NOT EXISTS business_description text;

-- Create verifikator_codes table for referral system
CREATE TABLE IF NOT EXISTS public.verifikator_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verifikator_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  trade_group text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0,
  max_usage integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.verifikator_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can view active codes (for validation)
CREATE POLICY "Anyone can view active codes"
ON public.verifikator_codes
FOR SELECT
USING (is_active = true);

-- Verifikator can manage their own codes
CREATE POLICY "Verifikator can manage own codes"
ON public.verifikator_codes
FOR ALL
USING (
  verifikator_id = auth.uid() OR 
  is_admin()
);

-- Admin can manage all codes
CREATE POLICY "Admin can manage all codes"
ON public.verifikator_codes
FOR ALL
USING (is_admin());

-- Update villages to include subdistrict for matching
ALTER TABLE public.villages
ADD COLUMN IF NOT EXISTS subdistrict text;

-- Update existing villages with subdistrict from district if not set
UPDATE public.villages 
SET subdistrict = district 
WHERE subdistrict IS NULL;

-- Insert sample verifikator codes for testing
INSERT INTO public.verifikator_codes (verifikator_id, code, trade_group, description)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'KULINER2024', 'Kelompok Kuliner Desa', 'Kode referral untuk pedagang kuliner'),
  ('00000000-0000-0000-0000-000000000000', 'KRIYA2024', 'Kelompok Kerajinan Tangan', 'Kode referral untuk pengrajin'),
  ('00000000-0000-0000-0000-000000000000', 'FASHION2024', 'Kelompok Fashion Lokal', 'Kode referral untuk pedagang fashion')
ON CONFLICT (code) DO NOTHING;