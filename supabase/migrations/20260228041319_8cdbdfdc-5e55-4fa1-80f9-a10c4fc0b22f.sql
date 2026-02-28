
-- Courier deposits table
CREATE TABLE public.courier_deposits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  admin_notes TEXT,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.courier_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couriers can create own deposits" ON public.courier_deposits
  FOR INSERT WITH CHECK (courier_id = get_user_courier_id());

CREATE POLICY "Couriers can view own deposits" ON public.courier_deposits
  FOR SELECT USING (courier_id = get_user_courier_id());

CREATE POLICY "Admins full access courier deposits" ON public.courier_deposits
  FOR ALL USING (is_admin());

-- Courier balance logs table
CREATE TABLE public.courier_balance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  balance_before NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.courier_balance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couriers can view own balance logs" ON public.courier_balance_logs
  FOR SELECT USING (courier_id = get_user_courier_id());

CREATE POLICY "Admins full access balance logs" ON public.courier_balance_logs
  FOR ALL USING (is_admin());

-- Insert courier minimum balance setting
INSERT INTO public.app_settings (key, category, value, description)
VALUES ('courier_minimum_balance', 'courier', '{"amount": 50000}', 'Saldo minimum yang harus tersisa saat kurir melakukan penarikan')
ON CONFLICT (key) DO NOTHING;

-- Enable realtime for balance logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_deposits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_balance_logs;
