-- Cleanup transaction_packages table
-- Remove unused column price_per_transaction as it's replaced by total_price
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_packages' AND column_name='price_per_transaction') THEN
        ALTER TABLE public.transaction_packages DROP COLUMN price_per_transaction;
    END IF;
END $$;

-- Ensure kas_fee is numeric for percentage
ALTER TABLE public.transaction_packages 
ALTER COLUMN kas_fee TYPE NUMERIC(5,2);

-- Add comment to clarify relationship with quota_tiers
COMMENT ON TABLE public.transaction_packages IS 'Paket kuota transaksi yang dapat dibeli oleh merchant. Jumlah kuota yang dikonsumsi per transaksi diatur di tabel quota_tiers.';
