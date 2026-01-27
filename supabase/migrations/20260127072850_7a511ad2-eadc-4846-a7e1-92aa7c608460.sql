-- Create trade_groups table
CREATE TABLE public.trade_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  verifikator_id UUID NOT NULL,
  monthly_fee INTEGER NOT NULL DEFAULT 10000,
  village_id UUID REFERENCES public.villages(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create group_members table (linking merchants to groups)
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.trade_groups(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  UNIQUE(group_id, merchant_id)
);

-- Create kas_payments table for monthly fee tracking
CREATE TABLE public.kas_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.trade_groups(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  payment_month INTEGER NOT NULL,
  payment_year INTEGER NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'UNPAID',
  notes TEXT,
  collected_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, merchant_id, payment_month, payment_year)
);

-- Enable RLS
ALTER TABLE public.trade_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kas_payments ENABLE ROW LEVEL SECURITY;

-- Trade Groups Policies
CREATE POLICY "Verifikators can manage own groups"
ON public.trade_groups FOR ALL
USING (verifikator_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage all groups"
ON public.trade_groups FOR ALL
USING (is_admin());

CREATE POLICY "Anyone can view active groups"
ON public.trade_groups FOR SELECT
USING (is_active = true);

-- Group Members Policies
CREATE POLICY "Verifikators can manage group members"
ON public.group_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM trade_groups 
    WHERE trade_groups.id = group_members.group_id 
    AND (trade_groups.verifikator_id = auth.uid() OR is_admin())
  )
);

CREATE POLICY "Merchants can view own membership"
ON public.group_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM merchants 
    WHERE merchants.id = group_members.merchant_id 
    AND merchants.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all members"
ON public.group_members FOR ALL
USING (is_admin());

-- Kas Payments Policies
CREATE POLICY "Verifikators can manage payments in their groups"
ON public.kas_payments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM trade_groups 
    WHERE trade_groups.id = kas_payments.group_id 
    AND (trade_groups.verifikator_id = auth.uid() OR is_admin())
  )
);

CREATE POLICY "Merchants can view own payments"
ON public.kas_payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM merchants 
    WHERE merchants.id = kas_payments.merchant_id 
    AND merchants.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all payments"
ON public.kas_payments FOR ALL
USING (is_admin());

-- Create function to generate monthly kas records for all group members
CREATE OR REPLACE FUNCTION public.generate_monthly_kas(p_group_id UUID, p_month INTEGER, p_year INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group RECORD;
  v_member RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Get group info
  SELECT * INTO v_group FROM trade_groups WHERE id = p_group_id;
  
  IF v_group IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Insert kas records for all active members
  FOR v_member IN 
    SELECT * FROM group_members 
    WHERE group_id = p_group_id AND status = 'ACTIVE'
  LOOP
    INSERT INTO kas_payments (group_id, merchant_id, amount, payment_month, payment_year, status)
    VALUES (p_group_id, v_member.merchant_id, v_group.monthly_fee, p_month, p_year, 'UNPAID')
    ON CONFLICT (group_id, merchant_id, payment_month, payment_year) DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Create updated_at trigger for new tables
CREATE TRIGGER update_trade_groups_updated_at
  BEFORE UPDATE ON public.trade_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kas_payments_updated_at
  BEFORE UPDATE ON public.kas_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();