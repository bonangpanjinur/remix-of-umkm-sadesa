
-- Cleanup duplicate RLS policies on orders table
-- Keep: orders_admin_access, orders_buyer_access, orders_merchant_access, orders_courier_access (FOR ALL)
-- Remove: granular per-command duplicates
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Couriers can update assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Couriers can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Merchants can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Merchants can view own orders" ON public.orders;

-- Cleanup duplicate RLS policies on couriers table
-- Keep: couriers_admin_access, couriers_own_access, couriers_public_read
-- Remove: named duplicates
DROP POLICY IF EXISTS "Admins can manage couriers" ON public.couriers;
DROP POLICY IF EXISTS "Couriers can view own data" ON public.couriers;
DROP POLICY IF EXISTS "Couriers can update own location" ON public.couriers;
DROP POLICY IF EXISTS "Public can view approved couriers" ON public.couriers;

-- Cleanup duplicate RLS policies on merchants table
-- Keep: Admins can manage merchants, Anyone can register merchant, Merchants can update own data, Verifikator can manage merchants
-- Remove overlapping SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view active merchants" ON public.merchants;
DROP POLICY IF EXISTS "Merchants can view own data" ON public.merchants;
