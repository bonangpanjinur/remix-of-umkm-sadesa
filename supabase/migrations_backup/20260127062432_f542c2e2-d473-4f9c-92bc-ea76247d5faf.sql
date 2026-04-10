-- Add foreign key for admin_audit_logs to profiles
ALTER TABLE public.admin_audit_logs 
ADD CONSTRAINT admin_audit_logs_admin_id_fkey 
FOREIGN KEY (admin_id) REFERENCES auth.users(id);

-- Add foreign key for refund_requests buyer_id to auth.users
ALTER TABLE public.refund_requests 
ADD CONSTRAINT refund_requests_buyer_id_fkey 
FOREIGN KEY (buyer_id) REFERENCES auth.users(id);