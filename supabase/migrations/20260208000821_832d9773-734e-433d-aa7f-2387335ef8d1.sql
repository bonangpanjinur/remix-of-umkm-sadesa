-- Drop the restrictive buyer update policy and replace with one that covers all buyer-updatable statuses
DROP POLICY IF EXISTS "Buyers can update own pending orders" ON public.orders;

CREATE POLICY "Buyers can update own orders"
ON public.orders
FOR UPDATE
USING (
  auth.uid() = buyer_id 
  AND status IN ('NEW', 'PENDING_PAYMENT', 'DELIVERED')
)
WITH CHECK (
  auth.uid() = buyer_id
);