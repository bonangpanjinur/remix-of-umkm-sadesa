
-- Fix the permissive INSERT policy - restrict to authenticated users whose merchant matches
DROP POLICY IF EXISTS "System can insert quota logs" ON public.quota_usage_logs;

CREATE POLICY "Authenticated users can insert quota logs" ON public.quota_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );
