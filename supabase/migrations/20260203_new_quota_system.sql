-- New Quota System Migration

-- 0. Cleanup old rules if necessary
-- The old logic was hardcoded in the application and simple decrement in DB.
-- We will replace the use_merchant_quota function.

-- 1. Create table for Quota Tiers Configuration
CREATE TABLE public.quota_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_price INTEGER NOT NULL,
  max_price INTEGER, -- NULL means no upper limit
  credit_cost INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quota_tiers ENABLE ROW LEVEL SECURITY;

-- RLS for quota_tiers
CREATE POLICY "Anyone can view quota tiers" 
ON public.quota_tiers FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage quota tiers" 
ON public.quota_tiers FOR ALL 
USING (is_admin());

-- Insert default tiers based on user request
INSERT INTO public.quota_tiers (min_price, max_price, credit_cost) VALUES
(0, 3000, 1),
(3001, 4999, 2),
(5000, 9999, 3),
(10000, 14999, 5),
(15000, NULL, 10);

-- 2. Modify transaction_packages to use "credits" instead of "transactions"
-- We'll keep the column name transaction_quota but treat it as credits conceptually, 
-- or we can add a comment to clarify.
COMMENT ON COLUMN public.transaction_packages.transaction_quota IS 'Total credits provided by this package';

-- 3. Create a function to calculate credit cost based on product price
CREATE OR REPLACE FUNCTION public.calculate_order_credit_cost(p_order_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_credits INTEGER := 0;
  v_item RECORD;
  v_tier_cost INTEGER;
BEGIN
  -- Loop through items in the order
  FOR v_item IN SELECT product_price, quantity FROM order_items WHERE order_id = p_order_id LOOP
    -- Find the matching tier for this product price
    SELECT credit_cost INTO v_tier_cost 
    FROM quota_tiers 
    WHERE v_item.product_price >= min_price 
      AND (max_price IS NULL OR v_item.product_price <= max_price)
    LIMIT 1;
    
    -- Default to 1 if no tier found (safety)
    IF v_tier_cost IS NULL THEN
      v_tier_cost := 1;
    END IF;
    
    v_total_credits := v_total_credits + (v_tier_cost * v_item.quantity);
  END LOOP;
  
  RETURN v_total_credits;
END;
$$;

-- 4. Update use_merchant_quota to accept credit amount
CREATE OR REPLACE FUNCTION public.use_merchant_quota_v2(p_merchant_id UUID, p_credits INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  -- Find active subscription with enough quota
  SELECT id INTO v_sub_id
  FROM merchant_subscriptions
  WHERE merchant_id = p_merchant_id
    AND status = 'ACTIVE'
    AND expired_at > now()
    AND (transaction_quota - used_quota) >= p_credits
  ORDER BY expired_at ASC -- Use the one expiring soonest first
  LIMIT 1;
  
  IF v_sub_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE merchant_subscriptions
  SET used_quota = used_quota + p_credits, updated_at = now()
  WHERE id = v_sub_id;
  
  RETURN TRUE;
END;
$$;

-- 5. Keep the old use_merchant_quota for backward compatibility but update it to use 1 credit
CREATE OR REPLACE FUNCTION public.use_merchant_quota(p_merchant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN use_merchant_quota_v2(p_merchant_id, 1);
END;
$$;
