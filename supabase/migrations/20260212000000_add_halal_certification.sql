-- Update merchants table with halal certification fields
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS halal_status text DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS halal_certificate_url text,
ADD COLUMN IF NOT EXISTS ktp_url text;

-- Create halal_regulations table
CREATE TABLE IF NOT EXISTS halal_regulations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Add RLS policies for halal_regulations
ALTER TABLE halal_regulations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to halal_regulations
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'halal_regulations' AND policyname = 'Allow public read access to halal_regulations'
    ) THEN
        CREATE POLICY "Allow public read access to halal_regulations" 
        ON halal_regulations FOR SELECT 
        USING (true);
    END IF;
END $$;

-- Policy: Allow admin to manage halal_regulations
-- Using public.is_admin() function which is standard in this project
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'halal_regulations' AND policyname = 'Allow admin to manage halal_regulations'
    ) THEN
        CREATE POLICY "Allow admin to manage halal_regulations" 
        ON halal_regulations FOR ALL 
        USING (public.is_admin());
    END IF;
END $$;
