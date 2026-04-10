
-- Tambah kolom slug ke merchants
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Index untuk pencarian slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_slug ON merchants(slug) WHERE slug IS NOT NULL;

-- Function untuk generate slug dari nama
CREATE OR REPLACE FUNCTION generate_merchant_slug(merchant_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  base_slug := lower(regexp_replace(merchant_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM merchants WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  RETURN final_slug;
END;
$$;

-- Set slug untuk merchant yang sudah ada
UPDATE merchants SET slug = generate_merchant_slug(name) WHERE slug IS NULL;
