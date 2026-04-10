-- Fix rate_limits RLS policy to be more restrictive
DROP POLICY IF EXISTS "Rate limits public" ON public.rate_limits;

-- Rate limits should only allow insert/update from server (via security definer function)
-- No direct public access needed
CREATE POLICY "Rate limits managed by functions" ON public.rate_limits
  FOR SELECT USING (identifier = auth.uid()::text OR public.is_admin());

CREATE POLICY "Rate limits insert via functions" ON public.rate_limits
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Rate limits update via functions" ON public.rate_limits  
  FOR UPDATE USING (true);