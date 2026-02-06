-- Migration: Full Quota System Improvements
-- This migration consolidates all SQL changes for the merchant transaction quota system.

-- =====================================================
-- PHASE 1: CORE BACKEND & DATABASE FIXES
-- =====================================================

-- 1. Create quota_audit_logs table
CREATE TABLE IF NOT EXISTS public.quota_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    subscription_id UUID REFERENCES public.merchant_subscriptions(id),
    action_type TEXT NOT NULL, -- 'PURCHASE', 'USAGE', 'RECONCILIATION', 'REFUND'
    previous_quota INTEGER NOT NULL,
    change_amount INTEGER NOT NULL,
    new_quota INTEGER NOT NULL,
    reference_id UUID, -- order_id or package_transaction_id
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID -- auth.uid()
);

-- Enable RLS for quota_audit_logs
ALTER TABLE public.quota_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their own quota logs"
ON public.quota_audit_logs FOR SELECT
TO authenticated
USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all quota logs"
ON public.quota_audit_logs FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 2. Improved approve_quota_subscription with accumulation logic
CREATE OR REPLACE FUNCTION public.approve_quota_subscription(p_subscription_id UUID, p_admin_notes TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub RECORD;
    v_active_sub RECORD;
    v_remaining_quota INTEGER := 0;
    v_new_total_quota INTEGER;
BEGIN
    -- Get the subscription to approve
    SELECT * INTO v_sub FROM public.merchant_subscriptions WHERE id = p_subscription_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Subscription tidak ditemukan');
    END IF;

    IF v_sub.payment_status = 'PAID' AND v_sub.status = 'ACTIVE' THEN
        RETURN json_build_object('success', false, 'message', 'Subscription sudah aktif');
    END IF;

    -- Find current active subscription to accumulate quota
    SELECT * INTO v_active_sub 
    FROM public.merchant_subscriptions 
    WHERE merchant_id = v_sub.merchant_id 
      AND status = 'ACTIVE' 
      AND expired_at > now()
    ORDER BY expired_at DESC
    LIMIT 1;

    IF FOUND THEN
        v_remaining_quota := v_active_sub.transaction_quota - v_active_sub.used_quota;
        
        -- Mark old subscription as COMPLETED
        UPDATE public.merchant_subscriptions
        SET status = 'COMPLETED', updated_at = now()
        WHERE id = v_active_sub.id;
    END IF;

    -- Calculate new total quota
    v_new_total_quota := v_sub.transaction_quota + v_remaining_quota;

    -- Update the new subscription
    UPDATE public.merchant_subscriptions 
    SET 
        status = 'ACTIVE', 
        payment_status = 'PAID', 
        paid_at = now(),
        admin_notes = p_admin_notes,
        transaction_quota = v_new_total_quota,
        used_quota = 0, -- Reset used quota because we've accumulated the remaining into transaction_quota
        updated_at = now()
    WHERE id = p_subscription_id;

    -- Update current_subscription_id in merchants table
    UPDATE public.merchants
    SET 
        current_subscription_id = p_subscription_id,
        updated_at = now()
    WHERE id = v_sub.merchant_id;

    -- Log the audit
    INSERT INTO public.quota_audit_logs (
        merchant_id,
        subscription_id,
        action_type,
        previous_quota,
        change_amount,
        new_quota,
        notes,
        created_by
    ) VALUES (
        v_sub.merchant_id,
        p_subscription_id,
        'PURCHASE',
        v_remaining_quota,
        v_sub.transaction_quota,
        v_new_total_quota,
        'Persetujuan paket: ' || p_subscription_id,
        auth.uid()
    );

    RETURN json_build_object('success', true, 'message', 'Subscription berhasil disetujui dengan akumulasi kuota');
END;
$$;

-- 3. Improved use_merchant_quota with validation and logging
CREATE OR REPLACE FUNCTION public.use_merchant_quota_v2(p_merchant_id UUID, p_credits INTEGER, p_order_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub_id UUID;
    v_current_quota INTEGER;
    v_used_quota INTEGER;
BEGIN
    -- 1. Validate if this order has already deducted quota (prevent double deduction)
    IF p_order_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.quota_audit_logs WHERE reference_id = p_order_id AND action_type = 'USAGE') THEN
            RETURN TRUE; -- Already deducted
        END IF;
    END IF;

    -- 2. Find active subscription with enough quota
    SELECT id, transaction_quota, used_quota INTO v_sub_id, v_current_quota, v_used_quota
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

    -- 3. Deduct quota
    UPDATE public.merchant_subscriptions
    SET used_quota = used_quota + p_credits, 
        updated_at = now()
    WHERE id = v_sub_id;

    -- 4. Log the audit
    INSERT INTO public.quota_audit_logs (
        merchant_id,
        subscription_id,
        action_type,
        previous_quota,
        change_amount,
        new_quota,
        reference_id,
        notes
    ) VALUES (
        p_merchant_id,
        v_sub_id,
        'USAGE',
        v_current_quota - v_used_quota,
        -p_credits,
        v_current_quota - (v_used_quota + p_credits),
        p_order_id,
        'Pemakaian kuota untuk order: ' || COALESCE(p_order_id::text, 'N/A')
    );
    
    RETURN TRUE;
END;
$$;

-- Update the legacy function to call v2
CREATE OR REPLACE FUNCTION public.use_merchant_quota(p_merchant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN use_merchant_quota_v2(p_merchant_id, 1, NULL);
END;
$$;

-- =====================================================
-- PHASE 2: RECONCILIATION & DATA RECOVERY
-- =====================================================

-- 1. Analysis Query: Compare current quota vs historical purchases
-- This query helps identify merchants whose current quota doesn't match their purchase history.
-- Note: This assumes 'PAID' subscriptions are the source of truth for granted quota.
CREATE OR REPLACE VIEW public.quota_discrepancy_analysis AS
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

-- =====================================================
-- PHASE 4: MONITORING & PREVENTION (LONG-TERM)
-- =====================================================

-- 1. Low Quota Alert System
-- This trigger automatically sends a notification when quota falls below a threshold.
CREATE OR REPLACE FUNCTION public.check_low_quota_alert()
RETURNS TRIGGER AS $$
DECLARE
    v_remaining INTEGER;
    v_merchant_name TEXT;
    v_user_id UUID;
BEGIN
    v_remaining := NEW.transaction_quota - NEW.used_quota;
    
    -- Only alert if quota just crossed the threshold (e.g., 5)
    -- and it's a reduction in quota (used_quota increased)
    IF v_remaining <= 5 AND NEW.used_quota > OLD.used_quota AND (OLD.transaction_quota - OLD.used_quota) > 5 THEN
        -- Get merchant info
        SELECT name, user_id INTO v_merchant_name, v_user_id
        FROM public.merchants
        WHERE id = NEW.merchant_id;

        -- Send notification (using existing send_notification RPC)
        PERFORM public.send_notification(
            v_user_id,
            'Kuota Transaksi Hampir Habis',
            'Sisa kuota transaksi Anda tinggal ' || v_remaining || '. Segera isi ulang agar toko tetap aktif.',
            'warning',
            '/merchant/subscription'
        );
    END IF;

    -- Alert if quota is completely empty
    IF v_remaining = 0 AND NEW.used_quota > OLD.used_quota AND (OLD.transaction_quota - OLD.used_quota) > 0 THEN
        SELECT name, user_id INTO v_merchant_name, v_user_id
        FROM public.merchants
        WHERE id = NEW.merchant_id;

        PERFORM public.send_notification(
            v_user_id,
            'Kuota Transaksi Habis!',
            'Kuota transaksi Anda telah habis. Toko Anda sementara tidak dapat menerima pesanan baru.',
            'error',
            '/merchant/subscription'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_quota_usage_alert ON public.merchant_subscriptions;
CREATE TRIGGER on_quota_usage_alert
    AFTER UPDATE OF used_quota ON public.merchant_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_low_quota_alert();

-- 2. Auto-reconciliation Job (Conceptual for Edge Function)
-- This query can be run by a cron job to detect anomalies.
CREATE OR REPLACE VIEW public.quota_anomalies AS
WITH purchase_summary AS (
    SELECT merchant_id, SUM(transaction_quota) as total_granted
    FROM public.merchant_subscriptions
    WHERE payment_status = 'PAID'
    GROUP BY merchant_id
),
usage_summary AS (
    SELECT merchant_id, COUNT(*) as total_used
    FROM public.orders
    WHERE status NOT IN ('CANCELLED', 'REFUNDED')
    GROUP BY merchant_id
),
current_status AS (
    SELECT merchant_id, SUM(transaction_quota - used_quota) as current_remaining
    FROM public.merchant_subscriptions
    WHERE status = 'ACTIVE' AND expired_at > now()
    GROUP BY merchant_id
)
SELECT 
    m.id as merchant_id,
    m.name as merchant_name,
    COALESCE(ps.total_granted, 0) as purchased,
    COALESCE(us.total_used, 0) as used,
    COALESCE(cs.current_remaining, 0) as actual,
    (COALESCE(ps.total_granted, 0) - COALESCE(us.total_used, 0)) as expected,
    ((COALESCE(ps.total_granted, 0) - COALESCE(us.total_used, 0)) - COALESCE(cs.current_remaining, 0)) as discrepancy
FROM public.merchants m
LEFT JOIN purchase_summary ps ON m.id = ps.merchant_id
LEFT JOIN usage_summary us ON m.id = us.merchant_id
LEFT JOIN current_status cs ON m.id = cs.merchant_id
WHERE ABS((COALESCE(ps.total_granted, 0) - COALESCE(us.total_used, 0)) - COALESCE(cs.current_remaining, 0)) > 0;

-- 3. Admin Dashboard Helper
-- Summary of quota circulation for admin monitoring.
CREATE OR REPLACE VIEW public.quota_circulation_summary AS
SELECT 
    COUNT(DISTINCT merchant_id) as active_merchants,
    SUM(transaction_quota) as total_quota_issued,
    SUM(used_quota) as total_quota_used,
    SUM(transaction_quota - used_quota) as total_quota_remaining,
    ROUND(AVG((used_quota::numeric / NULLIF(transaction_quota, 0)) * 100), 2) as avg_usage_percentage
FROM public.merchant_subscriptions
WHERE status = 'ACTIVE' AND expired_at > now();
