-- Drop the problematic policies and recreate them without circular dependencies
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;

-- Recreate Buyers policy without is_admin() call to avoid recursion
CREATE POLICY "Buyers can view own orders"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = buyer_id);

-- Recreate Admin policy using direct check without function call
CREATE POLICY "Admins can manage all orders"
  ON public.orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );