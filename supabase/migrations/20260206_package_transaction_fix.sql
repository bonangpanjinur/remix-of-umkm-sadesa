-- Migration: Package Transaction Fix
-- 1. Add payment proof and status to merchant_subscriptions
-- 2. Add payment settings to app_settings
-- 3. Ensure price consistency and quota logic

-- Update merchant_subscriptions to handle payment flow
ALTER TABLE public.merchant_subscriptions 
ADD COLUMN IF NOT EXISTS payment_proof_url text,
ADD COLUMN IF NOT EXISTS admin_notes text;

-- Insert default payment settings if they don't exist
INSERT INTO public.app_settings (key, value, description, category)
VALUES (
  'payment_settings', 
  '{"bank_name": "BCA", "account_number": "1234567890", "account_name": "Admin Desa Digital", "qris_url": ""}',
  'Pengaturan pembayaran untuk pembelian paket oleh merchant',
  'payment'
)
ON CONFLICT (key) DO NOTHING;

-- Trigger to automatically set payment_status to PENDING_APPROVAL when payment_proof_url is updated
CREATE OR REPLACE FUNCTION public.handle_subscription_payment_upload()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_proof_url IS NOT NULL AND (OLD.payment_proof_url IS NULL OR NEW.payment_proof_url <> OLD.payment_proof_url) THEN
    NEW.payment_status := 'PENDING_APPROVAL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_payment_proof_upload ON public.merchant_subscriptions;
CREATE TRIGGER on_payment_proof_upload
  BEFORE UPDATE ON public.merchant_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_payment_upload();

-- Trigger to automatically set merchant's current_subscription_id when a subscription is marked as PAID and ACTIVE
CREATE OR REPLACE FUNCTION public.handle_subscription_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- If status becomes ACTIVE and payment_status is PAID
  IF (NEW.status = 'ACTIVE' AND NEW.payment_status = 'PAID') AND 
     (OLD.status <> 'ACTIVE' OR OLD.payment_status <> 'PAID') THEN
    
    -- Update merchant's current subscription
    UPDATE public.merchants 
    SET current_subscription_id = NEW.id
    WHERE id = NEW.merchant_id;
    
    -- Deactivate other active subscriptions for this merchant (optional, depending on business rule)
    -- UPDATE public.merchant_subscriptions
    -- SET status = 'INACTIVE'
    -- WHERE merchant_id = NEW.merchant_id AND id <> NEW.id AND status = 'ACTIVE';
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_subscription_activation ON public.merchant_subscriptions;
CREATE TRIGGER on_subscription_activation
  AFTER UPDATE ON public.merchant_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_activation();
