-- ROADMAP PHASE 2: RECONCILIATION & DATA RECOVERY
-- This script provides queries to analyze quota discrepancies and a procedure to patch data.

-- 1. Analysis Query: Compare current quota vs historical purchases
-- This query helps identify merchants whose current quota doesn't match their purchase history.
-- Note: This assumes 'PAID' subscriptions are the source of truth for granted quota.
WITH purchase_summary AS (
    SELECT 
        merchant_id,
        SUM(transaction_quota) as total_granted_quota
    FROM public.merchant_subscriptions
    WHERE payment_status = 'PAID'
    GROUP BY merchant_id
),
usage_summary AS (
    -- If you have an orders table, you can estimate usage from there
    -- This is a fallback if used_quota in subscriptions was overwritten
    SELECT 
        merchant_id,
        COUNT(*) as estimated_usage
    FROM public.orders
    WHERE status NOT IN ('CANCELLED', 'REFUNDED')
    GROUP BY merchant_id
),
current_quota_summary AS (
    SELECT 
        merchant_id,
        SUM(transaction_quota - used_quota) as current_remaining_quota
    FROM public.merchant_subscriptions
    WHERE status = 'ACTIVE' AND expired_at > now()
    GROUP BY merchant_id
)
SELECT 
    m.id as merchant_id,
    m.name as merchant_name,
    COALESCE(ps.total_granted_quota, 0) as total_purchased,
    COALESCE(us.estimated_usage, 0) as total_used_estimated,
    (COALESCE(ps.total_granted_quota, 0) - COALESCE(us.estimated_usage, 0)) as expected_remaining,
    COALESCE(cqs.current_remaining_quota, 0) as actual_remaining,
    ((COALESCE(ps.total_granted_quota, 0) - COALESCE(us.estimated_usage, 0)) - COALESCE(cqs.current_remaining_quota, 0)) as discrepancy
FROM public.merchants m
LEFT JOIN purchase_summary ps ON m.id = ps.merchant_id
LEFT JOIN usage_summary us ON m.id = us.merchant_id
LEFT JOIN current_quota_summary cqs ON m.id = cqs.merchant_id
WHERE ABS((COALESCE(ps.total_granted_quota, 0) - COALESCE(us.estimated_usage, 0)) - COALESCE(cqs.current_remaining_quota, 0)) > 0;

-- 2. Data Patching Procedure (One-time script)
-- This function can be called to recalculate and fix a merchant's quota.
CREATE OR REPLACE FUNCTION public.reconcile_merchant_quota(p_merchant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_purchased INTEGER;
    v_total_used INTEGER;
    v_expected_remaining INTEGER;
    v_active_sub_id UUID;
    v_current_remaining INTEGER;
BEGIN
    -- Calculate total purchased credits
    SELECT COALESCE(SUM(transaction_quota), 0) INTO v_total_purchased
    FROM public.merchant_subscriptions
    WHERE merchant_id = p_merchant_id AND payment_status = 'PAID';

    -- Calculate total used credits (from orders)
    -- Adjust this logic if you use a different way to track usage
    SELECT COUNT(*) INTO v_total_used
    FROM public.orders
    WHERE merchant_id = p_merchant_id AND status NOT IN ('CANCELLED', 'REFUNDED');

    v_expected_remaining := v_total_purchased - v_total_used;
    IF v_expected_remaining < 0 THEN v_expected_remaining := 0; END IF;

    -- Find the latest active subscription to apply the fix
    SELECT id, (transaction_quota - used_quota) INTO v_active_sub_id, v_current_remaining
    FROM public.merchant_subscriptions
    WHERE merchant_id = p_merchant_id AND status = 'ACTIVE' AND expired_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_active_sub_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'No active subscription found to patch');
    END IF;

    -- Apply the fix: adjust transaction_quota to make (transaction_quota - used_quota) = v_expected_remaining
    -- We keep used_quota as is and change transaction_quota for audit clarity
    UPDATE public.merchant_subscriptions
    SET transaction_quota = used_quota + v_expected_remaining,
        updated_at = now()
    WHERE id = v_active_sub_id;

    -- Log the reconciliation
    INSERT INTO public.quota_audit_logs (
        merchant_id,
        subscription_id,
        action_type,
        previous_quota,
        change_amount,
        new_quota,
        notes
    ) VALUES (
        p_merchant_id,
        v_active_sub_id,
        'RECONCILIATION',
        v_current_remaining,
        v_expected_remaining - v_current_remaining,
        v_expected_remaining,
        'Manual reconciliation based on purchase history and order count'
    );

    RETURN json_build_object(
        'success', true, 
        'expected', v_expected_remaining, 
        'previous', v_current_remaining,
        'adjustment', v_expected_remaining - v_current_remaining
    );
END;
$$;
