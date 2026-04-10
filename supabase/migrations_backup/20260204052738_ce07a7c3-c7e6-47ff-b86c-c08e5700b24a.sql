-- ============================================================
-- FIX 1: Create SECURITY DEFINER functions to break RLS recursion
-- ============================================================

-- Function to check courier ownership without RLS
CREATE OR REPLACE FUNCTION public.get_user_courier_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.couriers WHERE user_id = _user_id LIMIT 1
$$;

-- Function to check merchant ownership without RLS
CREATE OR REPLACE FUNCTION public.get_user_merchant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.merchants WHERE user_id = _user_id LIMIT 1
$$;

-- Function to check if user is courier for specific courier_id
CREATE OR REPLACE FUNCTION public.is_courier_owner(_user_id UUID, _courier_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.couriers 
    WHERE id = _courier_id AND user_id = _user_id
  )
$$;

-- Function to check if user is merchant for specific order
CREATE OR REPLACE FUNCTION public.is_order_merchant(_user_id UUID, _merchant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchants 
    WHERE id = _merchant_id AND user_id = _user_id
  )
$$;

-- ============================================================
-- FIX 2: Drop and recreate couriers RLS policies
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage couriers" ON public.couriers;
DROP POLICY IF EXISTS "Anyone can register as courier" ON public.couriers;
DROP POLICY IF EXISTS "Authorized users can view courier info" ON public.couriers;
DROP POLICY IF EXISTS "Couriers can update own location" ON public.couriers;
DROP POLICY IF EXISTS "Couriers can view own data" ON public.couriers;
DROP POLICY IF EXISTS "Verifikator can manage couriers" ON public.couriers;

-- 1. Couriers can view their own data (simple, no recursion)
CREATE POLICY "Couriers can view own data"
ON public.couriers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2. Admins can manage all couriers using security definer function
CREATE POLICY "Admins can manage couriers"
ON public.couriers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Verifikator can manage couriers
CREATE POLICY "Verifikator can manage couriers"
ON public.couriers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'verifikator'));

-- 4. Anyone can register as courier
CREATE POLICY "Anyone can register as courier"
ON public.couriers
FOR INSERT
TO authenticated
WITH CHECK (registration_status = 'PENDING' AND status = 'INACTIVE');

-- 5. Couriers can update own location
CREATE POLICY "Couriers can update own location"
ON public.couriers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'ACTIVE');

-- 6. Public view for approved couriers (for order assignment)
CREATE POLICY "Public can view approved couriers"
ON public.couriers
FOR SELECT
TO authenticated
USING (registration_status = 'APPROVED' AND status = 'ACTIVE');

-- ============================================================
-- FIX 3: Drop and recreate orders RLS policies
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can update own pending orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Couriers can update assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Couriers can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Merchants can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Merchants can view own orders" ON public.orders;

-- 1. Buyers can view and manage their own orders
CREATE POLICY "Buyers can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can create orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can update own pending orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = buyer_id AND status = 'NEW');

-- 2. Admins can manage all orders
CREATE POLICY "Admins can manage all orders"
ON public.orders
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Couriers can view and update assigned orders using security definer
CREATE POLICY "Couriers can view assigned orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_courier_owner(auth.uid(), courier_id));

CREATE POLICY "Couriers can update assigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_courier_owner(auth.uid(), courier_id));

-- 4. Merchants can view and update their orders using security definer
CREATE POLICY "Merchants can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_order_merchant(auth.uid(), merchant_id));

CREATE POLICY "Merchants can update own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_order_merchant(auth.uid(), merchant_id));

-- ============================================================
-- FIX 4: Create quota_tiers table for dynamic pricing
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quota_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_price INTEGER NOT NULL DEFAULT 0,
  max_price INTEGER DEFAULT NULL,
  credit_cost INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quota_tiers ENABLE ROW LEVEL SECURITY;

-- RLS policies for quota_tiers
CREATE POLICY "Anyone can view quota tiers"
ON public.quota_tiers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage quota tiers"
ON public.quota_tiers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default tiers
INSERT INTO public.quota_tiers (min_price, max_price, credit_cost, description, sort_order) VALUES
(0, 3000, 1, 'Produk harga rendah (Rp 0 - Rp 3.000)', 1),
(3001, 5000, 2, 'Produk harga menengah bawah (Rp 3.001 - Rp 5.000)', 2),
(5001, 8000, 3, 'Produk harga menengah (Rp 5.001 - Rp 8.000)', 3),
(8001, 15000, 4, 'Produk harga menengah atas (Rp 8.001 - Rp 15.000)', 4),
(15001, NULL, 5, 'Produk harga tinggi (Rp 15.001+)', 5)
ON CONFLICT DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_quota_tiers_updated_at
BEFORE UPDATE ON public.quota_tiers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FIX 5: Update transaction_packages table structure
-- ============================================================

-- Add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'transaction_packages' 
                 AND column_name = 'total_credits') THEN
    ALTER TABLE public.transaction_packages ADD COLUMN total_credits INTEGER NOT NULL DEFAULT 100;
  END IF;
END
$$;

-- Rename transaction_quota to total_credits if needed and update data
UPDATE public.transaction_packages SET total_credits = transaction_quota WHERE total_credits = 100;

-- ============================================================
-- FIX 6: Add location columns to merchants if missing
-- ============================================================

-- location_lat and location_lng already exist based on types.ts