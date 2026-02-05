-- Add payment settings columns to merchants table
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS payment_cod_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS payment_transfer_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS bank_account_number text,
ADD COLUMN IF NOT EXISTS bank_account_name text;

-- Update existing merchants with default values
UPDATE public.merchants SET 
  payment_cod_enabled = true,
  payment_transfer_enabled = true
WHERE payment_cod_enabled IS NULL;

COMMENT ON COLUMN public.merchants.payment_cod_enabled IS 'Allow COD payment for this merchant';
COMMENT ON COLUMN public.merchants.payment_transfer_enabled IS 'Allow bank transfer payment for this merchant';
COMMENT ON COLUMN public.merchants.bank_name IS 'Bank name for transfer payments';
COMMENT ON COLUMN public.merchants.bank_account_number IS 'Bank account number';
COMMENT ON COLUMN public.merchants.bank_account_name IS 'Bank account holder name';