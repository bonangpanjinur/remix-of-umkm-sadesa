-- Add blocking fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS blocked_by uuid,
ADD COLUMN IF NOT EXISTS block_reason text;

-- Create refund_requests table
CREATE TABLE public.refund_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    buyer_id uuid NOT NULL,
    amount integer NOT NULL,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING',
    admin_notes text,
    processed_by uuid,
    processed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create admin_audit_logs table
CREATE TABLE public.admin_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id uuid NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    old_value jsonb,
    new_value jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS for refund_requests
CREATE POLICY "Admins can manage refunds" ON public.refund_requests
FOR ALL USING (is_admin());

CREATE POLICY "Buyers can view own refunds" ON public.refund_requests
FOR SELECT USING (buyer_id = auth.uid());

CREATE POLICY "Buyers can create refund requests" ON public.refund_requests
FOR INSERT WITH CHECK (buyer_id = auth.uid() AND status = 'PENDING');

-- RLS for admin_audit_logs (admin only)
CREATE POLICY "Admins can view logs" ON public.admin_audit_logs
FOR SELECT USING (is_admin());

CREATE POLICY "Admins can insert logs" ON public.admin_audit_logs
FOR INSERT WITH CHECK (is_admin());

-- Update profiles RLS to allow admin to update block status
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id AND is_blocked = false);

CREATE POLICY "Admins can update any profile" ON public.profiles
FOR ALL USING (is_admin());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_buyer ON public.refund_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity ON public.admin_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_refund_requests_updated_at
BEFORE UPDATE ON public.refund_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();