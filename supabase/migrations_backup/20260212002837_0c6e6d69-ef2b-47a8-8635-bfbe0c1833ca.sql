
-- 1. Add user_id column to villages table for linking desa to user accounts
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_villages_user_id ON public.villages(user_id);

-- 3. Add RLS policy for village owners to view their own village
DROP POLICY IF EXISTS "Village owners can view own village" ON public.villages;
CREATE POLICY "Village owners can view own village"
ON public.villages FOR SELECT
USING (user_id = auth.uid());

-- 4. Add RLS policy for village owners to update their own village
DROP POLICY IF EXISTS "Village owners can update own village" ON public.villages;
CREATE POLICY "Village owners can update own village"
ON public.villages FOR UPDATE
USING (user_id = auth.uid());

-- 5. Fix refund_requests RLS - allow merchants to read refunds for their orders
DROP POLICY IF EXISTS "Merchants can view refunds for their orders" ON public.refund_requests;
CREATE POLICY "Merchants can view refunds for their orders"
ON public.refund_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN merchants m ON o.merchant_id = m.id
    WHERE o.id = refund_requests.order_id
    AND m.user_id = auth.uid()
  )
);

-- 6. Ensure buyers can view own refund requests
DROP POLICY IF EXISTS "Buyers can view own refund requests" ON public.refund_requests;
CREATE POLICY "Buyers can view own refund requests"
ON public.refund_requests FOR SELECT
USING (buyer_id = auth.uid());

-- 7. Ensure buyers can create refund requests
DROP POLICY IF EXISTS "Buyers can create refund requests" ON public.refund_requests;
CREATE POLICY "Buyers can create refund requests"
ON public.refund_requests FOR INSERT
WITH CHECK (buyer_id = auth.uid());

-- 8. Admin full access to refund_requests
DROP POLICY IF EXISTS "Admins can manage refund requests" ON public.refund_requests;
CREATE POLICY "Admins can manage refund requests"
ON public.refund_requests FOR ALL
USING (is_admin());

-- 9. Fix order_items RLS - merchants should also be able to read order items for their orders
DROP POLICY IF EXISTS "Merchants can view order items" ON public.order_items;
CREATE POLICY "Merchants can view order items"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN merchants m ON o.merchant_id = m.id
    WHERE o.id = order_items.order_id
    AND m.user_id = auth.uid()
  )
);

-- 10. Couriers should be able to read order items for their deliveries
DROP POLICY IF EXISTS "Couriers can view order items" ON public.order_items;
CREATE POLICY "Couriers can view order items"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN couriers c ON o.courier_id = c.id
    WHERE o.id = order_items.order_id
    AND c.user_id = auth.uid()
  )
);
