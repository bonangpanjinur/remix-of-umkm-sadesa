-- 1. Add missing columns to villages table
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. Fix RLS policies for villages table
-- Drop existing INSERT policy that's too restrictive
DROP POLICY IF EXISTS "Anyone can register village" ON public.villages;
DROP POLICY IF EXISTS "villages_register" ON public.villages;

-- Allow authenticated users to register villages (PENDING + inactive)
CREATE POLICY "Authenticated users can register village"
ON public.villages
FOR INSERT
TO authenticated
WITH CHECK (
  registration_status = 'PENDING' AND is_active = false
);

-- Ensure admin ALL policy covers everything (recreate to be safe)
DROP POLICY IF EXISTS "Admins can manage villages" ON public.villages;
CREATE POLICY "Admins can manage villages"
ON public.villages
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Allow admin_desa to update their own village
CREATE POLICY "Admin desa can update own village"
ON public.villages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_villages uv
    WHERE uv.village_id = id AND uv.user_id = auth.uid()
  )
);

-- 3. Fix RLS policies for user_villages table
-- Drop existing policies
DROP POLICY IF EXISTS "Admins manage village assignments" ON public.user_villages;
DROP POLICY IF EXISTS "Users view own village assignments" ON public.user_villages;

-- Admin full access
CREATE POLICY "Admins manage village assignments"
ON public.user_villages
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Users can view their own assignments
CREATE POLICY "Users view own village assignments"
ON public.user_villages
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- Authenticated users can insert their own assignment (for registration)
CREATE POLICY "Users can register own village assignment"
ON public.user_villages
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Add updated_at trigger for villages
CREATE TRIGGER update_villages_updated_at
BEFORE UPDATE ON public.villages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();