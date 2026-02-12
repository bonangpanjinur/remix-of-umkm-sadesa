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

CREATE POLICY "Allow public read access to halal_regulations" 
ON halal_regulations FOR SELECT 
USING (true);

CREATE POLICY "Allow admin to manage halal_regulations" 
ON halal_regulations FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);
