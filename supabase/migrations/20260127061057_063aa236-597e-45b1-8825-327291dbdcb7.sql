-- Add payment columns to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'UNPAID',
ADD COLUMN IF NOT EXISTS payment_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS payment_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_channel TEXT;

-- Add index for payment status
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

-- Comment for documentation
COMMENT ON COLUMN public.orders.payment_status IS 'Payment status: UNPAID, PENDING, PAID, EXPIRED, REFUNDED';
COMMENT ON COLUMN public.orders.payment_invoice_id IS 'Xendit invoice ID';
COMMENT ON COLUMN public.orders.payment_invoice_url IS 'URL for payment page';