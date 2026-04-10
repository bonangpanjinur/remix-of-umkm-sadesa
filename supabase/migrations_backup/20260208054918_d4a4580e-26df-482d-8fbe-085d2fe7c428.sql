
-- =====================================================
-- 1. FIX RLS POLICIES FOR user_roles TABLE
-- =====================================================
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

-- Recreate complete policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert user roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update user roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete user roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- 2. POS (KASIR) SYSTEM TABLES
-- =====================================================

-- POS Packages (admin configures pricing)
CREATE TABLE IF NOT EXISTS public.pos_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration_months INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active POS packages"
  ON public.pos_packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage POS packages"
  ON public.pos_packages FOR ALL
  USING (is_admin());

-- POS Subscriptions (merchant subscriptions for POS feature)
CREATE TABLE IF NOT EXISTS public.pos_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id),
  package_id UUID REFERENCES public.pos_packages(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  payment_amount INTEGER NOT NULL DEFAULT 0,
  payment_proof_url TEXT,
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  started_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  is_trial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own POS subscriptions"
  ON public.pos_subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = pos_subscriptions.merchant_id AND merchants.user_id = auth.uid()));

CREATE POLICY "Merchants can create POS subscriptions"
  ON public.pos_subscriptions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = pos_subscriptions.merchant_id AND merchants.user_id = auth.uid()));

CREATE POLICY "Merchants can update own POS subscriptions"
  ON public.pos_subscriptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = pos_subscriptions.merchant_id AND merchants.user_id = auth.uid()));

CREATE POLICY "Admins can manage all POS subscriptions"
  ON public.pos_subscriptions FOR ALL
  USING (is_admin());

-- POS Transactions (cashier transactions)
CREATE TABLE IF NOT EXISTS public.pos_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id),
  transaction_number TEXT NOT NULL,
  customer_name TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  tax INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'CASH',
  payment_amount INTEGER NOT NULL DEFAULT 0,
  change_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  cashier_name TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage own POS transactions"
  ON public.pos_transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = pos_transactions.merchant_id AND merchants.user_id = auth.uid()));

CREATE POLICY "Admins can view all POS transactions"
  ON public.pos_transactions FOR SELECT
  USING (is_admin());

-- POS Settings per merchant (invoice design, etc.)
CREATE TABLE IF NOT EXISTS public.pos_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL UNIQUE REFERENCES public.merchants(id),
  invoice_header TEXT,
  invoice_footer TEXT,
  show_logo BOOLEAN NOT NULL DEFAULT true,
  show_address BOOLEAN NOT NULL DEFAULT true,
  show_phone BOOLEAN NOT NULL DEFAULT true,
  paper_size TEXT NOT NULL DEFAULT '58mm',
  font_size TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage own POS settings"
  ON public.pos_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = pos_settings.merchant_id AND merchants.user_id = auth.uid()));

CREATE POLICY "Admins can manage all POS settings"
  ON public.pos_settings FOR ALL
  USING (is_admin());

-- App setting for POS config (trial days, etc.)
INSERT INTO public.app_settings (key, value, category, description)
VALUES (
  'pos_config',
  '{"trial_days": 30, "is_enabled": true}'::jsonb,
  'features',
  'Konfigurasi fitur kasir POS'
) ON CONFLICT (key) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER update_pos_packages_updated_at
  BEFORE UPDATE ON public.pos_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_pos_subscriptions_updated_at
  BEFORE UPDATE ON public.pos_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_pos_settings_updated_at
  BEFORE UPDATE ON public.pos_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
