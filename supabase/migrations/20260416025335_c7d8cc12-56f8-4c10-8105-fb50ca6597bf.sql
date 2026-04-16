-- Fix 3 functions missing search_path

ALTER FUNCTION public.increment_product_view(uuid) SET search_path = public;
ALTER FUNCTION public.auto_assign_merchant_to_group() SET search_path = public;
ALTER FUNCTION public.auto_assign_village_admin_role() SET search_path = public;

-- Fix overly permissive RLS policy on rate_limits (WITH CHECK (true))
DROP POLICY IF EXISTS "Rate limits insert via functions" ON public.rate_limits;
CREATE POLICY "Rate limits insert via functions" ON public.rate_limits
  FOR INSERT TO authenticated
  WITH CHECK (identifier = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "Rate limits update via functions" ON public.rate_limits;
CREATE POLICY "Rate limits update via functions" ON public.rate_limits
  FOR UPDATE TO authenticated
  USING (identifier = auth.uid()::text OR public.is_admin())
  WITH CHECK (identifier = auth.uid()::text OR public.is_admin());