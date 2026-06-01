-- ============================================================
-- FILE 02: CORE ENTITIES
-- ============================================================
-- Berisi: villages, categories, tourism, trade_groups, packages,
-- merchants (+ subscriptions, gallery, favorites, kas),
-- verifikator, couriers (+ earnings, deposits, withdrawals,
-- balance logs), quota tiers + usage logs, public views.
-- Idempotent.
-- ============================================================

-- 1. TABEL ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.villages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  province text,
  district text NOT NULL,
  regency text NOT NULL,
  subdistrict text,
  description text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  location_lat numeric,
  location_lng numeric,
  contact_name text,
  contact_phone text,
  contact_email text,
  registration_status text NOT NULL DEFAULT 'PENDING',
  registered_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_villages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  village_id uuid NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  role text DEFAULT 'admin_desa',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, village_id)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trade_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  village_id uuid REFERENCES public.villages(id) ON DELETE SET NULL,
  verifikator_id uuid NOT NULL,
  monthly_fee integer NOT NULL DEFAULT 10000,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transaction_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  classification_price text NOT NULL DEFAULT '',
  price_per_transaction integer NOT NULL DEFAULT 0,
  total_price integer NOT NULL DEFAULT 0,
  group_commission_percent numeric NOT NULL DEFAULT 5,
  kas_fee numeric(5,2) DEFAULT 0,
  transaction_quota integer NOT NULL DEFAULT 100,
  total_credits integer NOT NULL DEFAULT 100,
  validity_days integer NOT NULL DEFAULT 30,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quota_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_price integer NOT NULL DEFAULT 0,
  max_price integer,
  credit_cost integer NOT NULL DEFAULT 1,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tourism (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id uuid NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  location_lat numeric,
  location_lng numeric,
  wa_link text,
  sosmed_link text,
  facilities text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  address text,
  phone text,
  province text,
  city text,
  district text,
  subdistrict text,
  village_id uuid REFERENCES public.villages(id) ON DELETE SET NULL,
  image_url text,
  cover_image_url text,
  ktp_url text,
  slug text,
  business_category text DEFAULT 'kuliner',
  business_description text,
  classification_price text,
  trade_group text,
  verifikator_code text,
  open_time time,
  close_time time,
  is_open boolean NOT NULL DEFAULT true,
  order_mode text NOT NULL DEFAULT 'ADMIN_ASSISTED',
  status text NOT NULL DEFAULT 'ACTIVE',
  registration_status text NOT NULL DEFAULT 'PENDING',
  registered_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  badge text,
  rating_avg numeric DEFAULT 0,
  rating_count integer DEFAULT 0,
  is_verified boolean DEFAULT false,
  verified_at timestamptz,
  verified_by uuid,
  verifikator_id uuid,
  group_id uuid REFERENCES public.trade_groups(id) ON DELETE SET NULL,
  current_subscription_id uuid,
  location_lat numeric,
  location_lng numeric,
  qris_image_url text,
  payment_cod_enabled boolean DEFAULT true,
  payment_transfer_enabled boolean DEFAULT true,
  cod_max_amount integer DEFAULT 75000,
  cod_max_distance_km numeric DEFAULT 3,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  available_balance integer DEFAULT 0,
  pending_balance integer DEFAULT 0,
  total_withdrawn integer DEFAULT 0,
  halal_certificate_url text,
  halal_status text DEFAULT 'NONE',
  notification_sound_enabled boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_slug ON public.merchants(slug) WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.merchant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.transaction_packages(id),
  transaction_quota integer NOT NULL DEFAULT 0,
  used_quota integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE',
  payment_status text NOT NULL DEFAULT 'UNPAID',
  payment_amount integer NOT NULL DEFAULT 0,
  paid_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  expired_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.merchants
    ADD CONSTRAINT merchants_current_subscription_id_fkey
    FOREIGN KEY (current_subscription_id) REFERENCES public.merchant_subscriptions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.merchant_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.merchant_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, merchant_id)
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.trade_groups(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, merchant_id)
);

CREATE TABLE IF NOT EXISTS public.kas_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.trade_groups(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  payment_month integer NOT NULL,
  payment_year integer NOT NULL,
  status text NOT NULL DEFAULT 'UNPAID',
  payment_date timestamptz,
  collected_by uuid,
  notes text,
  invoice_note text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, merchant_id, payment_month, payment_year)
);

CREATE TABLE IF NOT EXISTS public.group_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.trade_groups(id),
  verifikator_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verifikator_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verifikator_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  trade_group text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0,
  max_usage integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verifikator_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verifikator_id uuid NOT NULL,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  subscription_id uuid NOT NULL REFERENCES public.merchant_subscriptions(id),
  package_id uuid NOT NULL REFERENCES public.transaction_packages(id),
  package_amount integer NOT NULL,
  commission_percent numeric NOT NULL,
  commission_amount integer NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verifikator_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verifikator_id uuid NOT NULL,
  amount integer NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  admin_notes text,
  proof_image_url text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  province text NOT NULL,
  city text NOT NULL,
  district text NOT NULL,
  subdistrict text NOT NULL,
  address text NOT NULL,
  ktp_number text NOT NULL,
  ktp_image_url text NOT NULL,
  photo_url text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'motor',
  vehicle_plate text,
  vehicle_image_url text NOT NULL,
  village_id uuid REFERENCES public.villages(id),
  status text NOT NULL DEFAULT 'INACTIVE',
  registration_status text NOT NULL DEFAULT 'PENDING',
  is_available boolean NOT NULL DEFAULT false,
  current_lat numeric,
  current_lng numeric,
  last_location_update timestamptz,
  registered_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  available_balance numeric DEFAULT 0,
  pending_balance numeric DEFAULT 0,
  total_withdrawn numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.courier_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  order_id uuid,
  amount integer NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'DELIVERY',
  status text NOT NULL DEFAULT 'PENDING',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.courier_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id),
  amount numeric NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  status text DEFAULT 'PENDING',
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.courier_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  proof_url text,
  status text NOT NULL DEFAULT 'PENDING',
  admin_notes text,
  approved_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.courier_balance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  order_id uuid,
  type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  balance_before numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. INDEXES -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_merchants_location ON public.merchants(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_merchants_verifikator_code ON public.merchants(verifikator_code);
CREATE INDEX IF NOT EXISTS idx_merchant_subscriptions_merchant ON public.merchant_subscriptions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_subscriptions_status ON public.merchant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_merchant_gallery_merchant ON public.merchant_gallery(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_favorites_user ON public.merchant_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_favorites_merchant ON public.merchant_favorites(merchant_id);
CREATE INDEX IF NOT EXISTS idx_courier_deposits_courier ON public.courier_deposits(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_balance_logs_courier ON public.courier_balance_logs(courier_id);

-- 3. GRANTS --------------------------------------------------------
GRANT SELECT ON public.villages TO anon;
GRANT SELECT, INSERT, UPDATE ON public.villages TO authenticated;
GRANT ALL ON public.villages TO service_role;

GRANT SELECT, INSERT ON public.user_villages TO authenticated;
GRANT ALL ON public.user_villages TO service_role;

GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.trade_groups TO authenticated;
GRANT ALL ON public.trade_groups TO service_role;

GRANT SELECT ON public.transaction_packages TO anon, authenticated;
GRANT ALL ON public.transaction_packages TO service_role;

GRANT SELECT ON public.quota_tiers TO anon, authenticated;
GRANT ALL ON public.quota_tiers TO service_role;

GRANT SELECT ON public.tourism TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tourism TO authenticated;
GRANT ALL ON public.tourism TO service_role;

GRANT SELECT ON public.merchants TO anon;
GRANT SELECT, INSERT, UPDATE ON public.merchants TO authenticated;
GRANT ALL ON public.merchants TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.merchant_subscriptions TO authenticated;
GRANT ALL ON public.merchant_subscriptions TO service_role;

GRANT SELECT ON public.merchant_gallery TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.merchant_gallery TO authenticated;
GRANT ALL ON public.merchant_gallery TO service_role;

GRANT SELECT, INSERT, DELETE ON public.merchant_favorites TO authenticated;
GRANT ALL ON public.merchant_favorites TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.kas_payments TO authenticated;
GRANT ALL ON public.kas_payments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_announcements TO authenticated;
GRANT ALL ON public.group_announcements TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.verifikator_codes TO authenticated;
GRANT ALL ON public.verifikator_codes TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.verifikator_earnings TO authenticated;
GRANT ALL ON public.verifikator_earnings TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.verifikator_withdrawals TO authenticated;
GRANT ALL ON public.verifikator_withdrawals TO service_role;

GRANT SELECT ON public.couriers TO anon, authenticated;
GRANT INSERT, UPDATE ON public.couriers TO authenticated;
GRANT ALL ON public.couriers TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.courier_earnings TO authenticated;
GRANT ALL ON public.courier_earnings TO service_role;

GRANT SELECT, INSERT ON public.courier_withdrawal_requests TO authenticated;
GRANT ALL ON public.courier_withdrawal_requests TO service_role;

GRANT SELECT, INSERT ON public.courier_deposits TO authenticated;
GRANT ALL ON public.courier_deposits TO service_role;

GRANT SELECT ON public.courier_balance_logs TO authenticated;
GRANT ALL ON public.courier_balance_logs TO service_role;

-- 4. ENABLE RLS ----------------------------------------------------
ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kas_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_balance_logs ENABLE ROW LEVEL SECURITY;

-- 5. HELPER FUNCTIONS ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_merchant_id(_user_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.merchants WHERE user_id = COALESCE(_user_id, auth.uid()) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_courier_id(_user_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.couriers WHERE user_id = COALESCE(_user_id, auth.uid()) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_courier_owner(_user_id uuid, _courier_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.couriers WHERE id = _courier_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.generate_merchant_slug(merchant_name text)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base_slug text; final_slug text; counter integer := 0;
BEGIN
  base_slug := lower(regexp_replace(merchant_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.merchants WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  RETURN final_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_quota_cost(product_price integer)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    (SELECT credit_cost FROM public.quota_tiers
     WHERE is_active = true AND product_price >= min_price
       AND (max_price IS NULL OR product_price <= max_price)
     ORDER BY min_price DESC LIMIT 1),
    1
  )
$$;

CREATE OR REPLACE FUNCTION public.calculate_quota_cost(p_product_price integer)
RETURNS integer LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_cost integer;
BEGIN
  SELECT credit_cost INTO v_cost FROM public.quota_tiers
  WHERE p_product_price >= min_price
    AND (max_price IS NULL OR p_product_price <= max_price)
    AND is_active = true
  ORDER BY min_price DESC LIMIT 1;
  RETURN COALESCE(v_cost, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_merchant_quota(p_merchant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_subscription RECORD;
BEGIN
  SELECT * INTO v_subscription FROM public.merchant_subscriptions
  WHERE merchant_id = p_merchant_id AND status = 'ACTIVE' AND expired_at > now() AND used_quota < transaction_quota
  ORDER BY expired_at DESC LIMIT 1;
  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object('can_transact', false, 'reason', 'Tidak ada kuota transaksi aktif.', 'remaining_quota', 0);
  END IF;
  RETURN jsonb_build_object('can_transact', true,
    'remaining_quota', v_subscription.transaction_quota - v_subscription.used_quota,
    'subscription_id', v_subscription.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.use_merchant_quota(p_merchant_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.merchant_subscriptions SET used_quota = used_quota + 1, updated_at = now()
  WHERE merchant_id = p_merchant_id AND status = 'ACTIVE' AND expired_at > now() AND used_quota < transaction_quota;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_merchant_quota(p_merchant_id uuid, p_credits integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_sub_id uuid;
BEGIN
  SELECT id INTO v_sub_id FROM public.merchant_subscriptions
  WHERE merchant_id = p_merchant_id AND status = 'ACTIVE' AND expired_at > now()
    AND (transaction_quota - used_quota) >= p_credits
  ORDER BY expired_at ASC LIMIT 1;
  IF v_sub_id IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.merchant_subscriptions SET used_quota = used_quota + p_credits, updated_at = now() WHERE id = v_sub_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_merchant_to_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_code RECORD; v_group RECORD;
BEGIN
  IF NEW.verifikator_code IS NOT NULL AND NEW.group_id IS NULL THEN
    SELECT * INTO v_code FROM public.verifikator_codes WHERE code = NEW.verifikator_code AND is_active = true LIMIT 1;
    IF v_code IS NOT NULL THEN
      SELECT * INTO v_group FROM public.trade_groups WHERE verifikator_id = v_code.verifikator_id AND is_active = true LIMIT 1;
      IF v_group IS NOT NULL THEN
        NEW.group_id := v_group.id;
        INSERT INTO public.group_members (group_id, merchant_id, status)
        VALUES (v_group.id, NEW.id, 'ACTIVE') ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_monthly_kas(p_group_id uuid, p_month integer, p_year integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_group RECORD; v_member RECORD; v_count integer := 0;
BEGIN
  SELECT * INTO v_group FROM public.trade_groups WHERE id = p_group_id;
  IF v_group IS NULL THEN RETURN 0; END IF;
  FOR v_member IN SELECT * FROM public.group_members WHERE group_id = p_group_id AND status = 'ACTIVE' LOOP
    INSERT INTO public.kas_payments (group_id, merchant_id, amount, payment_month, payment_year, status)
    VALUES (p_group_id, v_member.merchant_id, v_group.monthly_fee, p_month, p_year, 'UNPAID')
    ON CONFLICT (group_id, merchant_id, payment_month, payment_year) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_verifikator_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_merchant RECORD; v_package RECORD; v_commission integer;
BEGIN
  IF NEW.payment_status = 'PAID' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'PAID') THEN
    SELECT * INTO v_merchant FROM public.merchants WHERE id = NEW.merchant_id;
    IF v_merchant.verifikator_id IS NOT NULL THEN
      SELECT * INTO v_package FROM public.transaction_packages WHERE id = NEW.package_id;
      v_commission := FLOOR(NEW.payment_amount * v_package.group_commission_percent / 100);
      IF v_commission > 0 THEN
        INSERT INTO public.verifikator_earnings (verifikator_id, merchant_id, subscription_id, package_id,
          package_amount, commission_percent, commission_amount, status)
        VALUES (v_merchant.verifikator_id, NEW.merchant_id, NEW.id, NEW.package_id,
          NEW.payment_amount, v_package.group_commission_percent, v_commission, 'PENDING');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_verifikator_withdrawal(p_withdrawal_id uuid, p_status text, p_admin_notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_withdrawal RECORD; v_total_pending integer;
BEGIN
  SELECT * INTO v_withdrawal FROM public.verifikator_withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v_withdrawal.status != 'PENDING' THEN RAISE EXCEPTION 'Already processed'; END IF;
  IF p_status = 'APPROVED' THEN
    SELECT COALESCE(SUM(commission_amount), 0) INTO v_total_pending
    FROM public.verifikator_earnings WHERE verifikator_id = v_withdrawal.verifikator_id AND status = 'PENDING';
    IF v_total_pending < v_withdrawal.amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    WITH earnings_to_pay AS (
      SELECT id, commission_amount, SUM(commission_amount) OVER (ORDER BY created_at) AS running_total
      FROM public.verifikator_earnings WHERE verifikator_id = v_withdrawal.verifikator_id AND status = 'PENDING'
      ORDER BY created_at
    ) UPDATE public.verifikator_earnings SET status = 'PAID', paid_at = now()
      WHERE id IN (SELECT id FROM earnings_to_pay WHERE running_total <= v_withdrawal.amount);
  END IF;
  UPDATE public.verifikator_withdrawals
  SET status = p_status, admin_notes = p_admin_notes, processed_by = auth.uid(), processed_at = now(), updated_at = now()
  WHERE id = p_withdrawal_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_quota_subscription(p_subscription_id uuid, p_admin_notes text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sub RECORD;
BEGIN
  SELECT * INTO v_sub FROM public.merchant_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Subscription tidak ditemukan'); END IF;
  IF v_sub.payment_status = 'PAID' AND v_sub.status = 'ACTIVE' THEN
    RETURN json_build_object('success', false, 'message', 'Subscription sudah aktif');
  END IF;
  UPDATE public.merchant_subscriptions SET status='ACTIVE', payment_status='PAID', paid_at=now(), updated_at=now() WHERE id = p_subscription_id;
  UPDATE public.merchants SET current_subscription_id = p_subscription_id, updated_at=now() WHERE id = v_sub.merchant_id;
  RETURN json_build_object('success', true, 'message', 'Subscription berhasil disetujui dan diaktifkan');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_quota_subscription(p_subscription_id uuid, p_admin_notes text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_admin_notes IS NULL OR p_admin_notes = '' THEN
    RETURN json_build_object('success', false, 'message', 'Catatan admin wajib diisi saat menolak');
  END IF;
  UPDATE public.merchant_subscriptions SET status='INACTIVE', payment_status='REJECTED', updated_at=now() WHERE id = p_subscription_id;
  RETURN json_build_object('success', true, 'message', 'Subscription berhasil ditolak');
END;
$$;

-- 6. TRIGGERS ------------------------------------------------------
DROP TRIGGER IF EXISTS update_villages_updated_at ON public.villages;
CREATE TRIGGER update_villages_updated_at BEFORE UPDATE ON public.villages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchants_updated_at ON public.merchants;
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchant_subscriptions_updated_at ON public.merchant_subscriptions;
CREATE TRIGGER update_merchant_subscriptions_updated_at BEFORE UPDATE ON public.merchant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_couriers_updated_at ON public.couriers;
CREATE TRIGGER update_couriers_updated_at BEFORE UPDATE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_trade_groups_updated_at ON public.trade_groups;
CREATE TRIGGER update_trade_groups_updated_at BEFORE UPDATE ON public.trade_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_transaction_packages_updated_at ON public.transaction_packages;
CREATE TRIGGER update_transaction_packages_updated_at BEFORE UPDATE ON public.transaction_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quota_tiers_updated_at ON public.quota_tiers;
CREATE TRIGGER update_quota_tiers_updated_at BEFORE UPDATE ON public.quota_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_kas_payments_updated_at ON public.kas_payments;
CREATE TRIGGER update_kas_payments_updated_at BEFORE UPDATE ON public.kas_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_auto_assign_merchant_group ON public.merchants;
CREATE TRIGGER trigger_auto_assign_merchant_group BEFORE INSERT OR UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_merchant_to_group();

DROP TRIGGER IF EXISTS trigger_record_verifikator_commission ON public.merchant_subscriptions;
CREATE TRIGGER trigger_record_verifikator_commission AFTER INSERT OR UPDATE ON public.merchant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.record_verifikator_commission();

-- 7. VIEWS ---------------------------------------------------------
DROP VIEW IF EXISTS public.public_merchants CASCADE;
CREATE VIEW public.public_merchants WITH (security_invoker=on) AS
SELECT id, name, image_url, business_category, business_description, village_id,
  CASE WHEN phone IS NOT NULL THEN CONCAT('****', RIGHT(phone, 4)) END AS phone_masked,
  city, district, province,
  CASE WHEN location_lat IS NOT NULL THEN ROUND(location_lat::numeric, 2) END AS location_lat_approx,
  CASE WHEN location_lng IS NOT NULL THEN ROUND(location_lng::numeric, 2) END AS location_lng_approx,
  is_open, open_time, close_time, rating_avg, rating_count, is_verified, badge, order_mode
FROM public.merchants
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

DROP VIEW IF EXISTS public.public_couriers CASCADE;
CREATE VIEW public.public_couriers WITH (security_invoker=on) AS
SELECT id, name,
  CASE WHEN phone IS NOT NULL THEN CONCAT('****', RIGHT(phone, 4)) END AS phone_masked,
  photo_url, vehicle_type,
  CASE WHEN current_lat IS NOT NULL THEN ROUND(current_lat, 3) END AS current_lat_approx,
  CASE WHEN current_lng IS NOT NULL THEN ROUND(current_lng, 3) END AS current_lng_approx,
  is_available, status, village_id
FROM public.couriers
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

GRANT SELECT ON public.public_merchants TO anon, authenticated;
GRANT SELECT ON public.public_couriers TO anon, authenticated;

-- 8. RLS POLICIES --------------------------------------------------

-- villages
DROP POLICY IF EXISTS "Anyone can view active villages" ON public.villages;
CREATE POLICY "Anyone can view active villages" ON public.villages FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Authenticated users can register village" ON public.villages;
CREATE POLICY "Authenticated users can register village" ON public.villages FOR INSERT TO authenticated
  WITH CHECK (registration_status = 'PENDING' AND is_active = false);
DROP POLICY IF EXISTS "Admins can manage villages" ON public.villages;
CREATE POLICY "Admins can manage villages" ON public.villages FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Village owners can update own village" ON public.villages;
CREATE POLICY "Village owners can update own village" ON public.villages FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin desa can update own village" ON public.villages;
CREATE POLICY "Admin desa can update own village" ON public.villages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_villages uv WHERE uv.village_id = villages.id AND uv.user_id = auth.uid()));

-- user_villages
DROP POLICY IF EXISTS "Admins manage village assignments" ON public.user_villages;
CREATE POLICY "Admins manage village assignments" ON public.user_villages FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Users view own village assignments" ON public.user_villages;
CREATE POLICY "Users view own village assignments" ON public.user_villages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Users can register own village assignment" ON public.user_villages;
CREATE POLICY "Users can register own village assignment" ON public.user_villages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- categories
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
CREATE POLICY "Anyone can view active categories" ON public.categories FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.is_admin());

-- trade_groups
DROP POLICY IF EXISTS "Anyone can view active groups" ON public.trade_groups;
CREATE POLICY "Anyone can view active groups" ON public.trade_groups FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage all groups" ON public.trade_groups;
CREATE POLICY "Admins can manage all groups" ON public.trade_groups FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Verifikators can manage own groups" ON public.trade_groups;
CREATE POLICY "Verifikators can manage own groups" ON public.trade_groups FOR ALL
  USING (verifikator_id = auth.uid() OR public.is_admin());

-- transaction_packages
DROP POLICY IF EXISTS "Anyone can view active packages" ON public.transaction_packages;
CREATE POLICY "Anyone can view active packages" ON public.transaction_packages FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage packages" ON public.transaction_packages;
CREATE POLICY "Admins can manage packages" ON public.transaction_packages FOR ALL USING (public.is_admin());

-- quota_tiers
DROP POLICY IF EXISTS "Anyone can view quota tiers" ON public.quota_tiers;
CREATE POLICY "Anyone can view quota tiers" ON public.quota_tiers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage quota tiers" ON public.quota_tiers;
CREATE POLICY "Admins can manage quota tiers" ON public.quota_tiers FOR ALL TO authenticated USING (public.is_admin());

-- tourism
DROP POLICY IF EXISTS "Anyone can view active tourism" ON public.tourism;
CREATE POLICY "Anyone can view active tourism" ON public.tourism FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage tourism" ON public.tourism;
CREATE POLICY "Admins can manage tourism" ON public.tourism FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Admin desa can manage tourism" ON public.tourism;
CREATE POLICY "Admin desa can manage tourism" ON public.tourism FOR ALL
  USING (EXISTS (SELECT 1 FROM public.villages WHERE villages.id = tourism.village_id AND villages.registration_status = 'APPROVED') AND public.is_admin_desa())
  WITH CHECK (EXISTS (SELECT 1 FROM public.villages WHERE villages.id = tourism.village_id AND villages.registration_status = 'APPROVED') AND public.is_admin_desa());

-- merchants
DROP POLICY IF EXISTS "Admins can manage merchants" ON public.merchants;
CREATE POLICY "Admins can manage merchants" ON public.merchants FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Verifikator can manage merchants" ON public.merchants;
CREATE POLICY "Verifikator can manage merchants" ON public.merchants FOR ALL USING (public.is_verifikator());
DROP POLICY IF EXISTS "Merchants can update own data" ON public.merchants;
CREATE POLICY "Merchants can update own data" ON public.merchants FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Anyone can register merchant" ON public.merchants;
CREATE POLICY "Anyone can register merchant" ON public.merchants FOR INSERT
  WITH CHECK (registration_status = 'PENDING');
DROP POLICY IF EXISTS "Authenticated users view active merchants" ON public.merchants;
CREATE POLICY "Authenticated users view active merchants" ON public.merchants FOR SELECT
  USING ((user_id = auth.uid())
    OR ((status = 'ACTIVE' AND registration_status = 'APPROVED' AND auth.uid() IS NOT NULL))
    OR public.is_admin() OR public.is_verifikator());
DROP POLICY IF EXISTS "Anon can view basic merchant info" ON public.merchants;
CREATE POLICY "Anon can view basic merchant info" ON public.merchants FOR SELECT TO anon
  USING (status = 'ACTIVE' AND registration_status = 'APPROVED');

-- merchant_subscriptions
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.merchant_subscriptions;
CREATE POLICY "Admins can manage all subscriptions" ON public.merchant_subscriptions FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants can view own subscriptions" ON public.merchant_subscriptions;
CREATE POLICY "Merchants can view own subscriptions" ON public.merchant_subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = merchant_subscriptions.merchant_id AND merchants.user_id = auth.uid()));
DROP POLICY IF EXISTS "Merchants can create subscriptions" ON public.merchant_subscriptions;
CREATE POLICY "Merchants can create subscriptions" ON public.merchant_subscriptions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = merchant_subscriptions.merchant_id AND merchants.user_id = auth.uid()));

-- merchant_gallery
DROP POLICY IF EXISTS "Public can view merchant gallery" ON public.merchant_gallery;
CREATE POLICY "Public can view merchant gallery" ON public.merchant_gallery FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = merchant_gallery.merchant_id AND merchants.status='ACTIVE' AND merchants.registration_status='APPROVED'));
DROP POLICY IF EXISTS "Merchants can manage own gallery" ON public.merchant_gallery;
CREATE POLICY "Merchants can manage own gallery" ON public.merchant_gallery FOR ALL
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = merchant_gallery.merchant_id AND merchants.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can manage all galleries" ON public.merchant_gallery;
CREATE POLICY "Admins can manage all galleries" ON public.merchant_gallery FOR ALL USING (public.is_admin());

-- merchant_favorites
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.merchant_favorites;
CREATE POLICY "Users can view their own favorites" ON public.merchant_favorites FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.merchant_favorites;
CREATE POLICY "Users can insert their own favorites" ON public.merchant_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.merchant_favorites;
CREATE POLICY "Users can delete their own favorites" ON public.merchant_favorites FOR DELETE USING (auth.uid() = user_id);

-- group_members
DROP POLICY IF EXISTS "Admins can manage all members" ON public.group_members;
CREATE POLICY "Admins can manage all members" ON public.group_members FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants can view own membership" ON public.group_members;
CREATE POLICY "Merchants can view own membership" ON public.group_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = group_members.merchant_id AND merchants.user_id = auth.uid()));
DROP POLICY IF EXISTS "Verifikators can manage group members" ON public.group_members;
CREATE POLICY "Verifikators can manage group members" ON public.group_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.trade_groups WHERE trade_groups.id = group_members.group_id AND (trade_groups.verifikator_id = auth.uid() OR public.is_admin())));

-- kas_payments
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.kas_payments;
CREATE POLICY "Admins can manage all payments" ON public.kas_payments FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants can view own payments" ON public.kas_payments;
CREATE POLICY "Merchants can view own payments" ON public.kas_payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = kas_payments.merchant_id AND merchants.user_id = auth.uid()));
DROP POLICY IF EXISTS "Verifikators can manage payments in their groups" ON public.kas_payments;
CREATE POLICY "Verifikators can manage payments in their groups" ON public.kas_payments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.trade_groups WHERE trade_groups.id = kas_payments.group_id AND (trade_groups.verifikator_id = auth.uid() OR public.is_admin())));

-- group_announcements
DROP POLICY IF EXISTS "Verifikator can manage own announcements" ON public.group_announcements;
CREATE POLICY "Verifikator can manage own announcements" ON public.group_announcements FOR ALL
  USING (verifikator_id = auth.uid());
DROP POLICY IF EXISTS "Group members can read announcements" ON public.group_announcements;
CREATE POLICY "Group members can read announcements" ON public.group_announcements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_members gm JOIN public.merchants m ON m.id = gm.merchant_id
    WHERE gm.group_id = group_announcements.group_id AND m.user_id = auth.uid()));

-- verifikator_codes
DROP POLICY IF EXISTS "Anyone can view active codes" ON public.verifikator_codes;
CREATE POLICY "Anyone can view active codes" ON public.verifikator_codes FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admin can manage all codes" ON public.verifikator_codes;
CREATE POLICY "Admin can manage all codes" ON public.verifikator_codes FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Verifikator can manage own codes" ON public.verifikator_codes;
CREATE POLICY "Verifikator can manage own codes" ON public.verifikator_codes FOR ALL
  USING (verifikator_id = auth.uid() OR public.is_admin());

-- verifikator_earnings
DROP POLICY IF EXISTS "Admins can manage all earnings" ON public.verifikator_earnings;
CREATE POLICY "Admins can manage all earnings" ON public.verifikator_earnings FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Verifikators can view own earnings" ON public.verifikator_earnings;
CREATE POLICY "Verifikators can view own earnings" ON public.verifikator_earnings FOR SELECT
  USING (verifikator_id = auth.uid());

-- verifikator_withdrawals
DROP POLICY IF EXISTS "Admins manage withdrawals" ON public.verifikator_withdrawals;
CREATE POLICY "Admins manage withdrawals" ON public.verifikator_withdrawals FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Verifikators can create withdrawals" ON public.verifikator_withdrawals;
CREATE POLICY "Verifikators can create withdrawals" ON public.verifikator_withdrawals FOR INSERT
  WITH CHECK (verifikator_id = auth.uid() AND status = 'PENDING');
DROP POLICY IF EXISTS "Verifikators view own withdrawals" ON public.verifikator_withdrawals;
CREATE POLICY "Verifikators view own withdrawals" ON public.verifikator_withdrawals FOR SELECT
  USING (verifikator_id = auth.uid() OR public.is_admin());

-- couriers
DROP POLICY IF EXISTS "Admins can manage couriers" ON public.couriers;
CREATE POLICY "Admins can manage couriers" ON public.couriers FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Verifikator can manage couriers" ON public.couriers;
CREATE POLICY "Verifikator can manage couriers" ON public.couriers FOR ALL TO authenticated USING (public.is_verifikator());
DROP POLICY IF EXISTS "Anyone can register as courier" ON public.couriers;
CREATE POLICY "Anyone can register as courier" ON public.couriers FOR INSERT TO authenticated
  WITH CHECK (registration_status = 'PENDING' AND status = 'INACTIVE');
DROP POLICY IF EXISTS "Couriers can view own data" ON public.couriers;
CREATE POLICY "Couriers can view own data" ON public.couriers FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Couriers can update own location" ON public.couriers;
CREATE POLICY "Couriers can update own location" ON public.couriers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'ACTIVE');
DROP POLICY IF EXISTS "Public can view approved couriers" ON public.couriers;
CREATE POLICY "Public can view approved couriers" ON public.couriers FOR SELECT
  USING (registration_status = 'APPROVED' AND status = 'ACTIVE');

-- courier_earnings
DROP POLICY IF EXISTS "Admins can manage courier earnings" ON public.courier_earnings;
CREATE POLICY "Admins can manage courier earnings" ON public.courier_earnings FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Couriers can view own earnings" ON public.courier_earnings;
CREATE POLICY "Couriers can view own earnings" ON public.courier_earnings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.couriers WHERE couriers.id = courier_earnings.courier_id AND couriers.user_id = auth.uid()));

-- courier_withdrawal_requests
DROP POLICY IF EXISTS "Admins full access courier withdrawals" ON public.courier_withdrawal_requests;
CREATE POLICY "Admins full access courier withdrawals" ON public.courier_withdrawal_requests FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Couriers can view own withdrawals" ON public.courier_withdrawal_requests;
CREATE POLICY "Couriers can view own withdrawals" ON public.courier_withdrawal_requests FOR SELECT
  USING (courier_id = public.get_user_courier_id());
DROP POLICY IF EXISTS "Couriers can create own withdrawals" ON public.courier_withdrawal_requests;
CREATE POLICY "Couriers can create own withdrawals" ON public.courier_withdrawal_requests FOR INSERT
  WITH CHECK (courier_id = public.get_user_courier_id());

-- courier_deposits
DROP POLICY IF EXISTS "Couriers can view own deposits" ON public.courier_deposits;
CREATE POLICY "Couriers can view own deposits" ON public.courier_deposits FOR SELECT
  USING (courier_id = public.get_user_courier_id());
DROP POLICY IF EXISTS "Couriers can create own deposits" ON public.courier_deposits;
CREATE POLICY "Couriers can create own deposits" ON public.courier_deposits FOR INSERT
  WITH CHECK (courier_id = public.get_user_courier_id());
DROP POLICY IF EXISTS "Admins full access courier deposits" ON public.courier_deposits;
CREATE POLICY "Admins full access courier deposits" ON public.courier_deposits FOR ALL USING (public.is_admin());

-- courier_balance_logs
DROP POLICY IF EXISTS "Couriers can view own balance logs" ON public.courier_balance_logs;
CREATE POLICY "Couriers can view own balance logs" ON public.courier_balance_logs FOR SELECT
  USING (courier_id = public.get_user_courier_id());
DROP POLICY IF EXISTS "Admins full access balance logs" ON public.courier_balance_logs;
CREATE POLICY "Admins full access balance logs" ON public.courier_balance_logs FOR ALL USING (public.is_admin());
