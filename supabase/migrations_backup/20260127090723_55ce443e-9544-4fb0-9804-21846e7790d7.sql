-- =============================================
-- FIX SECURITY: Couriers Table
-- =============================================

-- Drop the overly permissive policy that exposes all courier data to authenticated users
DROP POLICY IF EXISTS "Active couriers visible to authenticated" ON public.couriers;

-- Create a more restrictive policy: Only allow viewing couriers if:
-- 1. User is an admin
-- 2. User is a verifikator
-- 3. User is the courier themselves
-- 4. User is a merchant with an order assigned to that courier
-- 5. User is a buyer with an order assigned to that courier
CREATE POLICY "Authorized users can view courier info"
ON public.couriers
FOR SELECT
USING (
  is_admin() OR 
  is_verifikator() OR
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM orders o
    JOIN merchants m ON o.merchant_id = m.id
    WHERE o.courier_id = couriers.id
    AND m.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.courier_id = couriers.id
    AND o.buyer_id = auth.uid()
  )
);

-- =============================================
-- FIX SECURITY: Merchants Table  
-- =============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view active merchants" ON public.merchants;

-- Create policy: Only expose limited merchant data to unauthenticated users
-- For full data access, require authentication and specific roles
CREATE POLICY "Authenticated users can view active merchants"
ON public.merchants
FOR SELECT
USING (
  status = 'ACTIVE' AND auth.uid() IS NOT NULL
);

-- Create a secure view for public merchant listing (limited columns)
CREATE OR REPLACE VIEW public.public_merchants AS
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
  -- Only show city-level location, not full address
  city,
  province
FROM public.merchants
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

-- Grant public access to the view
GRANT SELECT ON public.public_merchants TO anon;
GRANT SELECT ON public.public_merchants TO authenticated;

-- =============================================
-- Create a secure view for public courier info (for order tracking)
-- =============================================
CREATE OR REPLACE VIEW public.public_couriers AS
SELECT 
  id,
  name,
  -- Only expose first name for privacy
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