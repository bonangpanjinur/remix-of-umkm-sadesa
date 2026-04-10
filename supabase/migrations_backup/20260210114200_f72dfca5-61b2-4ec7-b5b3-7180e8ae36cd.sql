
-- 1. Setting kuota gratis
INSERT INTO app_settings (key, value, description, category) 
VALUES ('free_tier_quota', '{"limit": 100}', 'Jumlah kuota gratis bulanan untuk merchant baru', 'merchant')
ON CONFLICT (key) DO NOTHING;

-- 2. Setting komisi kurir  
INSERT INTO app_settings (key, value, description, category)
VALUES ('courier_commission', '{"percent": 80}', 'Persentase komisi kurir dari ongkir', 'courier')
ON CONFLICT (key) DO NOTHING;

-- 3. Tabel withdrawal kurir
CREATE TABLE IF NOT EXISTS public.courier_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES public.couriers(id) NOT NULL,
  amount NUMERIC NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for courier_withdrawal_requests
ALTER TABLE public.courier_withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couriers can view own withdrawals"
ON public.courier_withdrawal_requests FOR SELECT
USING (courier_id = public.get_user_courier_id());

CREATE POLICY "Couriers can create own withdrawals"
ON public.courier_withdrawal_requests FOR INSERT
WITH CHECK (courier_id = public.get_user_courier_id());

CREATE POLICY "Admins full access courier withdrawals"
ON public.courier_withdrawal_requests FOR ALL
USING (public.is_admin());

-- Trigger updated_at
CREATE TRIGGER update_courier_withdrawal_requests_updated_at
BEFORE UPDATE ON public.courier_withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Kolom saldo di couriers
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS available_balance NUMERIC DEFAULT 0;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS pending_balance NUMERIC DEFAULT 0;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC DEFAULT 0;

-- 5. Kolom bank di couriers
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
