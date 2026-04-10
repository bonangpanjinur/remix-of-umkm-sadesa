-- Update merchants table to have proper registration status
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS registered_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Update villages table to have proper registration status  
ALTER TABLE public.villages
ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS registered_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS contact_email text;

-- Create helper function to check if user is verifikator
CREATE OR REPLACE FUNCTION public.is_verifikator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'verifikator')
$$;

-- Allow anyone to register a village (pending approval by admin)
CREATE POLICY "Anyone can register village" 
ON public.villages 
FOR INSERT 
WITH CHECK (
  registration_status = 'PENDING' AND 
  is_active = false
);

-- Allow anyone to register a merchant (pending approval by verifikator)
CREATE POLICY "Anyone can register merchant"
ON public.merchants
FOR INSERT
WITH CHECK (
  registration_status = 'PENDING' AND
  status = 'PENDING'
);

-- Verifikator can manage merchants (approve/reject)
CREATE POLICY "Verifikator can manage merchants"
ON public.merchants
FOR ALL
USING (is_verifikator());

-- Update existing merchants to have APPROVED status
UPDATE public.merchants SET registration_status = 'APPROVED' WHERE registration_status = 'PENDING';

-- Update existing villages to have APPROVED status
UPDATE public.villages SET registration_status = 'APPROVED' WHERE registration_status = 'PENDING';