-- =============================================
-- MERCHANT DASHBOARD & COD SECURITY SCHEMA
-- =============================================

-- 1. Add product analytics columns
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 5;

-- 2. Add COD security fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS cod_fail_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_verified_buyer BOOLEAN DEFAULT false;

-- 3. Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  buyer_id UUID NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  image_urls TEXT[] DEFAULT '{}',
  merchant_reply TEXT,
  merchant_replied_at TIMESTAMP WITH TIME ZONE,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Create insurance_fund table for COD protection
CREATE TABLE IF NOT EXISTS public.insurance_fund (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'contribution' or 'claim'
  status TEXT DEFAULT 'PENDING', -- For claims: PENDING, APPROVED, REJECTED
  claim_reason TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Add COD-related fields to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS flash_sale_discount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cod_service_fee INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS buyer_distance_km NUMERIC;

-- 7. Add merchant balance tracking
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS available_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_withdrawn INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cod_max_amount INTEGER DEFAULT 75000,
ADD COLUMN IF NOT EXISTS cod_max_distance_km NUMERIC DEFAULT 3;

-- Enable RLS on new tables
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_fund ENABLE ROW LEVEL SECURITY;

-- Reviews policies
CREATE POLICY "Anyone can view visible reviews" ON public.reviews
FOR SELECT USING (is_visible = true);

CREATE POLICY "Buyers can create reviews for their orders" ON public.reviews
FOR INSERT WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Merchants can reply to their reviews" ON public.reviews
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM merchants 
    WHERE merchants.id = reviews.merchant_id 
    AND merchants.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage reviews" ON public.reviews
FOR ALL USING (is_admin());

-- Withdrawal requests policies
CREATE POLICY "Merchants can view own withdrawals" ON public.withdrawal_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM merchants 
    WHERE merchants.id = withdrawal_requests.merchant_id 
    AND merchants.user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can create withdrawals" ON public.withdrawal_requests
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM merchants 
    WHERE merchants.id = withdrawal_requests.merchant_id 
    AND merchants.user_id = auth.uid()
  ) AND status = 'PENDING'
);

CREATE POLICY "Admins can manage withdrawals" ON public.withdrawal_requests
FOR ALL USING (is_admin());

-- Insurance fund policies
CREATE POLICY "Merchants can view own insurance" ON public.insurance_fund
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM merchants 
    WHERE merchants.id = insurance_fund.merchant_id 
    AND merchants.user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can create claims" ON public.insurance_fund
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM merchants 
    WHERE merchants.id = insurance_fund.merchant_id 
    AND merchants.user_id = auth.uid()
  ) AND type = 'claim' AND status = 'PENDING'
);

CREATE POLICY "Admins can manage insurance fund" ON public.insurance_fund
FOR ALL USING (is_admin());

-- Function to check COD eligibility
CREATE OR REPLACE FUNCTION public.check_cod_eligibility(
  p_buyer_id UUID,
  p_merchant_id UUID,
  p_total_amount INTEGER,
  p_distance_km NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_merchant RECORD;
  v_result JSONB;
BEGIN
  -- Get buyer profile
  SELECT cod_enabled, trust_score, cod_fail_count 
  INTO v_profile 
  FROM profiles 
  WHERE user_id = p_buyer_id;
  
  -- Get merchant settings
  SELECT cod_max_amount, cod_max_distance_km 
  INTO v_merchant 
  FROM merchants 
  WHERE id = p_merchant_id;
  
  -- Check eligibility
  IF v_profile.cod_enabled = false THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Akun Anda tidak dapat menggunakan fitur COD.');
  END IF;
  
  IF v_profile.trust_score < 50 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Skor kepercayaan Anda terlalu rendah untuk COD.');
  END IF;
  
  IF p_total_amount > COALESCE(v_merchant.cod_max_amount, 75000) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Nominal terlalu besar untuk COD. Maks: Rp ' || COALESCE(v_merchant.cod_max_amount, 75000));
  END IF;
  
  IF p_distance_km IS NOT NULL AND p_distance_km > COALESCE(v_merchant.cod_max_distance_km, 3) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Jarak terlalu jauh untuk COD. Maks: ' || COALESCE(v_merchant.cod_max_distance_km, 3) || ' KM');
  END IF;
  
  RETURN jsonb_build_object('eligible', true, 'reason', NULL);
END;
$$;

-- Function to update trust score after COD result
CREATE OR REPLACE FUNCTION public.update_trust_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If order was rejected by buyer (COD failed)
  IF NEW.status = 'REJECTED_BY_BUYER' AND OLD.status != 'REJECTED_BY_BUYER' THEN
    UPDATE profiles 
    SET 
      trust_score = GREATEST(0, trust_score - 50),
      cod_fail_count = cod_fail_count + 1,
      cod_enabled = CASE WHEN trust_score - 50 < 50 THEN false ELSE cod_enabled END
    WHERE user_id = NEW.buyer_id;
  END IF;
  
  -- If COD order completed successfully
  IF NEW.status = 'DONE' AND OLD.status != 'DONE' AND NEW.payment_method = 'COD' THEN
    UPDATE profiles 
    SET trust_score = LEAST(100, trust_score + 1)
    WHERE user_id = NEW.buyer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for trust score updates
DROP TRIGGER IF EXISTS trigger_update_trust_score ON orders;
CREATE TRIGGER trigger_update_trust_score
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_trust_score();

-- Function to auto-cancel pending confirmation orders
CREATE OR REPLACE FUNCTION public.auto_cancel_pending_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE orders
  SET 
    status = 'CANCELED',
    notes = COALESCE(notes, '') || ' [Auto-canceled: Tidak dikonfirmasi dalam 15 menit]',
    updated_at = now()
  WHERE 
    status = 'PENDING_CONFIRMATION'
    AND confirmation_deadline < now();
END;
$$;

-- Update updated_at trigger for new tables
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();