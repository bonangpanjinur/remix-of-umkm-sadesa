-- Fix RLS for couriers table to allow admins and verifikators to manage it properly
-- This fixes the issue where data might not load due to permission errors

-- 1. Ensure the is_verifikator function exists (referenced in previous migrations but let's be sure)
CREATE OR REPLACE FUNCTION public.is_verifikator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'verifikator'
  );
$$;

-- 2. Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Admins can manage couriers" ON public.couriers;
DROP POLICY IF EXISTS "Verifikator can manage couriers" ON public.couriers;
DROP POLICY IF EXISTS "Anyone can register as courier" ON public.couriers;
DROP POLICY IF EXISTS "Active couriers visible to authenticated" ON public.couriers;
DROP POLICY IF EXISTS "Couriers can view own data" ON public.couriers;
DROP POLICY IF EXISTS "Couriers can update own location" ON public.couriers;

-- 3. Recreate policies with proper function calls
CREATE POLICY "Admins can manage couriers" ON public.couriers
FOR ALL USING (public.is_admin());

CREATE POLICY "Verifikator can manage couriers" ON public.couriers
FOR ALL USING (public.is_verifikator());

CREATE POLICY "Anyone can register as courier" ON public.couriers
FOR INSERT WITH CHECK (registration_status = 'PENDING' AND status = 'INACTIVE');

CREATE POLICY "Active couriers visible to authenticated" ON public.couriers
FOR SELECT USING (status = 'ACTIVE' AND auth.uid() IS NOT NULL);

CREATE POLICY "Couriers can view own data" ON public.couriers
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Couriers can update own location" ON public.couriers
FOR UPDATE USING (user_id = auth.uid() AND status = 'ACTIVE');

-- 4. Add index for performance
CREATE INDEX IF NOT EXISTS idx_couriers_registration_status ON public.couriers(registration_status);
CREATE INDEX IF NOT EXISTS idx_couriers_village_id ON public.couriers(village_id);
