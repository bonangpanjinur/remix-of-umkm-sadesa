-- ============================================================
-- FILE 03: COMMERCE & ORDERS
-- ============================================================
-- products, product_images, product_variants, orders, order_items,
-- flash_sales, reviews, refund_requests, withdrawal_requests,
-- platform_fees, insurance_fund, vouchers, voucher_usages,
-- promotions, ride_requests. Order helpers, business triggers.
-- Idempotent.
-- ============================================================

-- 1. TABEL ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price integer NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  category text NOT NULL,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  is_promo boolean NOT NULL DEFAULT false,
  discount_percent integer DEFAULT 0,
  discount_end_date timestamptz,
  min_stock_alert integer DEFAULT 5,
  low_stock_threshold integer DEFAULT 5,
  view_count integer DEFAULT 0,
  order_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_primary boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_adjustment integer DEFAULT 0,
  stock integer DEFAULT 0,
  sku text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  merchant_id uuid REFERENCES public.merchants(id),
  courier_id uuid REFERENCES public.couriers(id),
  status text NOT NULL DEFAULT 'NEW',
  handled_by text NOT NULL DEFAULT 'ADMIN',
  delivery_type text NOT NULL DEFAULT 'PICKUP',
  delivery_address text,
  delivery_name text,
  delivery_phone text,
  delivery_lat numeric,
  delivery_lng numeric,
  buyer_distance_km numeric,
  subtotal integer NOT NULL DEFAULT 0,
  shipping_cost integer NOT NULL DEFAULT 0,
  flash_sale_discount integer DEFAULT 0,
  cod_service_fee integer DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  notes text,
  payment_method text,
  payment_channel text,
  payment_status text DEFAULT 'UNPAID',
  payment_proof_url text,
  payment_paid_at timestamptz,
  payment_invoice_id text,
  payment_invoice_url text,
  is_flash_sale boolean DEFAULT false,
  is_self_delivery boolean DEFAULT false,
  has_review boolean DEFAULT false,
  rejection_reason text,
  cancellation_reason text,
  cancellation_type text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  confirmed_at timestamptz,
  confirmation_deadline timestamptz,
  auto_complete_at timestamptz,
  pod_image_url text,
  pod_notes text,
  pod_uploaded_at timestamptz,
  cod_confirmed_at timestamptz,
  cod_rejected_at timestamptz,
  cod_rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY[
    'NEW','PENDING_CONFIRMATION','PENDING_PAYMENT','PROCESSED','READY',
    'ASSIGNED','PICKED_UP','SENT','DELIVERED','DONE','CANCELED',
    'REJECTED','REJECTED_BY_BUYER','REFUNDED'
  ]))
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_price integer NOT NULL,
  quantity integer NOT NULL,
  subtotal integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flash_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  original_price integer NOT NULL,
  flash_price integer NOT NULL,
  stock_available integer NOT NULL DEFAULT 1,
  stock_sold integer NOT NULL DEFAULT 0,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL,
  rating integer NOT NULL,
  comment text,
  image_urls text[] DEFAULT '{}',
  merchant_reply text,
  merchant_replied_at timestamptz,
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  buyer_id uuid NOT NULL,
  merchant_id uuid REFERENCES public.merchants(id),
  amount integer NOT NULL,
  reason text NOT NULL,
  refund_type text DEFAULT 'FULL',
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'PENDING',
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  merchant_id uuid REFERENCES public.merchants(id),
  fee_type text NOT NULL DEFAULT 'ORDER',
  order_total integer NOT NULL DEFAULT 0,
  platform_fee_percent numeric NOT NULL DEFAULT 0,
  platform_fee integer NOT NULL DEFAULT 0,
  merchant_revenue integer NOT NULL DEFAULT 0,
  courier_fee integer NOT NULL DEFAULT 0,
  shipping_cost integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING',
  collected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insurance_fund (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  type text NOT NULL,
  amount integer NOT NULL,
  status text DEFAULT 'PENDING',
  claim_reason text,
  evidence_urls text[] DEFAULT '{}',
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value integer NOT NULL DEFAULT 0,
  min_order_amount integer DEFAULT 0,
  max_discount integer,
  usage_limit integer,
  used_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.voucher_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount integer NOT NULL DEFAULT 0,
  used_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  type text NOT NULL,
  image_url text,
  link_type text,
  link_url text,
  link_id uuid,
  advertiser_type text,
  advertiser_id uuid,
  is_active boolean DEFAULT true,
  is_approved boolean DEFAULT false,
  is_paid boolean DEFAULT false,
  price integer DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  view_count integer DEFAULT 0,
  click_count integer DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL,
  courier_id uuid REFERENCES public.couriers(id),
  status text NOT NULL DEFAULT 'SEARCHING',
  pickup_address text NOT NULL,
  pickup_lat numeric NOT NULL,
  pickup_lng numeric NOT NULL,
  dropoff_address text NOT NULL,
  dropoff_lat numeric NOT NULL,
  dropoff_lng numeric NOT NULL,
  distance_km numeric,
  fare integer NOT NULL DEFAULT 0,
  notes text,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. INDEXES -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON public.orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON public.product_images(product_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_merchant ON public.flash_sales(merchant_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_status_end ON public.flash_sales(status, end_time);
CREATE INDEX IF NOT EXISTS idx_ride_requests_passenger ON public.ride_requests(passenger_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_courier ON public.ride_requests(courier_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON public.ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_merchant ON public.refund_requests(merchant_id);

-- 3. GRANTS --------------------------------------------------------
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;

GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

GRANT SELECT ON public.flash_sales TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.flash_sales TO authenticated;
GRANT ALL ON public.flash_sales TO service_role;

GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.platform_fees TO authenticated;
GRANT ALL ON public.platform_fees TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.insurance_fund TO authenticated;
GRANT ALL ON public.insurance_fund TO service_role;

GRANT SELECT ON public.vouchers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vouchers TO authenticated;
GRANT ALL ON public.vouchers TO service_role;

GRANT SELECT, INSERT ON public.voucher_usages TO authenticated;
GRANT ALL ON public.voucher_usages TO service_role;

GRANT SELECT ON public.promotions TO anon, authenticated;
GRANT INSERT, UPDATE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.ride_requests TO authenticated;
GRANT ALL ON public.ride_requests TO service_role;

-- 4. ENABLE RLS ----------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;

-- 5. HELPER & BUSINESS FUNCTIONS ----------------------------------

CREATE OR REPLACE FUNCTION public.is_order_merchant(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o JOIN public.merchants m ON o.merchant_id = m.id
    WHERE o.id = _order_id AND m.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_order_merchant(_user_id uuid, _merchant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.merchants WHERE id = _merchant_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_order_courier(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o JOIN public.couriers c ON o.courier_id = c.id
    WHERE o.id = _order_id AND c.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.notify_order_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE merchant_user_id uuid; order_status_text text;
BEGIN
  SELECT user_id INTO merchant_user_id FROM public.merchants WHERE id = NEW.merchant_id;
  CASE NEW.status
    WHEN 'NEW' THEN order_status_text := 'Pesanan Baru';
    WHEN 'PENDING_CONFIRMATION' THEN order_status_text := 'Menunggu Konfirmasi';
    WHEN 'PROCESSED' THEN order_status_text := 'Sedang Diproses';
    WHEN 'SENT' THEN order_status_text := 'Sedang Dikirim';
    WHEN 'DONE' THEN order_status_text := 'Selesai';
    WHEN 'CANCELED' THEN order_status_text := 'Dibatalkan';
    ELSE order_status_text := NEW.status;
  END CASE;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.send_notification(NEW.buyer_id, 'Status Pesanan Diperbarui',
      'Pesanan #' || LEFT(NEW.id::text, 8) || ' ' || order_status_text, 'order', '/orders/' || NEW.id);
  END IF;
  IF TG_OP = 'INSERT' AND merchant_user_id IS NOT NULL THEN
    PERFORM public.send_notification(merchant_user_id, 'Pesanan Baru',
      'Anda menerima pesanan baru senilai Rp ' || NEW.total::text, 'order', '/merchant/orders');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_auto_complete_deadline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'DELIVERED' AND (OLD.status IS NULL OR OLD.status <> 'DELIVERED') THEN
    NEW.auto_complete_at := NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_complete_delivered_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE completed_count integer;
BEGIN
  UPDATE public.orders SET status = 'DONE', updated_at = NOW()
  WHERE status = 'DELIVERED' AND auto_complete_at IS NOT NULL AND auto_complete_at <= NOW();
  GET DIAGNOSTICS completed_count = ROW_COUNT;
  RETURN completed_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_cancel_pending_orders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.orders SET status='CANCELED', notes=COALESCE(notes,'') || ' [Auto-canceled]', updated_at=now()
  WHERE status='PENDING_CONFIRMATION' AND confirmation_deadline < now();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_trust_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'REJECTED_BY_BUYER' AND OLD.status != 'REJECTED_BY_BUYER' THEN
    UPDATE public.profiles SET trust_score = GREATEST(0, trust_score - 50),
      cod_fail_count = cod_fail_count + 1,
      cod_enabled = CASE WHEN trust_score - 50 < 50 THEN false ELSE cod_enabled END
    WHERE user_id = NEW.buyer_id;
  END IF;
  IF NEW.status = 'DONE' AND OLD.status != 'DONE' AND NEW.payment_method = 'COD' THEN
    UPDATE public.profiles SET trust_score = LEAST(100, trust_score + 1) WHERE user_id = NEW.buyer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_cod_trust_score(p_buyer_id uuid, p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cod jsonb; v_penalty int; v_bonus int; v_min int; v_current int; v_fail int; v_new int;
BEGIN
  SELECT value INTO v_cod FROM public.app_settings WHERE key='cod_settings';
  v_penalty := COALESCE((v_cod->>'penalty_points')::int, 50);
  v_bonus := COALESCE((v_cod->>'success_bonus_points')::int, 1);
  v_min := COALESCE((v_cod->>'min_trust_score')::int, 50);
  SELECT trust_score, cod_fail_count INTO v_current, v_fail FROM public.profiles WHERE user_id=p_buyer_id;
  v_current := COALESCE(v_current, 100); v_fail := COALESCE(v_fail, 0);
  IF p_success THEN
    v_new := LEAST(100, v_current + v_bonus);
    UPDATE public.profiles SET trust_score=v_new WHERE user_id=p_buyer_id;
  ELSE
    v_new := GREATEST(0, v_current - v_penalty);
    UPDATE public.profiles SET trust_score=v_new, cod_fail_count=v_fail+1,
      cod_enabled=CASE WHEN v_new < v_min THEN false ELSE cod_enabled END
    WHERE user_id=p_buyer_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_cod_eligibility(p_buyer_id uuid, p_merchant_id uuid, p_total_amount integer, p_distance_km numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cod jsonb; v_max_amt int; v_max_dist numeric; v_min_trust int;
  v_trust int; v_cod_enabled boolean; v_m_max_amt int; v_m_max_dist numeric;
BEGIN
  SELECT value INTO v_cod FROM public.app_settings WHERE key='cod_settings';
  v_max_amt := COALESCE((v_cod->>'max_amount')::int, 75000);
  v_max_dist := COALESCE((v_cod->>'max_distance_km')::numeric, 3);
  v_min_trust := COALESCE((v_cod->>'min_trust_score')::int, 50);
  SELECT trust_score, cod_enabled INTO v_trust, v_cod_enabled FROM public.profiles WHERE user_id=p_buyer_id;
  IF v_cod_enabled = false THEN RETURN jsonb_build_object('eligible', false, 'reason', 'Akun Anda tidak dapat menggunakan COD'); END IF;
  IF COALESCE(v_trust, 100) < v_min_trust THEN RETURN jsonb_build_object('eligible', false, 'reason', 'Trust score tidak mencukupi'); END IF;
  SELECT cod_max_amount, cod_max_distance_km INTO v_m_max_amt, v_m_max_dist FROM public.merchants WHERE id=p_merchant_id;
  v_max_amt := LEAST(v_max_amt, COALESCE(v_m_max_amt, v_max_amt));
  v_max_dist := LEAST(v_max_dist, COALESCE(v_m_max_dist, v_max_dist));
  IF p_total_amount > v_max_amt THEN RETURN jsonb_build_object('eligible', false, 'reason', format('Nominal terlalu besar. Maks: Rp %s', to_char(v_max_amt,'FM999,999,999'))); END IF;
  IF p_distance_km IS NOT NULL AND p_distance_km > v_max_dist THEN RETURN jsonb_build_object('eligible', false, 'reason', format('Jarak terlalu jauh. Maks: %s KM', v_max_dist)); END IF;
  RETURN jsonb_build_object('eligible', true, 'reason', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_voucher(p_code text, p_user_id uuid, p_order_total integer, p_merchant_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_voucher RECORD; v_usage_count int; v_discount int;
BEGIN
  SELECT * INTO v_voucher FROM public.vouchers
  WHERE UPPER(code)=UPPER(p_code) AND is_active=true AND start_date<=now() AND (end_date IS NULL OR end_date>=now());
  IF v_voucher IS NULL THEN RETURN jsonb_build_object('valid', false, 'error', 'Kode voucher tidak ditemukan'); END IF;
  IF v_voucher.merchant_id IS NOT NULL AND v_voucher.merchant_id != p_merchant_id THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Voucher tidak berlaku untuk toko ini'); END IF;
  IF p_order_total < v_voucher.min_order_amount THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Minimum belanja Rp ' || v_voucher.min_order_amount); END IF;
  IF v_voucher.usage_limit IS NOT NULL AND v_voucher.used_count >= v_voucher.usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Voucher sudah habis'); END IF;
  SELECT COUNT(*) INTO v_usage_count FROM public.voucher_usages WHERE voucher_id=v_voucher.id AND user_id=p_user_id;
  IF v_usage_count > 0 THEN RETURN jsonb_build_object('valid', false, 'error', 'Anda sudah menggunakan voucher ini'); END IF;
  IF v_voucher.discount_type='percentage' THEN
    v_discount := FLOOR(p_order_total * v_voucher.discount_value / 100);
    IF v_voucher.max_discount IS NOT NULL AND v_discount > v_voucher.max_discount THEN v_discount := v_voucher.max_discount; END IF;
  ELSE v_discount := v_voucher.discount_value; END IF;
  RETURN jsonb_build_object('valid', true, 'voucher_id', v_voucher.id, 'discount', v_discount, 'voucher_name', v_voucher.name);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_ride(p_ride_id uuid, p_courier_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ride RECORD;
BEGIN
  SELECT * INTO v_ride FROM public.ride_requests WHERE id = p_ride_id AND status = 'SEARCHING' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Ride not found or already taken'); END IF;
  UPDATE public.ride_requests SET courier_id=p_courier_id, status='ACCEPTED', accepted_at=now(), updated_at=now() WHERE id=p_ride_id;
  RETURN jsonb_build_object('success', true, 'message', 'Ride accepted');
END;
$$;

-- 6. TRIGGERS ------------------------------------------------------
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_refund_requests_updated_at ON public.refund_requests;
CREATE TRIGGER update_refund_requests_updated_at BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ride_requests_updated_at ON public.ride_requests;
CREATE TRIGGER update_ride_requests_updated_at BEFORE UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS order_notification_trigger ON public.orders;
CREATE TRIGGER order_notification_trigger AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_change();

DROP TRIGGER IF EXISTS trigger_set_auto_complete_deadline ON public.orders;
CREATE TRIGGER trigger_set_auto_complete_deadline BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_auto_complete_deadline();

DROP TRIGGER IF EXISTS trigger_update_trust_score ON public.orders;
CREATE TRIGGER trigger_update_trust_score AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_trust_score();

-- 7. RLS POLICIES --------------------------------------------------

-- products
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants can manage own products" ON public.products;
CREATE POLICY "Merchants can manage own products" ON public.products FOR ALL
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid()));

-- product_images
DROP POLICY IF EXISTS "Anyone can view product images" ON public.product_images;
CREATE POLICY "Anyone can view product images" ON public.product_images FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage all product images" ON public.product_images;
CREATE POLICY "Admins can manage all product images" ON public.product_images FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants can manage their product images" ON public.product_images;
CREATE POLICY "Merchants can manage their product images" ON public.product_images FOR ALL
  USING (EXISTS (SELECT 1 FROM public.products p JOIN public.merchants m ON p.merchant_id = m.id
    WHERE p.id = product_images.product_id AND m.user_id = auth.uid()));

-- product_variants
DROP POLICY IF EXISTS "Anyone can view active product variants" ON public.product_variants;
CREATE POLICY "Anyone can view active product variants" ON public.product_variants FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage all product variants" ON public.product_variants;
CREATE POLICY "Admins can manage all product variants" ON public.product_variants FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants can manage their product variants" ON public.product_variants;
CREATE POLICY "Merchants can manage their product variants" ON public.product_variants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.products p JOIN public.merchants m ON p.merchant_id = m.id
    WHERE p.id = product_variants.product_id AND m.user_id = auth.uid()));

-- orders
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
CREATE POLICY "Buyers can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
CREATE POLICY "Buyers can view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
CREATE POLICY "Buyers can update own orders" ON public.orders FOR UPDATE
  USING (auth.uid() = buyer_id AND status IN ('NEW','PENDING_PAYMENT','DELIVERED'))
  WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Merchants can view own orders" ON public.orders;
CREATE POLICY "Merchants can view own orders" ON public.orders FOR SELECT TO authenticated
  USING (public.is_order_merchant(auth.uid(), merchant_id));
DROP POLICY IF EXISTS "Merchants can update own orders" ON public.orders;
CREATE POLICY "Merchants can update own orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_order_merchant(auth.uid(), merchant_id));
DROP POLICY IF EXISTS "Couriers can view assigned orders" ON public.orders;
CREATE POLICY "Couriers can view assigned orders" ON public.orders FOR SELECT TO authenticated
  USING (public.is_courier_owner(auth.uid(), courier_id));
DROP POLICY IF EXISTS "Couriers can update assigned orders" ON public.orders;
CREATE POLICY "Couriers can update assigned orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_courier_owner(auth.uid(), courier_id));

-- order_items
DROP POLICY IF EXISTS "Users can insert order items for own orders" ON public.order_items;
CREATE POLICY "Users can insert order items for own orders" ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.buyer_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND (orders.buyer_id = auth.uid() OR public.is_admin())));
DROP POLICY IF EXISTS "Merchants can view order items" ON public.order_items;
CREATE POLICY "Merchants can view order items" ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o JOIN public.merchants m ON o.merchant_id = m.id
    WHERE o.id = order_items.order_id AND m.user_id = auth.uid()));
DROP POLICY IF EXISTS "Couriers can view order items" ON public.order_items;
CREATE POLICY "Couriers can view order items" ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o JOIN public.couriers c ON o.courier_id = c.id
    WHERE o.id = order_items.order_id AND c.user_id = auth.uid()));

-- flash_sales
DROP POLICY IF EXISTS "Public can view active flash sales" ON public.flash_sales;
CREATE POLICY "Public can view active flash sales" ON public.flash_sales FOR SELECT
  USING (status = 'ACTIVE' AND end_time > now());
DROP POLICY IF EXISTS "Admins can manage all flash sales" ON public.flash_sales;
CREATE POLICY "Admins can manage all flash sales" ON public.flash_sales FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants can manage their flash sales" ON public.flash_sales;
CREATE POLICY "Merchants can manage their flash sales" ON public.flash_sales FOR ALL
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- reviews
DROP POLICY IF EXISTS "Anyone can view visible reviews" ON public.reviews;
CREATE POLICY "Anyone can view visible reviews" ON public.reviews FOR SELECT USING (is_visible = true);
DROP POLICY IF EXISTS "Buyers can create reviews for their orders" ON public.reviews;
CREATE POLICY "Buyers can create reviews for their orders" ON public.reviews FOR INSERT WITH CHECK (buyer_id = auth.uid());
DROP POLICY IF EXISTS "Merchants can reply to their reviews" ON public.reviews;
CREATE POLICY "Merchants can reply to their reviews" ON public.reviews FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = reviews.merchant_id AND merchants.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;
CREATE POLICY "Admins can manage reviews" ON public.reviews FOR ALL USING (public.is_admin());

-- refund_requests
DROP POLICY IF EXISTS "Admins can manage refunds" ON public.refund_requests;
CREATE POLICY "Admins can manage refunds" ON public.refund_requests FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Buyers can create refund requests" ON public.refund_requests;
CREATE POLICY "Buyers can create refund requests" ON public.refund_requests FOR INSERT WITH CHECK (buyer_id = auth.uid());
DROP POLICY IF EXISTS "Buyers can view own refunds" ON public.refund_requests;
CREATE POLICY "Buyers can view own refunds" ON public.refund_requests FOR SELECT USING (buyer_id = auth.uid());
DROP POLICY IF EXISTS "Merchants can view own refunds" ON public.refund_requests;
CREATE POLICY "Merchants can view own refunds" ON public.refund_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = refund_requests.merchant_id AND m.user_id = auth.uid()));

-- withdrawal_requests
DROP POLICY IF EXISTS "Admins can manage withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Admins can manage withdrawals" ON public.withdrawal_requests FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants can create withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Merchants can create withdrawals" ON public.withdrawal_requests FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = withdrawal_requests.merchant_id AND merchants.user_id = auth.uid()) AND status = 'PENDING');
DROP POLICY IF EXISTS "Merchants can view own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Merchants can view own withdrawals" ON public.withdrawal_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = withdrawal_requests.merchant_id AND merchants.user_id = auth.uid()));

-- platform_fees
DROP POLICY IF EXISTS "Admins can manage platform_fees" ON public.platform_fees;
CREATE POLICY "Admins can manage platform_fees" ON public.platform_fees FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants can view own fees" ON public.platform_fees;
CREATE POLICY "Merchants can view own fees" ON public.platform_fees FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = platform_fees.merchant_id AND merchants.user_id = auth.uid()));

-- insurance_fund
DROP POLICY IF EXISTS "Admins can manage insurance fund" ON public.insurance_fund;
CREATE POLICY "Admins can manage insurance fund" ON public.insurance_fund FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants can view own insurance" ON public.insurance_fund;
CREATE POLICY "Merchants can view own insurance" ON public.insurance_fund FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = insurance_fund.merchant_id AND merchants.user_id = auth.uid()));
DROP POLICY IF EXISTS "Merchants can create claims" ON public.insurance_fund;
CREATE POLICY "Merchants can create claims" ON public.insurance_fund FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = insurance_fund.merchant_id AND merchants.user_id = auth.uid())
    AND type = 'claim' AND status = 'PENDING');

-- vouchers
DROP POLICY IF EXISTS "Vouchers viewable by everyone" ON public.vouchers;
CREATE POLICY "Vouchers viewable by everyone" ON public.vouchers FOR SELECT
  USING (is_active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));
DROP POLICY IF EXISTS "Admins manage all vouchers" ON public.vouchers;
CREATE POLICY "Admins manage all vouchers" ON public.vouchers FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants manage own vouchers" ON public.vouchers;
CREATE POLICY "Merchants manage own vouchers" ON public.vouchers FOR ALL
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()) OR public.is_admin());

-- voucher_usages
DROP POLICY IF EXISTS "Users can use vouchers" ON public.voucher_usages;
CREATE POLICY "Users can use vouchers" ON public.voucher_usages FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users view own usage" ON public.voucher_usages;
CREATE POLICY "Users view own usage" ON public.voucher_usages FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- promotions
DROP POLICY IF EXISTS "Anyone can view active promotions" ON public.promotions;
CREATE POLICY "Anyone can view active promotions" ON public.promotions FOR SELECT
  USING (is_active = true AND is_approved = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));
DROP POLICY IF EXISTS "Admins can manage promotions" ON public.promotions;
CREATE POLICY "Admins can manage promotions" ON public.promotions FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Merchants can create own promotions" ON public.promotions;
CREATE POLICY "Merchants can create own promotions" ON public.promotions FOR INSERT
  WITH CHECK (advertiser_type = 'merchant' AND is_approved = false);
DROP POLICY IF EXISTS "Villages can create own promotions" ON public.promotions;
CREATE POLICY "Villages can create own promotions" ON public.promotions FOR INSERT
  WITH CHECK (advertiser_type = 'village' AND is_approved = false);

-- ride_requests
DROP POLICY IF EXISTS "Passengers can create ride requests" ON public.ride_requests;
CREATE POLICY "Passengers can create ride requests" ON public.ride_requests FOR INSERT TO authenticated
  WITH CHECK (passenger_id = auth.uid());
DROP POLICY IF EXISTS "Passengers can view own rides" ON public.ride_requests;
CREATE POLICY "Passengers can view own rides" ON public.ride_requests FOR SELECT TO authenticated
  USING (passenger_id = auth.uid());
DROP POLICY IF EXISTS "Couriers can view searching rides" ON public.ride_requests;
CREATE POLICY "Couriers can view searching rides" ON public.ride_requests FOR SELECT TO authenticated
  USING (status = 'SEARCHING' AND EXISTS (SELECT 1 FROM public.couriers
    WHERE user_id = auth.uid() AND status = 'ACTIVE' AND is_available = true));
DROP POLICY IF EXISTS "Couriers can view assigned rides" ON public.ride_requests;
CREATE POLICY "Couriers can view assigned rides" ON public.ride_requests FOR SELECT TO authenticated
  USING (courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Couriers can update assigned rides" ON public.ride_requests;
CREATE POLICY "Couriers can update assigned rides" ON public.ride_requests FOR UPDATE TO authenticated
  USING (courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can manage all rides" ON public.ride_requests;
CREATE POLICY "Admins can manage all rides" ON public.ride_requests FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Passengers can update own rides" ON public.ride_requests;
CREATE POLICY "Passengers can update own rides" ON public.ride_requests FOR UPDATE TO authenticated
  USING (passenger_id = auth.uid() AND status IN ('SEARCHING', 'ACCEPTED'));
