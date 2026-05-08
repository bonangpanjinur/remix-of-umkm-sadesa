-- ============================================================
-- DesaMart - Complete PostgreSQL Schema
-- Adapted from Supabase migrations for plain PostgreSQL
-- auth.users FK references removed, RLS policies removed,
-- Supabase-specific storage/realtime directives removed.
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','buyer','verifikator','merchant','courier','admin_desa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- UTILITY FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- USER_ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'buyer',
  UNIQUE (user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  address TEXT,
  village TEXT,
  avatar_url TEXT,
  -- Address components
  province_id TEXT,
  province_name TEXT,
  city_id TEXT,
  city_name TEXT,
  district_id TEXT,
  district_name TEXT,
  village_id TEXT,
  village_name TEXT,
  address_detail TEXT,
  -- COD / trust
  cod_enabled BOOLEAN DEFAULT true,
  trust_score INTEGER DEFAULT 100,
  cod_fail_count INTEGER DEFAULT 0,
  is_verified_buyer BOOLEAN DEFAULT false,
  -- Blocking
  is_blocked BOOLEAN DEFAULT false,
  blocked_at TIMESTAMP WITH TIME ZONE,
  blocked_by UUID,
  block_reason TEXT,
  -- Role (denormalized for quick access)
  role TEXT DEFAULT 'buyer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- VILLAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.villages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  regency TEXT NOT NULL,
  province TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  registration_status TEXT NOT NULL DEFAULT 'APPROVED',
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  rejection_reason TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  subdistrict TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_villages_registration ON public.villages(registration_status);

-- ============================================================
-- VERIFIKATOR_CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.verifikator_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verifikator_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  trade_group TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  max_usage INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- TRADE_GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trade_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  verifikator_id UUID NOT NULL,
  monthly_fee INTEGER NOT NULL DEFAULT 10000,
  village_id UUID REFERENCES public.villages(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_trade_groups_updated_at
  BEFORE UPDATE ON public.trade_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TRANSACTION_PACKAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transaction_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  classification_price TEXT NOT NULL,
  price_per_transaction INTEGER NOT NULL DEFAULT 0,
  group_commission_percent NUMERIC NOT NULL DEFAULT 5,
  transaction_quota INTEGER NOT NULL DEFAULT 100,
  total_credits INTEGER NOT NULL DEFAULT 100,
  validity_days INTEGER NOT NULL DEFAULT 30,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_transaction_packages_updated_at
  BEFORE UPDATE ON public.transaction_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MERCHANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  village_id UUID REFERENCES public.villages(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT,
  address TEXT,
  phone TEXT,
  open_time TIME,
  close_time TIME,
  classification_price TEXT CHECK (classification_price IN ('UNDER_5K','FROM_5K_TO_10K','FROM_10K_TO_20K','ABOVE_20K')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','PENDING')),
  registration_status TEXT NOT NULL DEFAULT 'APPROVED',
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  rejection_reason TEXT,
  order_mode TEXT NOT NULL DEFAULT 'ADMIN_ASSISTED' CHECK (order_mode IN ('SELF','ADMIN_ASSISTED')),
  rating_avg DECIMAL(2,1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  badge TEXT CHECK (badge IN ('VERIFIED','POPULAR','NEW')),
  image_url TEXT,
  cover_image_url TEXT,
  is_open BOOLEAN NOT NULL DEFAULT true,
  -- Location
  province TEXT,
  city TEXT,
  district TEXT,
  subdistrict TEXT,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  -- Business
  business_category TEXT DEFAULT 'kuliner',
  business_description TEXT,
  -- Verifikator
  verifikator_code TEXT,
  verifikator_id UUID,
  trade_group TEXT,
  group_id UUID REFERENCES public.trade_groups(id) ON DELETE SET NULL,
  -- Balance
  available_balance INTEGER DEFAULT 0,
  pending_balance INTEGER DEFAULT 0,
  total_withdrawn INTEGER DEFAULT 0,
  -- COD
  cod_max_amount INTEGER DEFAULT 75000,
  cod_max_distance_km NUMERIC DEFAULT 3,
  payment_cod_enabled BOOLEAN DEFAULT true,
  payment_transfer_enabled BOOLEAN DEFAULT true,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  qris_image_url TEXT,
  -- Halal
  halal_status TEXT DEFAULT 'NONE',
  halal_certificate_url TEXT,
  ktp_url TEXT,
  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  -- Subscription
  current_subscription_id UUID,
  -- Other
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON public.merchants(user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_village_id ON public.merchants(village_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON public.merchants(status);
CREATE INDEX IF NOT EXISTS idx_merchants_registration ON public.merchants(registration_status);
CREATE INDEX IF NOT EXISTS idx_merchants_location ON public.merchants(location_lat, location_lng);

CREATE TRIGGER update_merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MERCHANT_SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.merchant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.transaction_packages(id),
  transaction_quota INTEGER NOT NULL DEFAULT 0,
  used_quota INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expired_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  payment_amount INTEGER NOT NULL DEFAULT 0,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_merchant_subscriptions_merchant ON public.merchant_subscriptions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_subscriptions_status ON public.merchant_subscriptions(status);

CREATE TRIGGER update_merchant_subscriptions_updated_at
  BEFORE UPDATE ON public.merchant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- VERIFIKATOR_EARNINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.verifikator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verifikator_id UUID NOT NULL,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.merchant_subscriptions(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.transaction_packages(id) ON DELETE CASCADE,
  package_amount INTEGER NOT NULL,
  commission_percent NUMERIC NOT NULL,
  commission_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- VERIFIKATOR_WITHDRAWALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.verifikator_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verifikator_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  proof_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_verifikator_withdrawals_updated_at
  BEFORE UPDATE ON public.verifikator_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- GROUP_MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.trade_groups(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  UNIQUE(group_id, merchant_id)
);

-- ============================================================
-- KAS_PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kas_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.trade_groups(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  payment_month INTEGER NOT NULL,
  payment_year INTEGER NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'UNPAID',
  notes TEXT,
  collected_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, merchant_id, payment_month, payment_year)
);

CREATE TRIGGER update_kas_payments_updated_at
  BEFORE UPDATE ON public.kas_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- QUOTA_TIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quota_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_price INTEGER NOT NULL DEFAULT 0,
  max_price INTEGER DEFAULT NULL,
  credit_cost INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_quota_tiers_updated_at
  BEFORE UPDATE ON public.quota_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'kuliner',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_promo BOOLEAN NOT NULL DEFAULT false,
  -- Analytics
  view_count INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  -- Discount
  discount_percent INTEGER DEFAULT 0,
  discount_end_date TIMESTAMP WITH TIME ZONE,
  min_stock_alert INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON public.products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PRODUCT_VARIANTS (marketplace)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  price_adjustment INTEGER DEFAULT 0,
  stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PRODUCT_IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON public.product_images(product_id, is_primary) WHERE is_primary = true;

-- ============================================================
-- FLASH_SALES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.flash_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  original_price INTEGER NOT NULL,
  flash_price INTEGER NOT NULL,
  stock_available INTEGER NOT NULL DEFAULT 1,
  stock_sold INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ENDED','CANCELLED')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flash_sales_status_end ON public.flash_sales(status, end_time);
CREATE INDEX IF NOT EXISTS idx_flash_sales_merchant ON public.flash_sales(merchant_id);

CREATE TRIGGER update_flash_sales_updated_at
  BEFORE UPDATE ON public.flash_sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TOURISM
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tourism (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id UUID REFERENCES public.villages(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  wa_link TEXT,
  sosmed_link TEXT,
  facilities TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tourism_village_id ON public.tourism(village_id);
CREATE INDEX IF NOT EXISTS idx_tourism_location ON public.tourism(location_lat, location_lng);

-- ============================================================
-- COURIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.couriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  province TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  subdistrict TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  ktp_number TEXT NOT NULL DEFAULT '',
  ktp_image_url TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  vehicle_type TEXT NOT NULL DEFAULT 'motor',
  vehicle_plate TEXT,
  vehicle_image_url TEXT NOT NULL DEFAULT '',
  registration_status TEXT NOT NULL DEFAULT 'PENDING',
  status TEXT NOT NULL DEFAULT 'INACTIVE',
  is_available BOOLEAN NOT NULL DEFAULT false,
  current_lat NUMERIC,
  current_lng NUMERIC,
  last_location_update TIMESTAMP WITH TIME ZONE,
  village_id UUID REFERENCES public.villages(id),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  -- Balance
  balance NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_couriers_user_id ON public.couriers(user_id);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON public.couriers(status);

CREATE TRIGGER update_couriers_updated_at
  BEFORE UPDATE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- APP_SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PROMOTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('banner','wisata_populer','produk_populer','promo_spesial')),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  link_type TEXT CHECK (link_type IN ('product','tourism','village','merchant','external','category')),
  link_id UUID,
  advertiser_type TEXT CHECK (advertiser_type IN ('admin','village','merchant')),
  advertiser_id UUID,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  price INTEGER DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- VOUCHERS (marketplace)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed')),
  discount_value INTEGER NOT NULL DEFAULT 0,
  min_order_amount INTEGER DEFAULT 0,
  max_discount INTEGER,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','PENDING_CONFIRMATION','PROCESSED','SENT','DELIVERED','DONE','CANCELED','REJECTED_BY_BUYER')),
  handled_by TEXT NOT NULL DEFAULT 'ADMIN' CHECK (handled_by IN ('ADMIN','MERCHANT')),
  delivery_type TEXT NOT NULL DEFAULT 'PICKUP' CHECK (delivery_type IN ('PICKUP','INTERNAL','COURIER')),
  delivery_address TEXT,
  delivery_phone TEXT,
  delivery_name TEXT,
  shipping_cost INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  -- Courier
  courier_id UUID REFERENCES public.couriers(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivery_lat NUMERIC,
  delivery_lng NUMERIC,
  -- Payment
  payment_status TEXT DEFAULT 'UNPAID',
  payment_invoice_id TEXT,
  payment_invoice_url TEXT,
  payment_paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  payment_channel TEXT,
  -- COD
  confirmation_deadline TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  cod_service_fee INTEGER DEFAULT 0,
  cod_confirmed_at TIMESTAMP WITH TIME ZONE,
  cod_rejected_at TIMESTAMP WITH TIME ZONE,
  cod_rejection_reason TEXT,
  buyer_distance_km NUMERIC,
  -- Flash sale
  is_flash_sale BOOLEAN DEFAULT false,
  flash_sale_discount INTEGER DEFAULT 0,
  -- POD
  pod_image_url TEXT,
  pod_notes TEXT,
  pod_uploaded_at TIMESTAMP WITH TIME ZONE,
  -- Auto-complete
  auto_complete_at TIMESTAMP WITH TIME ZONE,
  -- Review
  has_review BOOLEAN DEFAULT FALSE,
  -- Voucher
  voucher_id UUID REFERENCES public.vouchers(id) ON DELETE SET NULL,
  voucher_discount INTEGER DEFAULT 0,
  platform_fee INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON public.orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ORDER_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  buyer_id UUID NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  image_urls TEXT[] DEFAULT '{}',
  merchant_reply TEXT,
  merchant_replied_at TIMESTAMP WITH TIME ZONE,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_merchant_id ON public.reviews(merchant_id);

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- WITHDRAWAL_REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- INSURANCE_FUND
-- ============================================================
CREATE TABLE IF NOT EXISTS public.insurance_fund (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  claim_reason TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- REFUND_REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_buyer ON public.refund_requests(buyer_id);

CREATE TRIGGER update_refund_requests_updated_at
  BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ADMIN_AUDIT_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity ON public.admin_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- ============================================================
-- PLATFORM_FEES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  order_total INTEGER NOT NULL DEFAULT 0,
  shipping_cost INTEGER NOT NULL DEFAULT 0,
  platform_fee INTEGER NOT NULL DEFAULT 0,
  platform_fee_percent NUMERIC NOT NULL DEFAULT 0,
  courier_fee INTEGER NOT NULL DEFAULT 0,
  merchant_revenue INTEGER NOT NULL DEFAULT 0,
  fee_type TEXT NOT NULL DEFAULT 'ORDER',
  status TEXT NOT NULL DEFAULT 'PENDING',
  collected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- BROADCAST_NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.broadcast_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'ALL',
  target_roles TEXT[] DEFAULT '{}',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_broadcast_notifications_updated_at
  BEFORE UPDATE ON public.broadcast_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- COURIER_EARNINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courier_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'DELIVERY',
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- COURIER_DEPOSITS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courier_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  admin_notes TEXT,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- COURIER_BALANCE_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courier_balance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  balance_before NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- RIDE_REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ride_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL,
  driver_id UUID REFERENCES public.couriers(id) ON DELETE SET NULL,
  pickup_lat NUMERIC NOT NULL,
  pickup_lng NUMERIC NOT NULL,
  pickup_address TEXT NOT NULL DEFAULT '',
  destination_lat NUMERIC NOT NULL,
  destination_lng NUMERIC NOT NULL,
  destination_address TEXT NOT NULL DEFAULT '',
  distance_km NUMERIC NOT NULL DEFAULT 0,
  estimated_fare INTEGER NOT NULL DEFAULT 0,
  final_fare INTEGER,
  status TEXT NOT NULL DEFAULT 'SEARCHING',
  accepted_at TIMESTAMP WITH TIME ZONE,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  rating INTEGER,
  rating_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_ride_requests_updated_at
  BEFORE UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- WISHLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON public.wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON public.wishlists(product_id);

-- ============================================================
-- MERCHANT_FAVORITES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.merchant_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, merchant_id)
);

-- ============================================================
-- PUSH_SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PASSWORD_RESET_TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON public.password_reset_tokens(email);

-- ============================================================
-- SAVED_ADDRESSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT 'Rumah',
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province_id TEXT,
  province_name TEXT,
  city_id TEXT,
  city_name TEXT,
  district_id TEXT,
  district_name TEXT,
  village_id TEXT,
  village_name TEXT,
  address_detail TEXT,
  full_address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id ON public.saved_addresses(user_id);

CREATE TRIGGER update_saved_addresses_updated_at
  BEFORE UPDATE ON public.saved_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- VOUCHER_USAGES (marketplace)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.voucher_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- SEO_SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  keywords TEXT,
  og_image TEXT,
  og_title TEXT,
  og_description TEXT,
  canonical_url TEXT,
  robots TEXT DEFAULT 'index, follow',
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TRIGGER update_seo_settings_updated_at
  BEFORE UPDATE ON public.seo_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BACKUP_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  file_url TEXT,
  file_size INTEGER,
  tables_included TEXT[],
  error_message TEXT,
  created_by UUID,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- BACKUP_SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.backup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  schedule_type TEXT NOT NULL DEFAULT 'daily',
  schedule_time TIME NOT NULL DEFAULT '02:00',
  schedule_day INTEGER,
  tables_included TEXT[] DEFAULT ARRAY['merchants','products','orders','villages','tourism','couriers'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_backup_schedules_updated_at
  BEFORE UPDATE ON public.backup_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RATE_LIMITS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_unique ON public.rate_limits(identifier, action, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits(window_start);

-- ============================================================
-- HALAL_REGULATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.halal_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CHAT_MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  chat_type TEXT DEFAULT 'buyer_merchant',
  image_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_delete_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_order_id ON public.chat_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_auto_delete ON public.chat_messages(auto_delete_at) WHERE auto_delete_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_type ON public.chat_messages(order_id, chat_type);

-- ============================================================
-- PAGE_VIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  viewer_id UUID,
  page_type TEXT NOT NULL DEFAULT 'product',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_views_merchant ON public.page_views(merchant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_product ON public.page_views(product_id, created_at);

-- ============================================================
-- MERCHANT_OPERATING_HOURS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.merchant_operating_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL DEFAULT '08:00:00',
  close_time TIME NOT NULL DEFAULT '21:00:00',
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (merchant_id, day_of_week)
);

CREATE TRIGGER update_merchant_operating_hours_updated_at
  BEFORE UPDATE ON public.merchant_operating_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- API_KEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_prefix TEXT,
  key_value TEXT UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON public.api_keys(key_value) WHERE key_value IS NOT NULL;

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- POS PHASE 1: TENANTS, OUTLETS, USERS, MASTER DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  phone TEXT,
  address TEXT,
  timezone TEXT DEFAULT 'Asia/Jakarta',
  language TEXT DEFAULT 'id',
  currency TEXT DEFAULT 'IDR',
  receipt_header TEXT,
  receipt_footer TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_tenants_user_id ON public.pos_tenants(user_id);

CREATE TRIGGER update_pos_tenants_updated_at
  BEFORE UPDATE ON public.pos_tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER update_pos_outlets_updated_at
  BEFORE UPDATE ON public.pos_outlets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'kasir' CHECK (role IN ('owner','manager','kasir','staff_gudang','purchasing','finance','auditor')),
  pin TEXT,
  outlet_id UUID REFERENCES public.pos_outlets(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_users_tenant ON public.pos_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_users_user_id ON public.pos_users(user_id);

CREATE TRIGGER update_pos_users_updated_at
  BEFORE UPDATE ON public.pos_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.pos_categories(id),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_categories_tenant ON public.pos_categories(tenant_id);

CREATE TABLE IF NOT EXISTS public.pos_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.pos_categories(id),
  brand_id UUID REFERENCES public.pos_brands(id),
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  unit TEXT DEFAULT 'pcs',
  price NUMERIC(15,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(15,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  is_stock_tracked BOOLEAN DEFAULT true,
  has_variants BOOLEAN DEFAULT false,
  image_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_products_tenant ON public.pos_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_products_category ON public.pos_products(category_id);

CREATE TRIGGER update_pos_products_updated_at
  BEFORE UPDATE ON public.pos_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.pos_products(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price NUMERIC(15,2),
  cost_price NUMERIC(15,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.pos_products(id) ON DELETE CASCADE NOT NULL,
  variant_id UUID REFERENCES public.pos_product_variants(id),
  outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE CASCADE NOT NULL,
  quantity NUMERIC(15,3) DEFAULT 0,
  min_stock NUMERIC(15,3) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, variant_id, outlet_id)
);
CREATE INDEX IF NOT EXISTS idx_pos_stock_product_outlet ON public.pos_stock(product_id, outlet_id);

CREATE TRIGGER update_pos_stock_updated_at
  BEFORE UPDATE ON public.pos_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_stock_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.pos_products(id) NOT NULL,
  variant_id UUID REFERENCES public.pos_product_variants(id),
  outlet_id UUID REFERENCES public.pos_outlets(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('initial','purchase','sale','adjustment','return_sale','return_purchase','transfer_in','transfer_out','opname')),
  quantity NUMERIC(15,3) NOT NULL,
  quantity_before NUMERIC(15,3),
  quantity_after NUMERIC(15,3),
  reference_id UUID,
  reference_type TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_stock_mutations_product ON public.pos_stock_mutations(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pos_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_member BOOLEAN DEFAULT false,
  total_purchase NUMERIC(15,2) DEFAULT 0,
  transaction_count INT DEFAULT 0,
  last_purchase_at TIMESTAMPTZ,
  loyalty_points INTEGER DEFAULT 0,
  loyalty_tier TEXT DEFAULT 'Bronze',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_customers_tenant ON public.pos_customers(tenant_id);

CREATE TRIGGER update_pos_customers_updated_at
  BEFORE UPDATE ON public.pos_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  contact_person TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER update_pos_suppliers_updated_at
  BEFORE UPDATE ON public.pos_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id UUID REFERENCES public.pos_outlets(id) NOT NULL,
  sale_number TEXT NOT NULL,
  cashier_id UUID,
  cashier_name TEXT,
  customer_id UUID REFERENCES public.pos_customers(id),
  customer_name TEXT,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash','qris','transfer','debit','credit','split')),
  payment_amount NUMERIC(15,2) DEFAULT 0,
  change_amount NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed','void','refunded')),
  notes TEXT,
  voided_by UUID,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  -- Loyalty & promo
  promotion_id UUID,
  voucher_id UUID,
  voucher_code TEXT,
  promotion_discount NUMERIC DEFAULT 0,
  voucher_discount NUMERIC DEFAULT 0,
  loyalty_points_earned INTEGER DEFAULT 0,
  loyalty_points_redeemed INTEGER DEFAULT 0,
  loyalty_discount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_sales_tenant_created ON public.pos_sales(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_outlet ON public.pos_sales(outlet_id);

CREATE TABLE IF NOT EXISTS public.pos_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.pos_sales(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.pos_products(id),
  variant_id UUID REFERENCES public.pos_product_variants(id),
  product_name TEXT NOT NULL,
  variant_name TEXT,
  sku TEXT,
  qty NUMERIC(15,3) NOT NULL DEFAULT 1,
  price NUMERIC(15,2) NOT NULL,
  cost_price NUMERIC(15,2) DEFAULT 0,
  discount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  subtotal NUMERIC(15,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_held_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id UUID REFERENCES public.pos_outlets(id) NOT NULL,
  cashier_id UUID,
  label TEXT,
  customer_name TEXT,
  customer_id UUID REFERENCES public.pos_customers(id),
  items JSONB NOT NULL DEFAULT '[]',
  discount_amount NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_sale_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  sale_id UUID REFERENCES public.pos_sales(id) NOT NULL,
  outlet_id UUID REFERENCES public.pos_outlets(id) NOT NULL,
  return_number TEXT NOT NULL,
  reason TEXT,
  refund_method TEXT DEFAULT 'cash' CHECK (refund_method IN ('cash','store_credit')),
  total_refund NUMERIC(15,2) NOT NULL DEFAULT 0,
  restock BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_sale_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES public.pos_sale_returns(id) ON DELETE CASCADE NOT NULL,
  sale_item_id UUID REFERENCES public.pos_sale_items(id) NOT NULL,
  product_id UUID REFERENCES public.pos_products(id),
  product_name TEXT NOT NULL,
  qty NUMERIC(15,3) NOT NULL,
  price NUMERIC(15,2) NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL
);

-- ============================================================
-- POS PHASE 2: PURCHASE ORDERS & KAS HARIAN
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES public.pos_suppliers(id),
  supplier_name TEXT NOT NULL,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','received','cancelled')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  received_date DATE,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_purchase_orders_tenant ON public.pos_purchase_orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_purchase_orders_status ON public.pos_purchase_orders(status);

CREATE TRIGGER update_pos_purchase_orders_updated_at
  BEFORE UPDATE ON public.pos_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.pos_purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.pos_products(id),
  variant_id UUID REFERENCES public.pos_product_variants(id),
  product_name TEXT NOT NULL,
  sku TEXT,
  unit TEXT DEFAULT 'pcs',
  qty_ordered NUMERIC(15,3) NOT NULL DEFAULT 0,
  qty_received NUMERIC(15,3) DEFAULT 0,
  cost_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_po_items_po ON public.pos_purchase_order_items(purchase_order_id);

CREATE TABLE IF NOT EXISTS public.pos_purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE CASCADE NOT NULL,
  purchase_order_id UUID REFERENCES public.pos_purchase_orders(id),
  supplier_name TEXT NOT NULL,
  return_number TEXT NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_purchase_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_return_id UUID REFERENCES public.pos_purchase_returns(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.pos_products(id),
  product_name TEXT NOT NULL,
  qty NUMERIC(15,3) NOT NULL,
  cost_price NUMERIC(15,2) NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE CASCADE NOT NULL,
  cashier_id UUID,
  cashier_name TEXT NOT NULL,
  session_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(15,2),
  expected_balance NUMERIC(15,2),
  difference NUMERIC(15,2),
  cash_sales_total NUMERIC(15,2) DEFAULT 0,
  non_cash_sales_total NUMERIC(15,2) DEFAULT 0,
  cash_in_total NUMERIC(15,2) DEFAULT 0,
  cash_out_total NUMERIC(15,2) DEFAULT 0,
  notes_open TEXT,
  notes_close TEXT,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_cash_sessions_tenant ON public.pos_cash_sessions(tenant_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_cash_sessions_status ON public.pos_cash_sessions(status);

CREATE TABLE IF NOT EXISTS public.pos_cash_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE CASCADE NOT NULL,
  cash_session_id UUID REFERENCES public.pos_cash_sessions(id),
  type TEXT NOT NULL CHECK (type IN ('in','out')),
  category TEXT NOT NULL DEFAULT 'other',
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  reference TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_cash_mutations_session ON public.pos_cash_mutations(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_pos_cash_mutations_tenant ON public.pos_cash_mutations(tenant_id, created_at DESC);

-- ============================================================
-- POS PHASE 4: MULTI-OUTLET & AUDIT TRAIL
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  transfer_number TEXT NOT NULL,
  from_outlet_id UUID REFERENCES public.pos_outlets(id) NOT NULL,
  to_outlet_id UUID REFERENCES public.pos_outlets(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','completed','rejected','cancelled')),
  notes TEXT,
  rejection_reason TEXT,
  requested_by UUID,
  approved_by UUID,
  completed_by UUID,
  requested_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_transfers_tenant ON public.pos_stock_transfers(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_transfers_status ON public.pos_stock_transfers(status);

CREATE TRIGGER update_pos_stock_transfers_updated_at
  BEFORE UPDATE ON public.pos_stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID REFERENCES public.pos_stock_transfers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.pos_products(id) NOT NULL,
  variant_id UUID REFERENCES public.pos_product_variants(id),
  product_name TEXT NOT NULL,
  sku TEXT,
  unit TEXT DEFAULT 'pcs',
  qty_requested NUMERIC(15,3) NOT NULL DEFAULT 0,
  qty_sent NUMERIC(15,3) DEFAULT 0,
  qty_received NUMERIC(15,3) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_transfer_items ON public.pos_stock_transfer_items(transfer_id);

CREATE TABLE IF NOT EXISTS public.pos_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id UUID REFERENCES public.pos_outlets(id),
  user_id UUID,
  user_name TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  description TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_audit_tenant ON public.pos_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_audit_user ON public.pos_audit_logs(user_id);

CREATE TABLE IF NOT EXISTS public.pos_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id UUID REFERENCES public.pos_outlets(id),
  user_id UUID,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','error','success')),
  category TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_notif_user ON public.pos_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_pos_notif_tenant ON public.pos_notifications(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pos_user_outlet_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.pos_tenants(id) ON DELETE CASCADE NOT NULL,
  pos_user_id UUID REFERENCES public.pos_users(id) ON DELETE CASCADE NOT NULL,
  outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'kasir' CHECK (role IN ('owner','manager','kasir','staff_gudang','purchasing','finance','auditor')),
  is_active BOOLEAN DEFAULT true,
  granted_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pos_user_id, outlet_id)
);
CREATE INDEX IF NOT EXISTS idx_pos_outlet_access ON public.pos_user_outlet_access(pos_user_id);
CREATE INDEX IF NOT EXISTS idx_pos_outlet_access_outlet ON public.pos_user_outlet_access(outlet_id);

CREATE TRIGGER update_pos_user_outlet_access_updated_at
  BEFORE UPDATE ON public.pos_user_outlet_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- POS PHASE 5: LOYALTY & PROMOTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  outlet_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'discount_percent',
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  min_purchase NUMERIC DEFAULT 0,
  max_discount NUMERIC,
  buy_qty INTEGER DEFAULT 0,
  get_qty INTEGER DEFAULT 0,
  get_product_id UUID,
  bundle_product_ids JSONB DEFAULT '[]',
  bundle_price NUMERIC,
  happy_hour_start TIME,
  happy_hour_end TIME,
  happy_hour_days JSONB DEFAULT '[0,1,2,3,4,5,6]',
  applies_to TEXT NOT NULL DEFAULT 'all',
  product_ids JSONB DEFAULT '[]',
  category_ids JSONB DEFAULT '[]',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_promotions_tenant ON public.pos_promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_promotions_active ON public.pos_promotions(tenant_id, is_active);

CREATE TRIGGER update_pos_promotions_updated_at
  BEFORE UPDATE ON public.pos_promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'discount_percent',
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  min_purchase NUMERIC DEFAULT 0,
  max_discount NUMERIC,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_pos_vouchers_tenant ON public.pos_vouchers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_vouchers_code ON public.pos_vouchers(tenant_id, code);

CREATE TRIGGER update_pos_vouchers_updated_at
  BEFORE UPDATE ON public.pos_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_voucher_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES public.pos_vouchers(id) ON DELETE CASCADE,
  sale_id UUID,
  customer_id UUID,
  customer_name TEXT,
  discount_given NUMERIC NOT NULL DEFAULT 0,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Program Poin',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  earn_per_rupiah INTEGER NOT NULL DEFAULT 10000,
  redeem_rate INTEGER NOT NULL DEFAULT 100,
  min_redeem_points INTEGER NOT NULL DEFAULT 100,
  max_redeem_percent INTEGER NOT NULL DEFAULT 50,
  point_expiry_days INTEGER NOT NULL DEFAULT 0,
  tiers JSONB DEFAULT '[{"name":"Bronze","min_points":0,"discount_percent":0,"color":"#92400e"},{"name":"Silver","min_points":500,"discount_percent":2,"color":"#6b7280"},{"name":"Gold","min_points":2000,"discount_percent":5,"color":"#d97706"},{"name":"Platinum","min_points":5000,"discount_percent":8,"color":"#7c3aed"}]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_pos_loyalty_programs_updated_at
  BEFORE UPDATE ON public.pos_loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.pos_customers(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  used_points INTEGER NOT NULL DEFAULT 0,
  expired_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'Bronze',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_pos_loyalty_points_tenant ON public.pos_loyalty_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_loyalty_points_customer ON public.pos_loyalty_points(customer_id);

CREATE TABLE IF NOT EXISTS public.pos_loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.pos_customers(id) ON DELETE CASCADE,
  sale_id UUID,
  type TEXT NOT NULL,
  points INTEGER NOT NULL,
  balance_before INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_loyalty_tx_customer ON public.pos_loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_pos_loyalty_tx_tenant ON public.pos_loyalty_transactions(tenant_id);

-- ============================================================
-- POS PHASE 6: MARKETPLACE INTEGRATION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_marketplace_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  pos_product_id UUID NOT NULL REFERENCES public.pos_products(id) ON DELETE CASCADE,
  marketplace_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_direction TEXT NOT NULL DEFAULT 'pos_to_market',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_stock BOOLEAN NOT NULL DEFAULT true,
  sync_price BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, pos_product_id)
);
CREATE INDEX IF NOT EXISTS idx_pos_marketplace_sync_tenant ON public.pos_marketplace_sync(tenant_id);

CREATE TRIGGER update_pos_marketplace_sync_updated_at
  BEFORE UPDATE ON public.pos_marketplace_sync
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  items_processed INTEGER DEFAULT 0,
  items_success INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.pos_marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  outlet_id UUID,
  marketplace_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  pos_sale_id UUID,
  order_number TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'marketplace',
  status TEXT NOT NULL DEFAULT 'pending',
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_marketplace_orders_tenant ON public.pos_marketplace_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_marketplace_orders_status ON public.pos_marketplace_orders(tenant_id, status);

CREATE TABLE IF NOT EXISTS public.pos_integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  auto_import_orders BOOLEAN NOT NULL DEFAULT false,
  auto_sync_stock BOOLEAN NOT NULL DEFAULT false,
  auto_sync_price BOOLEAN NOT NULL DEFAULT false,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
  webhook_secret TEXT,
  api_key TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_pos_integration_settings_updated_at
  BEFORE UPDATE ON public.pos_integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- HELPER FUNCTIONS (non-RLS, server-side use)
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_merchant_quota(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  SELECT * INTO v_subscription
  FROM merchant_subscriptions
  WHERE merchant_id = p_merchant_id
    AND status = 'ACTIVE'
    AND expired_at > now()
    AND used_quota < transaction_quota
  ORDER BY expired_at DESC
  LIMIT 1;

  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'can_transact', false,
      'reason', 'Tidak ada kuota transaksi aktif. Silakan beli paket terlebih dahulu.',
      'remaining_quota', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'can_transact', true,
    'remaining_quota', v_subscription.transaction_quota - v_subscription.used_quota,
    'subscription_id', v_subscription.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.use_merchant_quota(p_merchant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE merchant_subscriptions
  SET used_quota = used_quota + 1, updated_at = now()
  WHERE merchant_id = p_merchant_id
    AND status = 'ACTIVE'
    AND expired_at > now()
    AND used_quota < transaction_quota;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_merchant_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_merchant_id uuid;
  new_avg numeric;
  new_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_merchant_id := OLD.merchant_id;
  ELSE
    target_merchant_id := NEW.merchant_id;
  END IF;

  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO new_avg, new_count
  FROM public.reviews
  WHERE merchant_id = target_merchant_id;

  UPDATE public.merchants
  SET rating_avg = ROUND(new_avg::numeric, 1),
      rating_count = new_count,
      updated_at = now()
  WHERE id = target_merchant_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_merchant_rating ON public.reviews;
CREATE TRIGGER trigger_update_merchant_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_merchant_rating();

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO public.villages (id, name, district, regency, description, is_active, registration_status, location_lat, location_lng) VALUES
('11111111-1111-1111-1111-111111111111','Desa Bojong','Megamendung','Bogor','Desa wisata dengan pemandangan sawah terasering yang memukau dan udara sejuk pegunungan.',true,'APPROVED',-7.3274,108.2207),
('22222222-2222-2222-2222-222222222222','Desa Sukamaju','Cisarua','Sukabumi','Desa dengan kebun teh yang indah dan arsitektur tradisional Sunda yang masih terjaga.',true,'APPROVED',-7.3350,108.2150)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.merchants (id, village_id, name, address, phone, open_time, close_time, classification_price, status, registration_status, order_mode, rating_avg, rating_count, badge, is_open) VALUES
('aaaa1111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Warung Bu Siti','Jl. Sawah Indah No. 5','081234567890','08:00','17:00','UNDER_5K','ACTIVE','APPROVED','ADMIN_ASSISTED',4.8,124,'VERIFIED',true),
('aaaa2222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Kopi Desa','Jl. Perkebunan No. 12','081234567891','07:00','20:00','FROM_10K_TO_20K','ACTIVE','APPROVED','SELF',4.9,89,'POPULAR',true),
('aaaa3333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','Kerajinan Mandiri','Kampung Kriya Rt 03/02','081234567892','09:00','16:00','ABOVE_20K','ACTIVE','APPROVED','ADMIN_ASSISTED',4.7,56,'VERIFIED',true),
('aaaa4444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','Dapur Emak','Jl. Kuliner Desa No. 8','081234567893','06:00','18:00','FROM_5K_TO_10K','ACTIVE','APPROVED','ADMIN_ASSISTED',4.6,203,NULL,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (id, merchant_id, name, description, price, stock, category, is_active, is_promo) VALUES
('bbbb1111-1111-1111-1111-111111111111','aaaa1111-1111-1111-1111-111111111111','Keripik Pisang Manis','Keripik pisang renyah dengan rasa manis gurih khas desa.',15000,50,'kuliner',true,true),
('bbbb2222-2222-2222-2222-222222222222','aaaa2222-2222-2222-2222-222222222222','Kopi Bubuk Robusta','Kopi robusta pilihan dari kebun kopi desa.',35000,30,'kuliner',true,false),
('bbbb3333-3333-3333-3333-333333333333','aaaa3333-3333-3333-3333-333333333333','Tas Anyaman Bambu','Tas anyaman bambu buatan tangan.',75000,15,'kriya',true,false),
('bbbb4444-4444-4444-4444-444444444444','aaaa4444-4444-4444-4444-444444444444','Sambal Bawang Botol','Sambal bawang pedas gurih dalam kemasan botol.',20000,100,'kuliner',true,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tourism (id, village_id, name, description, wa_link, facilities, is_active, view_count) VALUES
('cccc1111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Kampung Awan & Sawah','Menawarkan pengalaman otentik hidup di desa dengan pemandangan sawah terasering.','https://wa.me/6281234567890',ARRAY['Area Parkir Luas','Toilet Bersih','Spot Foto','Warung Makan','Mushola','Penginapan'],true,1523),
('cccc2222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','Kebun Teh Panorama','Hamparan kebun teh yang hijau dengan pemandangan pegunungan.','https://wa.me/6281234567891',ARRAY['Parkir','Toilet','Warung','Spot Foto'],true,892)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.promotions (type, title, subtitle, link_url, link_type, advertiser_type, is_approved, is_active, sort_order) VALUES
('banner','Jelajahi Produk Asli Desa','Dukung UMKM lokal & ekonomi desa Indonesia','/products','category','admin',true,true,1),
('banner','Wisata Desa Bojong','Nikmati keindahan alam dan budaya desa','/tourism','category','admin',true,true,2),
('banner','Promo Spesial Akhir Bulan','Diskon hingga 30% untuk produk pilihan','/products','category','admin',true,true,3)
ON CONFLICT DO NOTHING;

INSERT INTO public.app_settings (key, value, description, category) VALUES
('registration_village','{"enabled":true}','Enable/disable village registration','registration'),
('registration_merchant','{"enabled":true}','Enable/disable merchant registration','registration'),
('registration_courier','{"enabled":true}','Enable/disable courier registration','registration'),
('address_api','{"provider":"emsifa","base_url":"https://emsifa.github.io/api-wilayah-indonesia/api"}','Address API configuration','integration'),
('payment_midtrans','{"enabled":false,"server_key":"","client_key":"","is_production":false}','Midtrans payment gateway','payment'),
('payment_xendit','{"enabled":false,"secret_key":"","public_key":""}','Xendit payment gateway','payment'),
('shipping_base_fee','{"base_fee":5000,"per_km_fee":2000,"min_fee":5000,"max_fee":50000,"free_shipping_min_order":100000}','Pengaturan biaya kirim dasar','shipping'),
('platform_fee','{"percentage":5,"min_fee":1000,"max_fee":50000,"enabled":true}','Pengaturan biaya platform/komisi','platform'),
('cod_settings','{"enabled":true,"max_amount":75000,"max_distance_km":3,"service_fee":1000,"min_trust_score":50,"confirmation_timeout_minutes":15,"penalty_points":50,"success_bonus_points":1}','Pengaturan fitur COD','payment'),
('ride_fare_settings','{"base_fare":5000,"per_km_fare":3000,"min_fare":5000,"max_fare":100000}','Pengaturan tarif ojek desa','ride'),
('homepage_layout','{"sections":[{"id":"hero","name":"Hero Banner","enabled":true,"order":0},{"id":"categories","name":"Kategori","enabled":true,"order":1},{"id":"popular_tourism","name":"Wisata Populer","enabled":true,"order":2},{"id":"promo","name":"Promo Spesial","enabled":true,"order":3},{"id":"recommendations","name":"Rekomendasi Pilihan","enabled":true,"order":4},{"id":"villages","name":"Jelajahi Desa","enabled":true,"order":5}],"visible_categories":["kuliner","fashion","kriya","wisata"]}','Pengaturan tampilan homepage','display'),
('merchant_auto_approve','{"enabled":false}','Auto-approve merchant registrations','registration')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.transaction_packages (name, classification_price, price_per_transaction, group_commission_percent, transaction_quota, total_credits, validity_days, description) VALUES
('Paket UMKM Mikro','UNDER_5K',500,5,50,50,30,'Untuk produk harga dibawah Rp 5.000'),
('Paket UMKM Kecil','FROM_5K_TO_10K',750,5,75,75,30,'Untuk produk harga Rp 5.000 - 10.000'),
('Paket UMKM Menengah','FROM_10K_TO_20K',1000,5,100,100,30,'Untuk produk harga Rp 10.000 - 20.000'),
('Paket UMKM Premium','ABOVE_20K',1500,5,150,150,30,'Untuk produk harga diatas Rp 20.000')
ON CONFLICT DO NOTHING;

INSERT INTO public.quota_tiers (min_price, max_price, credit_cost, description, sort_order) VALUES
(0,3000,1,'Produk harga rendah (Rp 0 - Rp 3.000)',1),
(3001,5000,2,'Produk harga menengah bawah (Rp 3.001 - Rp 5.000)',2),
(5001,8000,3,'Produk harga menengah (Rp 5.001 - Rp 8.000)',3),
(8001,15000,4,'Produk harga menengah atas (Rp 8.001 - Rp 15.000)',4),
(15001,NULL,5,'Produk harga tinggi (Rp 15.001+)',5)
ON CONFLICT DO NOTHING;

INSERT INTO public.verifikator_codes (verifikator_id, code, trade_group, description) VALUES
('00000000-0000-0000-0000-000000000000','KULINER2024','Kelompok Kuliner Desa','Kode referral untuk pedagang kuliner'),
('00000000-0000-0000-0000-000000000000','KRIYA2024','Kelompok Kerajinan Tangan','Kode referral untuk pengrajin'),
('00000000-0000-0000-0000-000000000000','FASHION2024','Kelompok Fashion Lokal','Kode referral untuk pedagang fashion')
ON CONFLICT (code) DO NOTHING;
