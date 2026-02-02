-- Fix Security Issues: Profiles, Saved Addresses, and Merchants RLS

-- ============================================
-- 1. PROFILES TABLE - Stricter RLS
-- ============================================

-- Drop existing policies if not already dropped
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Service role has full access to profiles" ON public.profiles;

-- Create stricter policies
CREATE POLICY "Users can view own profile only"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to profiles"
ON public.profiles
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 2. SAVED_ADDRESSES TABLE - Add service role access
-- ============================================

DROP POLICY IF EXISTS "Service role has full access to saved_addresses" ON public.saved_addresses;

CREATE POLICY "Service role has full access to saved_addresses"
ON public.saved_addresses
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 3. MERCHANTS TABLE - Protect sensitive data with views
-- ============================================

-- Drop existing view first to recreate with new structure
DROP VIEW IF EXISTS public.public_merchants CASCADE;

-- Create a secure view for public merchant data (masks phone number)
CREATE VIEW public.public_merchants AS
SELECT 
  id,
  name,
  image_url,
  business_category,
  business_description,
  village_id,
  -- Mask phone number - only show last 4 digits
  CASE 
    WHEN phone IS NOT NULL THEN 
      CONCAT('****', RIGHT(phone, 4))
    ELSE NULL 
  END as phone_masked,
  -- Only show general location (city level), not exact address
  city,
  district,
  province,
  -- Hide exact coordinates for public view
  -- Show approximate location (rounded to ~1km precision)
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

-- Grant access to the public view
GRANT SELECT ON public.public_merchants TO anon;
GRANT SELECT ON public.public_merchants TO authenticated;

-- Update merchant policies
DROP POLICY IF EXISTS "Authenticated users view active merchants basic info" ON public.merchants;

CREATE POLICY "Authenticated users view active merchants basic info"
ON public.merchants
FOR SELECT
USING (
  (user_id = auth.uid())
  OR
  (status = 'ACTIVE' AND registration_status = 'APPROVED' AND auth.uid() IS NOT NULL)
  OR
  is_admin()
  OR
  is_verifikator()
);

-- ============================================
-- 4. COURIERS TABLE - Protect sensitive data with views
-- ============================================

DROP VIEW IF EXISTS public.public_couriers CASCADE;

CREATE VIEW public.public_couriers AS
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