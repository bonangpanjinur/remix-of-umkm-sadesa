-- Privatize the payment-proofs bucket
UPDATE storage.buckets SET public = false WHERE id = 'payment-proofs';

-- Drop old permissive policies
DROP POLICY IF EXISTS "Payment proofs are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own payment proofs" ON storage.objects;

-- SELECT: buyer (owner of order), merchant of order, or admin
-- Path convention: orders/{order_id}/{filename}
CREATE POLICY "Buyer/merchant/admin can view payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      LEFT JOIN public.merchants m ON o.merchant_id = m.id
      WHERE o.id::text = (storage.foldername(name))[2]
        AND (o.buyer_id = auth.uid() OR m.user_id = auth.uid())
    )
  )
);

-- INSERT: any authenticated user (validated at app level via order ownership)
CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

-- UPDATE: only the buyer of the order
CREATE POLICY "Buyer can update own payment proofs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
      AND o.buyer_id = auth.uid()
  )
);

-- DELETE: only buyer or admin
CREATE POLICY "Buyer or admin can delete payment proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = (storage.foldername(name))[2]
        AND o.buyer_id = auth.uid()
    )
  )
);