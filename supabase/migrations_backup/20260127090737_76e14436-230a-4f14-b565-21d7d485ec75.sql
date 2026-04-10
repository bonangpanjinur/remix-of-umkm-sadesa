-- Fix Security Definer View warnings by using SECURITY INVOKER

-- Drop and recreate public_merchants view with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_merchants;
CREATE VIEW public.public_merchants
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  business_category,
  business_description,
  image_url,
  is_open,
  open_time,
  close_time,
  badge,
  rating_avg,
  rating_count,
  classification_price,
  village_id,
  city,
  province
FROM public.merchants
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

-- Grant access to the view
GRANT SELECT ON public.public_merchants TO anon;
GRANT SELECT ON public.public_merchants TO authenticated;

-- Drop and recreate public_couriers view with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_couriers;
CREATE VIEW public.public_couriers
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  SPLIT_PART(name, ' ', 1) as first_name,
  vehicle_type,
  photo_url,
  status,
  is_available,
  current_lat,
  current_lng,
  last_location_update
FROM public.couriers
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

-- Grant access only to authenticated users
GRANT SELECT ON public.public_couriers TO authenticated;

-- Also add policy for anon users to view public merchants (via view)
-- We need a basic SELECT policy for the underlying table to work with the view
CREATE POLICY "Anon can view basic merchant info"
ON public.merchants
FOR SELECT
TO anon
USING (status = 'ACTIVE' AND registration_status = 'APPROVED');