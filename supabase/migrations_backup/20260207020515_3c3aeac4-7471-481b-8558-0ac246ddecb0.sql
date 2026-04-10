
-- Add auto_complete_at column to track when an order should be auto-completed
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS auto_complete_at TIMESTAMPTZ;

-- When courier marks as DELIVERED, set auto_complete_at to 24 hours later
CREATE OR REPLACE FUNCTION public.set_auto_complete_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to DELIVERED, set auto-complete deadline to 24 hours later
  IF NEW.status = 'DELIVERED' AND (OLD.status IS NULL OR OLD.status <> 'DELIVERED') THEN
    NEW.auto_complete_at := NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_set_auto_complete_deadline ON public.orders;
CREATE TRIGGER trigger_set_auto_complete_deadline
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_auto_complete_deadline();

-- Function to auto-complete orders past their deadline
-- This can be called periodically via pg_cron or an edge function
CREATE OR REPLACE FUNCTION public.auto_complete_delivered_orders()
RETURNS INTEGER AS $$
DECLARE
  completed_count INTEGER;
BEGIN
  UPDATE public.orders
  SET status = 'DONE',
      updated_at = NOW()
  WHERE status = 'DELIVERED'
    AND auto_complete_at IS NOT NULL
    AND auto_complete_at <= NOW();
  
  GET DIAGNOSTICS completed_count = ROW_COUNT;
  RETURN completed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Schedule the auto-complete function to run every hour
SELECT cron.schedule(
  'auto-complete-delivered-orders',
  '0 * * * *',  -- Every hour
  $$SELECT public.auto_complete_delivered_orders()$$
);
