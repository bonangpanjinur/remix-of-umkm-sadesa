-- Rename kas_fee to group_commission_percent in transaction_packages
ALTER TABLE public.transaction_packages 
  DROP COLUMN kas_fee,
  ADD COLUMN group_commission_percent numeric NOT NULL DEFAULT 5;

-- Add comment for clarity
COMMENT ON COLUMN public.transaction_packages.group_commission_percent IS 'Percentage of package price that goes to the trade group/verifikator';

-- Create table to track verifikator earnings from package purchases
CREATE TABLE public.verifikator_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  verifikator_id UUID NOT NULL,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.merchant_subscriptions(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.transaction_packages(id) ON DELETE CASCADE,
  package_amount INTEGER NOT NULL,
  commission_percent NUMERIC NOT NULL,
  commission_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.verifikator_earnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all earnings"
  ON public.verifikator_earnings FOR ALL
  USING (is_admin());

CREATE POLICY "Verifikators can view own earnings"
  ON public.verifikator_earnings FOR SELECT
  USING (verifikator_id = auth.uid());

-- Add group_id to merchants to track their trade group membership
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.trade_groups(id) ON DELETE SET NULL;

-- Function to auto-assign merchant to trade group when registering with verifikator code
CREATE OR REPLACE FUNCTION public.auto_assign_merchant_to_group()
RETURNS TRIGGER AS $$
DECLARE
  v_code RECORD;
  v_group RECORD;
BEGIN
  -- If merchant has verifikator_code, find the group and assign
  IF NEW.verifikator_code IS NOT NULL AND NEW.group_id IS NULL THEN
    -- Get verifikator code info
    SELECT * INTO v_code FROM verifikator_codes 
    WHERE code = NEW.verifikator_code AND is_active = true
    LIMIT 1;
    
    IF v_code IS NOT NULL THEN
      -- Find trade group by verifikator
      SELECT * INTO v_group FROM trade_groups 
      WHERE verifikator_id = v_code.verifikator_id AND is_active = true
      LIMIT 1;
      
      IF v_group IS NOT NULL THEN
        NEW.group_id := v_group.id;
        
        -- Also insert into group_members if not exists
        INSERT INTO group_members (group_id, merchant_id, status)
        VALUES (v_group.id, NEW.id, 'ACTIVE')
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_assign_merchant_group ON merchants;
CREATE TRIGGER trigger_auto_assign_merchant_group
  BEFORE INSERT OR UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_merchant_to_group();

-- Function to calculate and record commission when subscription is paid
CREATE OR REPLACE FUNCTION public.record_verifikator_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_merchant RECORD;
  v_package RECORD;
  v_commission INTEGER;
BEGIN
  -- Only process when payment status changes to PAID
  IF NEW.payment_status = 'PAID' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'PAID') THEN
    -- Get merchant info
    SELECT * INTO v_merchant FROM merchants WHERE id = NEW.merchant_id;
    
    IF v_merchant.verifikator_id IS NOT NULL THEN
      -- Get package info
      SELECT * INTO v_package FROM transaction_packages WHERE id = NEW.package_id;
      
      -- Calculate commission
      v_commission := FLOOR(NEW.payment_amount * v_package.group_commission_percent / 100);
      
      IF v_commission > 0 THEN
        INSERT INTO verifikator_earnings (
          verifikator_id,
          merchant_id,
          subscription_id,
          package_id,
          package_amount,
          commission_percent,
          commission_amount,
          status
        ) VALUES (
          v_merchant.verifikator_id,
          NEW.merchant_id,
          NEW.id,
          NEW.package_id,
          NEW.payment_amount,
          v_package.group_commission_percent,
          v_commission,
          'PENDING'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for commission recording
DROP TRIGGER IF EXISTS trigger_record_verifikator_commission ON merchant_subscriptions;
CREATE TRIGGER trigger_record_verifikator_commission
  AFTER INSERT OR UPDATE ON public.merchant_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.record_verifikator_commission();