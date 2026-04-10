-- Allow merchants to manage their own products
CREATE POLICY "Merchants can manage own products"
ON public.products
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.merchants
    WHERE merchants.id = products.merchant_id
    AND merchants.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.merchants
    WHERE merchants.id = products.merchant_id
    AND merchants.user_id = auth.uid()
  )
);

-- Allow merchants to view their own orders
CREATE POLICY "Merchants can view own orders"
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.merchants
    WHERE merchants.id = orders.merchant_id
    AND merchants.user_id = auth.uid()
  )
);

-- Allow merchants to update their own orders
CREATE POLICY "Merchants can update own orders"
ON public.orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.merchants
    WHERE merchants.id = orders.merchant_id
    AND merchants.user_id = auth.uid()
  )
);

-- Allow merchants to view own data
CREATE POLICY "Merchants can view own data"
ON public.merchants
FOR SELECT
USING (user_id = auth.uid());

-- Allow merchants to update own data
CREATE POLICY "Merchants can update own data"
ON public.merchants
FOR UPDATE
USING (user_id = auth.uid());

-- Allow admin desa to manage tourism in their village
CREATE POLICY "Admin desa can manage tourism"
ON public.tourism
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.villages
    WHERE villages.id = tourism.village_id
    AND villages.registration_status = 'APPROVED'
  )
  AND is_admin_desa()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.villages
    WHERE villages.id = tourism.village_id
    AND villages.registration_status = 'APPROVED'
  )
  AND is_admin_desa()
);