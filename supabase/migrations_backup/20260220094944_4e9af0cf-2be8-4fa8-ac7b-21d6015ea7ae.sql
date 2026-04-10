
-- Add is_self_delivery column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_self_delivery boolean DEFAULT false;
