
ALTER TABLE kas_payments ADD COLUMN IF NOT EXISTS invoice_note text;
ALTER TABLE kas_payments ADD COLUMN IF NOT EXISTS sent_at timestamptz;
