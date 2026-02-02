-- Fix SECURITY DEFINER warnings by recreating views with SECURITY INVOKER

-- Drop and recreate public_merchants with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_merchants;

CREATE VIEW public.public_merchants 
WITH (security_invoker = true) AS
SELECT 
  id,
  name,
  image_url,
  business_category,
  business_description,
  village_id,
  CASE 
    WHEN phone IS NOT NULL THEN 
      CONCAT('****', RIGHT(phone, 4))
    ELSE NULL 
  END as phone_masked,
  city,
  district,
  province,
  CASE 
    WHEN location_lat IS NOT NULL THEN 
      ROUND(location_lat::numeric, 2)
    ELSE NULL 
  END as location_lat_approx,
  CASE 
    WHEN location_lng IS NOT NULL THEN 
      ROUND(location_lng::numeric, 2)
    ELSE NULL 
  END as location_lng_approx,
  is_open,
  open_time,
  close_time,
  rating_avg,
  rating_count,
  is_verified,
  badge,
  order_mode
FROM public.merchants
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

GRANT SELECT ON public.public_merchants TO anon;
GRANT SELECT ON public.public_merchants TO authenticated;

-- Drop and recreate public_couriers with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_couriers;

CREATE VIEW public.public_couriers 
WITH (security_invoker = true) AS
SELECT 
  id,
  name,
  CASE 
    WHEN phone IS NOT NULL THEN 
      CONCAT('****', RIGHT(phone, 4))
    ELSE NULL 
  END as phone_masked,
  photo_url,
  vehicle_type,
  CASE 
    WHEN current_lat IS NOT NULL THEN 
      ROUND(current_lat::numeric, 3)
    ELSE NULL 
  END as current_lat_approx,
  CASE 
    WHEN current_lng IS NOT NULL THEN 
      ROUND(current_lng::numeric, 3)
    ELSE NULL 
  END as current_lng_approx,
  is_available,
  status,
  village_id
FROM public.couriers
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

GRANT SELECT ON public.public_couriers TO anon;
GRANT SELECT ON public.public_couriers TO authenticated;