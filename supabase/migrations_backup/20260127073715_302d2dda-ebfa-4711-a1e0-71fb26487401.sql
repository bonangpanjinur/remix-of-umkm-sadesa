-- Create verifikator_withdrawals table for withdrawal requests
CREATE TABLE public.verifikator_withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  verifikator_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.verifikator_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Verifikators can view own withdrawals" ON public.verifikator_withdrawals
  FOR SELECT USING (verifikator_id = auth.uid());

CREATE POLICY "Verifikators can create withdrawals" ON public.verifikator_withdrawals
  FOR INSERT WITH CHECK (verifikator_id = auth.uid() AND status = 'PENDING');

CREATE POLICY "Admins can manage all withdrawals" ON public.verifikator_withdrawals
  FOR ALL USING (is_admin());

-- Add balance columns to track verifikator earnings
ALTER TABLE public.verifikator_earnings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Function to process verifikator withdrawal
CREATE OR REPLACE FUNCTION process_verifikator_withdrawal(
  p_withdrawal_id UUID,
  p_status TEXT,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_withdrawal RECORD;
  v_total_pending INTEGER;
BEGIN
  -- Get the withdrawal
  SELECT * INTO v_withdrawal FROM verifikator_withdrawals WHERE id = p_withdrawal_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;
  
  IF v_withdrawal.status != 'PENDING' THEN
    RAISE EXCEPTION 'Withdrawal already processed';
  END IF;
  
  IF p_status = 'APPROVED' THEN
    -- Calculate total pending earnings for this verifikator
    SELECT COALESCE(SUM(commission_amount), 0) INTO v_total_pending
    FROM verifikator_earnings
    WHERE verifikator_id = v_withdrawal.verifikator_id AND status = 'PENDING';
    
    IF v_total_pending < v_withdrawal.amount THEN
      RAISE EXCEPTION 'Insufficient pending balance';
    END IF;
    
    -- Mark earnings as PAID up to the withdrawal amount
    WITH earnings_to_pay AS (
      SELECT id, commission_amount,
        SUM(commission_amount) OVER (ORDER BY created_at) as running_total
      FROM verifikator_earnings
      WHERE verifikator_id = v_withdrawal.verifikator_id AND status = 'PENDING'
      ORDER BY created_at
    )
    UPDATE verifikator_earnings
    SET status = 'PAID', paid_at = now()
    WHERE id IN (
      SELECT id FROM earnings_to_pay WHERE running_total <= v_withdrawal.amount
    );
  END IF;
  
  -- Update withdrawal status
  UPDATE verifikator_withdrawals
  SET 
    status = p_status,
    admin_notes = p_admin_notes,
    processed_by = auth.uid(),
    processed_at = now(),
    updated_at = now()
  WHERE id = p_withdrawal_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;