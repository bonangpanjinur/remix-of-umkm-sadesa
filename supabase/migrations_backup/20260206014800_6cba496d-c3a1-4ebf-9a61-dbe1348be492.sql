-- Drop and recreate the status check constraint to include all needed statuses
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status = ANY (ARRAY[
  'NEW'::text, 
  'PENDING_CONFIRMATION'::text,
  'PENDING_PAYMENT'::text,
  'PROCESSED'::text, 
  'READY'::text,
  'ASSIGNED'::text,
  'PICKED_UP'::text,
  'SENT'::text, 
  'DONE'::text, 
  'CANCELED'::text,
  'REJECTED'::text,
  'REJECTED_BY_BUYER'::text,
  'REFUNDED'::text
]));