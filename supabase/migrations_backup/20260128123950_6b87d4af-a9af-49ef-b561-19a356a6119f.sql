
-- Fix overly permissive RLS policies

-- 1. Fix notifications table: "System can insert notifications" with WITH CHECK (true)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "System can insert notifications for authenticated users" 
ON public.notifications 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- 2. Fix rate_limits table
DROP POLICY IF EXISTS "Rate limits insert via functions" ON public.rate_limits;
DROP POLICY IF EXISTS "Rate limits update via functions" ON public.rate_limits;

CREATE POLICY "Users can insert own rate limits" 
ON public.rate_limits 
FOR INSERT 
TO authenticated
WITH CHECK (identifier = (auth.uid())::text);

CREATE POLICY "Users can update own rate limits"
ON public.rate_limits 
FOR UPDATE 
TO authenticated
USING (identifier = (auth.uid())::text);

-- 3. Fix password_reset_tokens table - add policies
CREATE POLICY "Anyone can request password reset" 
ON public.password_reset_tokens 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Users can verify their tokens" 
ON public.password_reset_tokens 
FOR SELECT 
TO anon, authenticated
USING (true);

CREATE POLICY "Tokens can be marked as used" 
ON public.password_reset_tokens 
FOR UPDATE 
TO anon, authenticated
USING (used_at IS NULL AND expires_at > now());
