
-- Create a function to deduct a specific number of credits from merchant quota
-- This replaces the single-deduction version for tier-based quota costs
CREATE OR REPLACE FUNCTION public.deduct_merchant_quota(p_merchant_id UUID, p_credits INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id UUID;
  v_remaining INTEGER;
BEGIN
  -- Find active subscription with enough remaining quota (FIFO by expiry)
  SELECT id, (transaction_quota - used_quota)
  INTO v_sub_id, v_remaining
  FROM public.merchant_subscriptions
  WHERE merchant_id = p_merchant_id
    AND status = 'ACTIVE'
    AND expired_at > now()
    AND (transaction_quota - used_quota) >= p_credits
  ORDER BY expired_at ASC
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.merchant_subscriptions
  SET used_quota = used_quota + p_credits, updated_at = now()
  WHERE id = v_sub_id;

  RETURN TRUE;
END;
$$;
