
-- Fix UPDATE policy to include WITH CHECK
DROP POLICY IF EXISTS "Users can update own addresses" ON public.saved_addresses;
CREATE POLICY "Users can update own addresses"
ON public.saved_addresses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
