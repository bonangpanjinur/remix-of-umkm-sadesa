-- ROADMAP PHASE 1: CORE BACKEND & DATABASE FIXES
-- This script implements the accumulation logic, transaction validation, and audit logging.

-- 1. Create audit_logs table if it doesn't exist (specifically for quota changes)
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
