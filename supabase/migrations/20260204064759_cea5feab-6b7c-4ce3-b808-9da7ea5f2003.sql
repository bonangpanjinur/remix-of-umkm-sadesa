-- =====================================================
-- STEP 1: CREATE ALL SECURITY DEFINER FUNCTIONS FIRST
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_merchant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.merchants WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_courier_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.couriers WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_order_merchant(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.merchants m ON o.merchant_id = m.id
    WHERE o.id = _order_id AND m.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_order_courier(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.couriers c ON o.courier_id = c.id
    WHERE o.id = _order_id AND c.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.get_quota_cost(product_price INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT credit_cost FROM public.quota_tiers 
     WHERE is_active = true 
     AND product_price >= min_price 
     AND (max_price IS NULL OR product_price <= max_price)
     ORDER BY min_price DESC
     LIMIT 1),
    1
  )
$$;

CREATE OR REPLACE FUNCTION public.use_merchant_quota(
  _merchant_id UUID,
  _product_price INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subscription_id UUID;
  _remaining_quota INTEGER;
  _cost INTEGER;
BEGIN
  _cost := public.get_quota_cost(_product_price);
  
  SELECT id, (transaction_quota - used_quota) INTO _subscription_id, _remaining_quota
  FROM public.merchant_subscriptions
  WHERE merchant_id = _merchant_id 
    AND status = 'ACTIVE' 
    AND expired_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF _subscription_id IS NULL OR _remaining_quota < _cost THEN
    RETURN FALSE;
  END IF;
  
  UPDATE public.merchant_subscriptions
  SET used_quota = used_quota + _cost, updated_at = now()
  WHERE id = _subscription_id;
  
  RETURN TRUE;
END;
$$;

-- =====================================================
-- STEP 2: NOW CREATE POLICIES THAT USE THESE FUNCTIONS
-- =====================================================

-- Quota tiers policies
DROP POLICY IF EXISTS "quota_tiers_public_read" ON public.quota_tiers;
DROP POLICY IF EXISTS "quota_tiers_admin_all" ON public.quota_tiers;

CREATE POLICY "quota_tiers_public_read" ON public.quota_tiers
  FOR SELECT USING (true);

CREATE POLICY "quota_tiers_admin_all" ON public.quota_tiers
  FOR ALL USING (public.is_admin());

-- Couriers policies
DROP POLICY IF EXISTS "couriers_own_access" ON public.couriers;
DROP POLICY IF EXISTS "couriers_admin_access" ON public.couriers;
DROP POLICY IF EXISTS "couriers_public_read" ON public.couriers;

CREATE POLICY "couriers_public_read" ON public.couriers
  FOR SELECT USING (registration_status = 'APPROVED' AND status = 'ACTIVE');

CREATE POLICY "couriers_own_access" ON public.couriers
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "couriers_admin_access" ON public.couriers
  FOR ALL USING (public.is_admin());

-- Orders policies
DROP POLICY IF EXISTS "orders_buyer_access" ON public.orders;
DROP POLICY IF EXISTS "orders_merchant_access" ON public.orders;
DROP POLICY IF EXISTS "orders_courier_access" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_access" ON public.orders;

CREATE POLICY "orders_buyer_access" ON public.orders
  FOR ALL USING (buyer_id = auth.uid());

CREATE POLICY "orders_merchant_access" ON public.orders
  FOR ALL USING (public.is_order_merchant(id));

CREATE POLICY "orders_courier_access" ON public.orders
  FOR ALL USING (public.is_order_courier(id));

CREATE POLICY "orders_admin_access" ON public.orders
  FOR ALL USING (public.is_admin());