-- Add QRIS image URL to merchants table
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS qris_image_url TEXT;

-- Add admin default payment settings to app_settings if not exists
INSERT INTO public.app_settings (key, value, category, description)
VALUES (
  'admin_payment_info',
  '{"bank_name": "", "bank_account_number": "", "bank_account_name": "", "qris_image_url": ""}',
  'payment',
  'Default payment info (bank & QRIS) used for merchants who have not set their own'
)
ON CONFLICT (key) DO NOTHING;