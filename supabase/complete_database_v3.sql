-- =====================================================
-- DESA DIGITAL - COMPLETE DATABASE SCHEMA
-- Version: 3.0 - Full Features with Complete Dummy Data
-- Generated: 2026-02-06
-- =====================================================

-- =====================================================
-- PART 1: EXTENSIONS & CUSTOM TYPES
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom enum type for roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'buyer', 'verifikator', 'merchant', 'courier', 'admin_desa');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- PART 2: CORE TABLES
-- =====================================================

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'buyer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  address text,
  address_detail text,
  village text,
  province_id text,
  province_name text,
  city_id text,
  city_name text,
  district_id text,
  district_name text,
  village_id text,
  village_name text,
  avatar_url text,
  is_blocked boolean DEFAULT false,
  block_reason text,
  blocked_by uuid,
  blocked_at timestamptz,
  is_verified_buyer boolean DEFAULT false,
  cod_enabled boolean DEFAULT true,
  cod_fail_count integer DEFAULT 0,
  trust_score integer DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Villages (Desa)
CREATE TABLE IF NOT EXISTS public.villages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  district text,
  regency text,
  subdistrict text,
  description text,
  image_url text,
  is_active boolean DEFAULT true,
  registration_status text DEFAULT 'PENDING',
  registered_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  contact_name text,
  contact_phone text,
  contact_email text,
  location_lat numeric,
  location_lng numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trade Groups (Kelompok Dagang)
CREATE TABLE IF NOT EXISTS public.trade_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  village_id uuid REFERENCES public.villages(id),
  verifikator_id uuid,
  description text,
  kas_amount integer DEFAULT 10000,
  monthly_fee integer DEFAULT 10000,
  total_kas_collected integer DEFAULT 0,
  member_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Transaction Packages
CREATE TABLE IF NOT EXISTS public.transaction_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  classification_price text DEFAULT 'medium',
  price_per_transaction integer NOT NULL DEFAULT 0,
  group_commission_percent numeric DEFAULT 10,
  transaction_quota integer NOT NULL DEFAULT 0,
  validity_days integer DEFAULT 30,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Merchants (Pedagang)
CREATE TABLE IF NOT EXISTS public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  village_id uuid REFERENCES public.villages(id),
  group_id uuid REFERENCES public.trade_groups(id),
  current_subscription_id uuid,
  verifikator_id uuid,
  name text NOT NULL,
  phone text,
  address text,
  province text,
  city text,
  district text,
  subdistrict text,
  image_url text,
  business_category text DEFAULT 'kuliner',
  business_description text,
  classification_price text,
  trade_group text,
  verifikator_code text,
  open_time time,
  close_time time,
  is_open boolean DEFAULT true,
  status text DEFAULT 'ACTIVE',
  registration_status text DEFAULT 'PENDING',
  registered_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  order_mode text DEFAULT 'ADMIN_ASSISTED',
  badge text,
  rating_avg numeric DEFAULT 0,
  rating_count integer DEFAULT 0,
  is_verified boolean DEFAULT false,
  verified_at timestamptz,
  verified_by uuid,
  location_lat numeric,
  location_lng numeric,
  available_balance integer DEFAULT 0,
  pending_balance integer DEFAULT 0,
  total_withdrawn integer DEFAULT 0,
  cod_max_amount integer DEFAULT 75000,
  cod_max_distance_km numeric DEFAULT 3,
  payment_cod_enabled boolean DEFAULT true,
  payment_transfer_enabled boolean DEFAULT true,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Merchant Subscriptions
CREATE TABLE IF NOT EXISTS public.merchant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  package_id uuid NOT NULL REFERENCES public.transaction_packages(id),
  transaction_quota integer NOT NULL DEFAULT 0,
  used_quota integer NOT NULL DEFAULT 0,
  payment_amount integer NOT NULL DEFAULT 0,
  payment_status text DEFAULT 'UNPAID',
  paid_at timestamptz,
  status text DEFAULT 'ACTIVE',
  started_at timestamptz DEFAULT now(),
  expired_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK after merchant_subscriptions exists
ALTER TABLE public.merchants 
  DROP CONSTRAINT IF EXISTS merchants_current_subscription_id_fkey;
ALTER TABLE public.merchants 
  ADD CONSTRAINT merchants_current_subscription_id_fkey 
  FOREIGN KEY (current_subscription_id) REFERENCES public.merchant_subscriptions(id);

-- Group Members
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.trade_groups(id),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  status text DEFAULT 'ACTIVE',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, merchant_id)
);

-- Kas Payments
CREATE TABLE IF NOT EXISTS public.kas_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.trade_groups(id),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  amount integer NOT NULL,
  payment_month integer NOT NULL,
  payment_year integer NOT NULL,
  status text DEFAULT 'UNPAID',
  payment_date timestamptz,
  collected_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, merchant_id, payment_month, payment_year)
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  name text NOT NULL,
  description text,
  price integer NOT NULL,
  stock integer DEFAULT 0,
  image_url text,
  category text NOT NULL,
  is_active boolean DEFAULT true,
  is_promo boolean DEFAULT false,
  discount_percent integer DEFAULT 0,
  discount_end_date timestamptz,
  min_stock_alert integer DEFAULT 5,
  view_count integer DEFAULT 0,
  order_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Product Images
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_primary boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Product Variants
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  price_adjustment integer DEFAULT 0,
  stock integer DEFAULT 0,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Quota Tiers (Dynamic Credit System)
CREATE TABLE IF NOT EXISTS public.quota_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_price integer NOT NULL DEFAULT 0,
  max_price integer,
  credit_cost integer NOT NULL DEFAULT 1,
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tourism (Wisata)
CREATE TABLE IF NOT EXISTS public.tourism (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id uuid REFERENCES public.villages(id),
  name text NOT NULL,
  description text,
  image_url text,
  location_lat numeric,
  location_lng numeric,
  wa_link text,
  sosmed_link text,
  facilities text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  view_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Couriers
CREATE TABLE IF NOT EXISTS public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  village_id uuid REFERENCES public.villages(id),
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
  vehicle_type text DEFAULT 'motor',
  vehicle_plate text,
  vehicle_image_url text NOT NULL,
  registration_status text DEFAULT 'PENDING',
  status text DEFAULT 'INACTIVE',
  is_available boolean DEFAULT false,
  current_lat numeric,
  current_lng numeric,
  last_location_update timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  registered_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  merchant_id uuid REFERENCES public.merchants(id),
  courier_id uuid REFERENCES public.couriers(id),
  status text DEFAULT 'NEW',
  handled_by text DEFAULT 'ADMIN',
  delivery_type text DEFAULT 'PICKUP',
  delivery_name text,
  delivery_phone text,
  delivery_address text,
  delivery_lat numeric,
  delivery_lng numeric,
  buyer_distance_km numeric,
  subtotal integer DEFAULT 0,
  shipping_cost integer DEFAULT 0,
  flash_sale_discount integer DEFAULT 0,
  cod_service_fee integer DEFAULT 0,
  total integer DEFAULT 0,
  notes text,
  payment_method text,
  payment_channel text,
  payment_status text DEFAULT 'UNPAID',
  payment_invoice_id text,
  payment_invoice_url text,
  payment_paid_at timestamptz,
  is_flash_sale boolean DEFAULT false,
  rejection_reason text,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  confirmed_at timestamptz,
  confirmation_deadline timestamptz,
  pod_image_url text,
  pod_notes text,
  pod_uploaded_at timestamptz,
  cod_confirmed_at timestamptz,
  cod_rejected_at timestamptz,
  cod_rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Allow all possible order statuses
  CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY[
    'NEW'::text, 
    'PENDING_CONFIRMATION'::text,
    'PENDING_PAYMENT'::text,
    'PROCESSED'::text, 
    'READY'::text,
    'ASSIGNED'::text,
    'PICKED_UP'::text,
    'SENT'::text, 
    'DONE'::text, 
    'CANCELED'::text,
    'REJECTED'::text,
    'REJECTED_BY_BUYER'::text,
    'REFUNDED'::text
  ]))
);

-- Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  product_price integer NOT NULL,
  quantity integer NOT NULL,
  subtotal integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Flash Sales
CREATE TABLE IF NOT EXISTS public.flash_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  original_price integer NOT NULL,
  flash_price integer NOT NULL,
  stock_available integer DEFAULT 1,
  stock_sold integer DEFAULT 0,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz NOT NULL,
  status text DEFAULT 'ACTIVE',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  buyer_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  images text[] DEFAULT '{}',
  is_visible boolean DEFAULT true,
  merchant_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Refund Requests
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  buyer_id uuid NOT NULL,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  amount integer NOT NULL,
  reason text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  status text DEFAULT 'PENDING',
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Withdrawal Requests (Merchant)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  amount integer NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  status text DEFAULT 'PENDING',
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Verifikator Earnings
CREATE TABLE IF NOT EXISTS public.verifikator_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verifikator_id uuid NOT NULL,
  merchant_id uuid REFERENCES public.merchants(id),
  subscription_id uuid REFERENCES public.merchant_subscriptions(id),
  package_id uuid REFERENCES public.transaction_packages(id),
  package_amount integer DEFAULT 0,
  commission_percent numeric DEFAULT 0,
  commission_amount integer DEFAULT 0,
  status text DEFAULT 'PENDING',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Verifikator Withdrawals
CREATE TABLE IF NOT EXISTS public.verifikator_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verifikator_id uuid NOT NULL,
  amount integer NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  status text DEFAULT 'PENDING',
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Verifikator Codes
CREATE TABLE IF NOT EXISTS public.verifikator_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verifikator_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  max_usage integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Courier Earnings
CREATE TABLE IF NOT EXISTS public.courier_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id),
  order_id uuid REFERENCES public.orders(id),
  amount integer DEFAULT 0,
  type text DEFAULT 'DELIVERY',
  status text DEFAULT 'PENDING',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Platform Fees
CREATE TABLE IF NOT EXISTS public.platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id),
  merchant_id uuid REFERENCES public.merchants(id),
  order_total integer DEFAULT 0,
  shipping_cost integer DEFAULT 0,
  platform_fee integer DEFAULT 0,
  platform_fee_percent numeric DEFAULT 0,
  courier_fee integer DEFAULT 0,
  merchant_revenue integer DEFAULT 0,
  fee_type text DEFAULT 'ORDER',
  status text DEFAULT 'PENDING',
  collected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insurance Fund
CREATE TABLE IF NOT EXISTS public.insurance_fund (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  order_id uuid REFERENCES public.orders(id),
  type text NOT NULL,
  amount integer NOT NULL,
  claim_reason text,
  evidence_urls text[] DEFAULT '{}',
  status text DEFAULT 'PENDING',
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Vouchers
CREATE TABLE IF NOT EXISTS public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES public.merchants(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  discount_type text DEFAULT 'percentage',
  discount_value integer NOT NULL,
  min_order_amount integer DEFAULT 0,
  max_discount integer,
  usage_limit integer,
  used_count integer DEFAULT 0,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Voucher Usages
CREATE TABLE IF NOT EXISTS public.voucher_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id),
  discount_amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(voucher_id, user_id)
);

-- Promotions/Banners
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text,
  type text NOT NULL,
  link_type text,
  link_url text,
  link_id uuid,
  advertiser_type text,
  advertiser_id uuid,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  is_active boolean DEFAULT true,
  is_approved boolean DEFAULT false,
  is_paid boolean DEFAULT false,
  price integer DEFAULT 0,
  sort_order integer DEFAULT 0,
  view_count integer DEFAULT 0,
  click_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  link text,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Broadcast Notifications
CREATE TABLE IF NOT EXISTS public.broadcast_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  target_audience text DEFAULT 'ALL',
  target_roles text[] DEFAULT '{}',
  status text DEFAULT 'DRAFT',
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_count integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Push Subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Saved Addresses
CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  recipient_name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  province_id text,
  province_name text,
  city_id text,
  city_name text,
  district_id text,
  district_name text,
  village_id text,
  village_name text,
  postal_code text,
  location_lat numeric,
  location_lng numeric,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Wishlists
CREATE TABLE IF NOT EXISTS public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- App Settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  category text DEFAULT 'general',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Admin Audit Logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Backup Logs
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text DEFAULT 'manual',
  status text DEFAULT 'pending',
  file_url text,
  file_size integer,
  tables_included text[],
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_by uuid
);

-- Backup Schedules
CREATE TABLE IF NOT EXISTS public.backup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  schedule_type text DEFAULT 'daily',
  schedule_time time DEFAULT '02:00:00',
  schedule_day integer,
  tables_included text[] DEFAULT ARRAY['merchants', 'products', 'orders', 'villages', 'tourism', 'couriers'],
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Rate Limits
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action text NOT NULL,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(identifier, action, window_start)
);

-- =====================================================
-- PART 3: HELPER FUNCTIONS (SECURITY DEFINER)
-- =====================================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  );
$$;

-- Check if user is verifikator
CREATE OR REPLACE FUNCTION public.is_verifikator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'verifikator'::app_role
  );
$$;

-- Check if user is admin desa
CREATE OR REPLACE FUNCTION public.is_admin_desa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin_desa'::app_role
  );
$$;

-- Check if user is merchant
CREATE OR REPLACE FUNCTION public.is_merchant()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'merchant'::app_role
  );
$$;

-- Check if user is courier
CREATE OR REPLACE FUNCTION public.is_courier()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'courier'::app_role
  );
$$;

-- Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(user_uuid uuid, check_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid AND role = check_role
  );
$$;

-- Check if user has any of the given roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;

-- Get user roles as text array
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role::text), ARRAY[]::text[])
  FROM public.user_roles
  WHERE user_id = _user_id;
$$;

-- Get user's merchant ID
CREATE OR REPLACE FUNCTION public.get_user_merchant_id(_user_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.merchants 
  WHERE user_id = COALESCE(_user_id, auth.uid()) 
  LIMIT 1;
$$;

-- Get user's courier ID
CREATE OR REPLACE FUNCTION public.get_user_courier_id(_user_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.couriers 
  WHERE user_id = COALESCE(_user_id, auth.uid()) 
  LIMIT 1;
$$;

-- Check if user is order merchant (by order_id)
CREATE OR REPLACE FUNCTION public.is_order_merchant(check_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.merchants m ON o.merchant_id = m.id
    WHERE o.id = check_order_id AND m.user_id = auth.uid()
  );
$$;

-- Check if user is courier owner
CREATE OR REPLACE FUNCTION public.is_courier_owner(check_user_id uuid, check_courier_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.couriers
    WHERE id = check_courier_id AND user_id = check_user_id
  );
$$;

-- Check if user is order courier
CREATE OR REPLACE FUNCTION public.is_order_courier(check_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.couriers c ON o.courier_id = c.id
    WHERE o.id = check_order_id AND c.user_id = auth.uid()
  );
$$;

-- Get quota cost based on price tier
CREATE OR REPLACE FUNCTION public.get_quota_cost(product_price integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT credit_cost FROM public.quota_tiers 
     WHERE is_active = true 
     AND product_price >= min_price 
     AND (max_price IS NULL OR product_price <= max_price)
     ORDER BY min_price DESC
     LIMIT 1),
    1
  );
$$;

-- Use merchant quota credits
CREATE OR REPLACE FUNCTION public.use_merchant_quota(p_merchant_id uuid, p_credits integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id uuid;
  v_remaining integer;
BEGIN
  -- Get active subscription
  SELECT id, (transaction_quota - used_quota) INTO v_subscription_id, v_remaining
  FROM public.merchant_subscriptions
  WHERE merchant_id = p_merchant_id
    AND status = 'ACTIVE'
    AND expired_at > now()
  ORDER BY expired_at DESC
  LIMIT 1;
  
  IF v_subscription_id IS NULL THEN
    RETURN false;
  END IF;
  
  IF v_remaining < p_credits THEN
    RETURN false;
  END IF;
  
  -- Deduct credits
  UPDATE public.merchant_subscriptions
  SET used_quota = used_quota + p_credits,
      updated_at = now()
  WHERE id = v_subscription_id;
  
  RETURN true;
END;
$$;

-- Check merchant quota
CREATE OR REPLACE FUNCTION public.check_merchant_quota(p_merchant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Send notification
CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id uuid, 
  p_title text, 
  p_message text, 
  p_type text DEFAULT 'info', 
  p_link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_user_id, p_title, p_message, p_type, p_link)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Apply voucher
CREATE OR REPLACE FUNCTION public.apply_voucher(
  p_code text, 
  p_user_id uuid, 
  p_order_total integer, 
  p_merchant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher RECORD;
  v_usage_count INTEGER;
  v_discount INTEGER;
BEGIN
  SELECT * INTO v_voucher
  FROM vouchers
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true
    AND start_date <= now()
    AND (end_date IS NULL OR end_date >= now());
  
  IF v_voucher IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode voucher tidak ditemukan atau sudah kadaluarsa');
  END IF;
  
  IF v_voucher.merchant_id IS NOT NULL AND v_voucher.merchant_id != p_merchant_id THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Voucher tidak berlaku untuk toko ini');
  END IF;
  
  IF p_order_total < v_voucher.min_order_amount THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Minimum belanja Rp ' || v_voucher.min_order_amount);
  END IF;
  
  IF v_voucher.usage_limit IS NOT NULL AND v_voucher.used_count >= v_voucher.usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Voucher sudah habis');
  END IF;
  
  SELECT COUNT(*) INTO v_usage_count
  FROM voucher_usages
  WHERE voucher_id = v_voucher.id AND user_id = p_user_id;
  
  IF v_usage_count > 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Anda sudah menggunakan voucher ini');
  END IF;
  
  IF v_voucher.discount_type = 'percentage' THEN
    v_discount := FLOOR(p_order_total * v_voucher.discount_value / 100);
    IF v_voucher.max_discount IS NOT NULL AND v_discount > v_voucher.max_discount THEN
      v_discount := v_voucher.max_discount;
    END IF;
  ELSE
    v_discount := v_voucher.discount_value;
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'voucher_id', v_voucher.id,
    'discount', v_discount,
    'voucher_name', v_voucher.name
  );
END;
$$;

-- Check COD eligibility
CREATE OR REPLACE FUNCTION public.check_cod_eligibility(
  p_buyer_id uuid, 
  p_merchant_id uuid, 
  p_total_amount integer, 
  p_distance_km numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cod_settings JSONB;
  v_max_amount INTEGER;
  v_max_distance NUMERIC;
  v_min_trust_score INTEGER;
  v_buyer_trust_score INTEGER;
  v_buyer_cod_enabled BOOLEAN;
  v_merchant_cod_max_amount INTEGER;
  v_merchant_cod_max_distance NUMERIC;
BEGIN
  SELECT value INTO v_cod_settings FROM app_settings WHERE key = 'cod_settings';
  
  v_max_amount := COALESCE((v_cod_settings->>'max_amount')::INTEGER, 75000);
  v_max_distance := COALESCE((v_cod_settings->>'max_distance_km')::NUMERIC, 3);
  v_min_trust_score := COALESCE((v_cod_settings->>'min_trust_score')::INTEGER, 50);
  
  SELECT trust_score, cod_enabled INTO v_buyer_trust_score, v_buyer_cod_enabled
  FROM profiles WHERE user_id = p_buyer_id;
  
  IF v_buyer_cod_enabled = false THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Akun Anda tidak dapat menggunakan COD');
  END IF;
  
  IF COALESCE(v_buyer_trust_score, 100) < v_min_trust_score THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Trust score tidak mencukupi untuk COD');
  END IF;
  
  SELECT cod_max_amount, cod_max_distance_km INTO v_merchant_cod_max_amount, v_merchant_cod_max_distance
  FROM merchants WHERE id = p_merchant_id;
  
  v_max_amount := LEAST(v_max_amount, COALESCE(v_merchant_cod_max_amount, v_max_amount));
  v_max_distance := LEAST(v_max_distance, COALESCE(v_merchant_cod_max_distance, v_max_distance));
  
  IF p_total_amount > v_max_amount THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 
      format('Nominal terlalu besar untuk COD. Maks: Rp %s', to_char(v_max_amount, 'FM999,999,999')));
  END IF;
  
  IF p_distance_km IS NOT NULL AND p_distance_km > v_max_distance THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 
      format('Jarak terlalu jauh untuk COD. Maks: %s KM', v_max_distance));
  END IF;
  
  RETURN jsonb_build_object('eligible', true, 'reason', NULL);
END;
$$;

-- Check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text, 
  p_action text, 
  p_max_requests integer DEFAULT 10, 
  p_window_seconds integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_current_count INTEGER;
BEGIN
  v_window_start := date_trunc('minute', now());
  
  SELECT count INTO v_current_count
  FROM rate_limits
  WHERE identifier = p_identifier 
    AND action = p_action 
    AND window_start = v_window_start;
  
  IF v_current_count IS NULL THEN
    INSERT INTO rate_limits (identifier, action, count, window_start)
    VALUES (p_identifier, p_action, 1, v_window_start)
    ON CONFLICT (identifier, action, window_start) DO UPDATE SET count = rate_limits.count + 1;
    
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1);
  END IF;
  
  IF v_current_count >= p_max_requests THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after', p_window_seconds);
  END IF;
  
  UPDATE rate_limits
  SET count = count + 1
  WHERE identifier = p_identifier 
    AND action = p_action 
    AND window_start = v_window_start;
  
  RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - v_current_count - 1);
END;
$$;

-- Update COD trust score
CREATE OR REPLACE FUNCTION public.update_cod_trust_score(p_buyer_id uuid, p_success boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cod_settings JSONB;
  v_penalty_points INTEGER;
  v_bonus_points INTEGER;
  v_min_trust_score INTEGER;
  v_current_score INTEGER;
  v_current_fail_count INTEGER;
  v_new_score INTEGER;
BEGIN
  SELECT value INTO v_cod_settings FROM app_settings WHERE key = 'cod_settings';
  
  v_penalty_points := COALESCE((v_cod_settings->>'penalty_points')::INTEGER, 50);
  v_bonus_points := COALESCE((v_cod_settings->>'success_bonus_points')::INTEGER, 1);
  v_min_trust_score := COALESCE((v_cod_settings->>'min_trust_score')::INTEGER, 50);
  
  SELECT trust_score, cod_fail_count INTO v_current_score, v_current_fail_count
  FROM profiles WHERE user_id = p_buyer_id;
  
  v_current_score := COALESCE(v_current_score, 100);
  v_current_fail_count := COALESCE(v_current_fail_count, 0);
  
  IF p_success THEN
    v_new_score := LEAST(100, v_current_score + v_bonus_points);
    UPDATE profiles SET trust_score = v_new_score WHERE user_id = p_buyer_id;
  ELSE
    v_new_score := GREATEST(0, v_current_score - v_penalty_points);
    UPDATE profiles 
    SET 
      trust_score = v_new_score,
      cod_fail_count = v_current_fail_count + 1,
      cod_enabled = CASE WHEN v_new_score < v_min_trust_score THEN false ELSE cod_enabled END
    WHERE user_id = p_buyer_id;
  END IF;
END;
$$;

-- Auto-update timestamps trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer');
  
  RETURN NEW;
END;
$$;

-- Generate monthly kas payments
CREATE OR REPLACE FUNCTION public.generate_monthly_kas(p_group_id uuid, p_month integer, p_year integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group RECORD;
  v_member RECORD;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_group FROM trade_groups WHERE id = p_group_id;
  
  IF v_group IS NULL THEN
    RETURN 0;
  END IF;
  
  FOR v_member IN 
    SELECT * FROM group_members 
    WHERE group_id = p_group_id AND status = 'ACTIVE'
  LOOP
    INSERT INTO kas_payments (group_id, merchant_id, amount, payment_month, payment_year, status)
    VALUES (p_group_id, v_member.merchant_id, v_group.monthly_fee, p_month, p_year, 'UNPAID')
    ON CONFLICT (group_id, merchant_id, payment_month, payment_year) DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Auto cancel pending COD orders
CREATE OR REPLACE FUNCTION public.auto_cancel_pending_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE orders
  SET 
    status = 'CANCELED',
    notes = COALESCE(notes, '') || ' [Auto-canceled: Tidak dikonfirmasi dalam 15 menit]',
    updated_at = now()
  WHERE 
    status = 'PENDING_CONFIRMATION'
    AND confirmation_deadline < now();
END;
$$;

-- =====================================================
-- PART 4: VIEWS
-- =====================================================

-- Public Merchants View (safe for public access)
DROP VIEW IF EXISTS public.public_merchants CASCADE;
CREATE OR REPLACE VIEW public.public_merchants AS
SELECT 
  id,
  village_id,
  name,
  image_url,
  business_category,
  business_description,
  province,
  city,
  district,
  open_time,
  close_time,
  is_open,
  order_mode,
  badge,
  rating_avg,
  rating_count,
  is_verified,
  location_lat,
  location_lng,
  CASE WHEN phone IS NOT NULL THEN CONCAT(LEFT(phone, 4), '****', RIGHT(phone, 3)) ELSE NULL END as phone_masked
FROM public.merchants
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

-- Public Couriers View (safe for public access)
DROP VIEW IF EXISTS public.public_couriers CASCADE;
CREATE OR REPLACE VIEW public.public_couriers AS
SELECT 
  id,
  name,
  photo_url,
  vehicle_type,
  village_id,
  is_available,
  status,
  current_lat,
  current_lng,
  CASE WHEN phone IS NOT NULL THEN CONCAT(LEFT(phone, 4), '****', RIGHT(phone, 3)) ELSE NULL END as phone_masked
FROM public.couriers
WHERE registration_status = 'APPROVED' AND status = 'ACTIVE';

-- =====================================================
-- PART 5: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kas_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (to avoid conflicts)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- USER_ROLES Policies
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL USING (is_admin());
CREATE POLICY "user_roles_own_read" ON public.user_roles FOR SELECT USING (user_id = auth.uid());

-- PROFILES Policies
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (is_admin());
CREATE POLICY "profiles_own_read" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "profiles_own_insert" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_own_update" ON public.profiles FOR UPDATE USING (user_id = auth.uid() AND is_blocked = false);

-- VILLAGES Policies
CREATE POLICY "villages_admin_all" ON public.villages FOR ALL USING (is_admin());
CREATE POLICY "villages_public_read" ON public.villages FOR SELECT USING (is_active = true AND registration_status = 'APPROVED');
CREATE POLICY "villages_own_manage" ON public.villages FOR ALL USING (user_id = auth.uid());
CREATE POLICY "villages_register" ON public.villages FOR INSERT WITH CHECK (registration_status = 'PENDING');

-- TRADE_GROUPS Policies
CREATE POLICY "trade_groups_admin_all" ON public.trade_groups FOR ALL USING (is_admin());
CREATE POLICY "trade_groups_verifikator_all" ON public.trade_groups FOR ALL USING (verifikator_id = auth.uid() OR is_verifikator());
CREATE POLICY "trade_groups_public_read" ON public.trade_groups FOR SELECT USING (is_active = true);

-- TRANSACTION_PACKAGES Policies
CREATE POLICY "transaction_packages_admin_all" ON public.transaction_packages FOR ALL USING (is_admin());
CREATE POLICY "transaction_packages_public_read" ON public.transaction_packages FOR SELECT USING (is_active = true);

-- MERCHANTS Policies
CREATE POLICY "merchants_admin_all" ON public.merchants FOR ALL USING (is_admin());
CREATE POLICY "merchants_verifikator_all" ON public.merchants FOR ALL USING (is_verifikator());
CREATE POLICY "merchants_own_manage" ON public.merchants FOR ALL USING (user_id = auth.uid());
CREATE POLICY "merchants_public_read" ON public.merchants FOR SELECT USING (status = 'ACTIVE' AND registration_status = 'APPROVED');
CREATE POLICY "merchants_register" ON public.merchants FOR INSERT WITH CHECK (registration_status = 'PENDING');

-- MERCHANT_SUBSCRIPTIONS Policies
CREATE POLICY "merchant_subscriptions_admin_all" ON public.merchant_subscriptions FOR ALL USING (is_admin());
CREATE POLICY "merchant_subscriptions_own_read" ON public.merchant_subscriptions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid()));
CREATE POLICY "merchant_subscriptions_own_insert" ON public.merchant_subscriptions FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid()));

-- GROUP_MEMBERS Policies
CREATE POLICY "group_members_admin_all" ON public.group_members FOR ALL USING (is_admin());
CREATE POLICY "group_members_verifikator_manage" ON public.group_members FOR ALL 
  USING (EXISTS (SELECT 1 FROM trade_groups WHERE id = group_id AND (verifikator_id = auth.uid() OR is_admin())));
CREATE POLICY "group_members_own_read" ON public.group_members FOR SELECT 
  USING (EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid()));

-- KAS_PAYMENTS Policies
CREATE POLICY "kas_payments_admin_all" ON public.kas_payments FOR ALL USING (is_admin());
CREATE POLICY "kas_payments_verifikator_manage" ON public.kas_payments FOR ALL 
  USING (EXISTS (SELECT 1 FROM trade_groups WHERE id = group_id AND (verifikator_id = auth.uid() OR is_admin())));
CREATE POLICY "kas_payments_own_read" ON public.kas_payments FOR SELECT 
  USING (EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid()));

-- CATEGORIES Policies
CREATE POLICY "categories_admin_all" ON public.categories FOR ALL USING (is_admin());
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (is_active = true);

-- PRODUCTS Policies
CREATE POLICY "products_admin_all" ON public.products FOR ALL USING (is_admin());
CREATE POLICY "products_merchant_manage" ON public.products FOR ALL 
  USING (EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid()));
CREATE POLICY "products_public_read" ON public.products FOR SELECT USING (is_active = true);

-- PRODUCT_IMAGES Policies
CREATE POLICY "product_images_admin_all" ON public.product_images FOR ALL USING (is_admin());
CREATE POLICY "product_images_merchant_manage" ON public.product_images FOR ALL 
  USING (EXISTS (SELECT 1 FROM products p JOIN merchants m ON p.merchant_id = m.id WHERE p.id = product_id AND m.user_id = auth.uid()));
CREATE POLICY "product_images_public_read" ON public.product_images FOR SELECT USING (true);

-- PRODUCT_VARIANTS Policies
CREATE POLICY "product_variants_admin_all" ON public.product_variants FOR ALL USING (is_admin());
CREATE POLICY "product_variants_merchant_manage" ON public.product_variants FOR ALL 
  USING (EXISTS (SELECT 1 FROM products p JOIN merchants m ON p.merchant_id = m.id WHERE p.id = product_id AND m.user_id = auth.uid()));
CREATE POLICY "product_variants_public_read" ON public.product_variants FOR SELECT USING (is_active = true);

-- QUOTA_TIERS Policies
CREATE POLICY "quota_tiers_admin_all" ON public.quota_tiers FOR ALL USING (is_admin());
CREATE POLICY "quota_tiers_public_read" ON public.quota_tiers FOR SELECT USING (true);

-- TOURISM Policies
CREATE POLICY "tourism_admin_all" ON public.tourism FOR ALL USING (is_admin());
CREATE POLICY "tourism_village_manage" ON public.tourism FOR ALL 
  USING (EXISTS (SELECT 1 FROM villages WHERE id = village_id AND user_id = auth.uid()));
CREATE POLICY "tourism_public_read" ON public.tourism FOR SELECT USING (is_active = true);

-- COURIERS Policies
CREATE POLICY "couriers_admin_all" ON public.couriers FOR ALL USING (is_admin());
CREATE POLICY "couriers_verifikator_all" ON public.couriers FOR ALL USING (is_verifikator());
CREATE POLICY "couriers_own_manage" ON public.couriers FOR ALL USING (user_id = auth.uid());
CREATE POLICY "couriers_public_read" ON public.couriers FOR SELECT USING (registration_status = 'APPROVED' AND status = 'ACTIVE');
CREATE POLICY "couriers_register" ON public.couriers FOR INSERT WITH CHECK (registration_status = 'PENDING' AND status = 'INACTIVE');

-- ORDERS Policies
CREATE POLICY "orders_admin_all" ON public.orders FOR ALL USING (is_admin());
CREATE POLICY "orders_buyer_manage" ON public.orders FOR ALL USING (buyer_id = auth.uid());
CREATE POLICY "orders_merchant_manage" ON public.orders FOR ALL USING (is_order_merchant(id));
CREATE POLICY "orders_courier_manage" ON public.orders FOR ALL USING (is_order_courier(id));

-- ORDER_ITEMS Policies
CREATE POLICY "order_items_admin_all" ON public.order_items FOR ALL USING (is_admin());
CREATE POLICY "order_items_buyer_insert" ON public.order_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE id = order_id AND buyer_id = auth.uid()));
CREATE POLICY "order_items_read" ON public.order_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM orders WHERE id = order_id AND (buyer_id = auth.uid() OR is_order_merchant(order_id) OR is_admin())));

-- FLASH_SALES Policies
CREATE POLICY "flash_sales_admin_all" ON public.flash_sales FOR ALL USING (is_admin());
CREATE POLICY "flash_sales_merchant_manage" ON public.flash_sales FOR ALL 
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));
CREATE POLICY "flash_sales_public_read" ON public.flash_sales FOR SELECT USING (status = 'ACTIVE' AND end_time > now());

-- REVIEWS Policies
CREATE POLICY "reviews_admin_all" ON public.reviews FOR ALL USING (is_admin());
CREATE POLICY "reviews_buyer_manage" ON public.reviews FOR ALL USING (buyer_id = auth.uid());
CREATE POLICY "reviews_merchant_reply" ON public.reviews FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid()));
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT USING (is_visible = true);

-- REFUND_REQUESTS Policies
CREATE POLICY "refund_requests_admin_all" ON public.refund_requests FOR ALL USING (is_admin());
CREATE POLICY "refund_requests_buyer_manage" ON public.refund_requests FOR ALL USING (buyer_id = auth.uid());
CREATE POLICY "refund_requests_merchant_read" ON public.refund_requests FOR SELECT 
  USING (EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid()));

-- WITHDRAWAL_REQUESTS Policies
CREATE POLICY "withdrawal_requests_admin_all" ON public.withdrawal_requests FOR ALL USING (is_admin());
CREATE POLICY "withdrawal_requests_merchant_manage" ON public.withdrawal_requests FOR ALL 
  USING (EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid()));

-- VERIFIKATOR_EARNINGS Policies
CREATE POLICY "verifikator_earnings_admin_all" ON public.verifikator_earnings FOR ALL USING (is_admin());
CREATE POLICY "verifikator_earnings_own_read" ON public.verifikator_earnings FOR SELECT USING (verifikator_id = auth.uid());

-- VERIFIKATOR_WITHDRAWALS Policies
CREATE POLICY "verifikator_withdrawals_admin_all" ON public.verifikator_withdrawals FOR ALL USING (is_admin());
CREATE POLICY "verifikator_withdrawals_own_manage" ON public.verifikator_withdrawals FOR ALL USING (verifikator_id = auth.uid());

-- VERIFIKATOR_CODES Policies
CREATE POLICY "verifikator_codes_admin_all" ON public.verifikator_codes FOR ALL USING (is_admin());
CREATE POLICY "verifikator_codes_own_manage" ON public.verifikator_codes FOR ALL USING (verifikator_id = auth.uid());
CREATE POLICY "verifikator_codes_public_read" ON public.verifikator_codes FOR SELECT USING (is_active = true);

-- COURIER_EARNINGS Policies
CREATE POLICY "courier_earnings_admin_all" ON public.courier_earnings FOR ALL USING (is_admin());
CREATE POLICY "courier_earnings_own_read" ON public.courier_earnings FOR SELECT 
  USING (EXISTS (SELECT 1 FROM couriers WHERE id = courier_id AND user_id = auth.uid()));

-- PLATFORM_FEES Policies
CREATE POLICY "platform_fees_admin_all" ON public.platform_fees FOR ALL USING (is_admin());
CREATE POLICY "platform_fees_merchant_read" ON public.platform_fees FOR SELECT 
  USING (EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid()));

-- INSURANCE_FUND Policies
CREATE POLICY "insurance_fund_admin_all" ON public.insurance_fund FOR ALL USING (is_admin());
CREATE POLICY "insurance_fund_merchant_manage" ON public.insurance_fund FOR ALL 
  USING (EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid()));

-- VOUCHERS Policies
CREATE POLICY "vouchers_admin_all" ON public.vouchers FOR ALL USING (is_admin());
CREATE POLICY "vouchers_merchant_manage" ON public.vouchers FOR ALL 
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));
CREATE POLICY "vouchers_public_read" ON public.vouchers FOR SELECT 
  USING (is_active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));

-- VOUCHER_USAGES Policies
CREATE POLICY "voucher_usages_admin_all" ON public.voucher_usages FOR ALL USING (is_admin());
CREATE POLICY "voucher_usages_own_manage" ON public.voucher_usages FOR ALL USING (user_id = auth.uid());

-- PROMOTIONS Policies
CREATE POLICY "promotions_admin_all" ON public.promotions FOR ALL USING (is_admin());
CREATE POLICY "promotions_public_read" ON public.promotions FOR SELECT 
  USING (is_active = true AND is_approved = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));

-- NOTIFICATIONS Policies
CREATE POLICY "notifications_admin_all" ON public.notifications FOR ALL USING (is_admin());
CREATE POLICY "notifications_own_manage" ON public.notifications FOR ALL USING (user_id = auth.uid());

-- BROADCAST_NOTIFICATIONS Policies
CREATE POLICY "broadcast_notifications_admin_all" ON public.broadcast_notifications FOR ALL USING (is_admin());

-- PUSH_SUBSCRIPTIONS Policies
CREATE POLICY "push_subscriptions_own_manage" ON public.push_subscriptions FOR ALL USING (user_id = auth.uid());

-- SAVED_ADDRESSES Policies
CREATE POLICY "saved_addresses_own_manage" ON public.saved_addresses FOR ALL USING (user_id = auth.uid());

-- WISHLISTS Policies
CREATE POLICY "wishlists_own_manage" ON public.wishlists FOR ALL USING (user_id = auth.uid());

-- APP_SETTINGS Policies
CREATE POLICY "app_settings_admin_all" ON public.app_settings FOR ALL USING (is_admin());
CREATE POLICY "app_settings_public_read" ON public.app_settings FOR SELECT USING (true);

-- ADMIN_AUDIT_LOGS Policies
CREATE POLICY "admin_audit_logs_admin_read" ON public.admin_audit_logs FOR SELECT USING (is_admin());
CREATE POLICY "admin_audit_logs_admin_insert" ON public.admin_audit_logs FOR INSERT WITH CHECK (is_admin());

-- BACKUP_LOGS Policies
CREATE POLICY "backup_logs_admin_read" ON public.backup_logs FOR SELECT USING (is_admin());
CREATE POLICY "backup_logs_admin_insert" ON public.backup_logs FOR INSERT WITH CHECK (is_admin());

-- BACKUP_SCHEDULES Policies
CREATE POLICY "backup_schedules_admin_all" ON public.backup_schedules FOR ALL USING (is_admin());

-- PASSWORD_RESET_TOKENS Policies
CREATE POLICY "password_reset_tokens_insert" ON public.password_reset_tokens FOR INSERT 
  WITH CHECK (email IS NOT NULL AND token IS NOT NULL AND expires_at > now());
CREATE POLICY "password_reset_tokens_read" ON public.password_reset_tokens FOR SELECT USING (true);
CREATE POLICY "password_reset_tokens_update" ON public.password_reset_tokens FOR UPDATE USING (used_at IS NULL AND expires_at > now());

-- RATE_LIMITS Policies
CREATE POLICY "rate_limits_all" ON public.rate_limits FOR ALL USING (true);

-- =====================================================
-- PART 6: TRIGGERS
-- =====================================================

-- Auto-update timestamps
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_villages_updated_at ON public.villages;
CREATE TRIGGER update_villages_updated_at BEFORE UPDATE ON public.villages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchants_updated_at ON public.merchants;
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_couriers_updated_at ON public.couriers;
CREATE TRIGGER update_couriers_updated_at BEFORE UPDATE ON public.couriers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trade_groups_updated_at ON public.trade_groups;
CREATE TRIGGER update_trade_groups_updated_at BEFORE UPDATE ON public.trade_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tourism_updated_at ON public.tourism;
CREATE TRIGGER update_tourism_updated_at BEFORE UPDATE ON public.tourism FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- PART 7: REALTIME
-- =====================================================

-- Enable realtime for key tables
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.couriers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- PART 8: DUMMY DATA
-- =====================================================

-- Categories
INSERT INTO public.categories (name, slug, icon, sort_order, is_active) VALUES
  ('Kuliner', 'kuliner', 'UtensilsCrossed', 1, true),
  ('Fashion', 'fashion', 'Shirt', 2, true),
  ('Kerajinan', 'kriya', 'Palette', 3, true),
  ('Wisata', 'wisata', 'MapPin', 4, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon;

-- Quota Tiers
INSERT INTO public.quota_tiers (min_price, max_price, credit_cost, description, sort_order) VALUES
  (0, 3000, 1, 'Harga Rp 0 - Rp 3.000', 1),
  (3001, 5000, 2, 'Harga Rp 3.001 - Rp 5.000', 2),
  (5001, 8000, 3, 'Harga Rp 5.001 - Rp 8.000', 3),
  (8001, 15000, 4, 'Harga Rp 8.001 - Rp 15.000', 4),
  (15001, NULL, 5, 'Harga > Rp 15.000', 5)
ON CONFLICT DO NOTHING;

-- Transaction Packages
INSERT INTO public.transaction_packages (id, name, price_per_transaction, transaction_quota, group_commission_percent, validity_days, description, is_active) VALUES
  ('pkg11111-1111-1111-1111-111111111111', 'Paket Pemula', 25000, 50, 10, 30, 'Cocok untuk pedagang baru', true),
  ('pkg22222-2222-2222-2222-222222222222', 'Paket Standar', 50000, 120, 10, 30, 'Pilihan terpopuler', true),
  ('pkg33333-3333-3333-3333-333333333333', 'Paket Bisnis', 100000, 300, 12, 30, 'Untuk pedagang aktif', true),
  ('pkg44444-4444-4444-4444-444444444444', 'Paket Premium', 200000, 700, 15, 60, 'Untuk pedagang besar', true),
  ('pkg55555-5555-5555-5555-555555555555', 'Paket Unlimited', 500000, 2000, 20, 90, 'Tanpa batas transaksi', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price_per_transaction = EXCLUDED.price_per_transaction;

-- App Settings
INSERT INTO public.app_settings (key, value, category, description) VALUES
  ('registration_merchant', '{"enabled": true}', 'registration', 'Pengaturan pendaftaran pedagang'),
  ('registration_courier', '{"enabled": true}', 'registration', 'Pengaturan pendaftaran kurir'),
  ('registration_village', '{"enabled": true}', 'registration', 'Pengaturan pendaftaran desa'),
  ('shipping_fee', '{"base_fee": 5000, "per_km_fee": 2000, "min_fee": 5000, "max_fee": 50000, "free_shipping_min_order": 100000}', 'shipping', 'Pengaturan biaya pengiriman'),
  ('platform_fee', '{"percentage": 5, "min_fee": 500, "max_fee": 10000, "enabled": true}', 'finance', 'Pengaturan fee platform'),
  ('cod_settings', '{"enabled": true, "max_amount": 500000, "max_distance_km": 10, "service_fee": 2000, "min_trust_score": 50, "penalty_points": 50, "success_bonus_points": 1}', 'payment', 'Pengaturan COD'),
  ('address_api', '{"provider": "emsifa", "base_url": "https://www.emsifa.com/api-wilayah-indonesia/api"}', 'integration', 'API wilayah Indonesia'),
  ('payment_xendit', '{"enabled": false}', 'payment', 'Pengaturan Xendit Payment Gateway')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Villages
INSERT INTO public.villages (id, name, district, regency, description, image_url, is_active, registration_status, location_lat, location_lng, contact_name, contact_phone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Desa Sukamaju', 'Sukamakmur', 'Bogor', 'Desa wisata dengan keindahan alam pegunungan dan budaya Sunda yang kental. Terkenal dengan kerajinan bambu dan kuliner tradisional.', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', true, 'APPROVED', -6.7234, 106.8123, 'Pak Ahmad', '081234567890'),
  ('22222222-2222-2222-2222-222222222222', 'Desa Bojong Koneng', 'Babakan Madang', 'Bogor', 'Desa dengan pemandangan sawah terasering yang indah. Menawarkan pengalaman agrowisata dan kuliner organik.', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800', true, 'APPROVED', -6.6912, 106.9456, 'Bu Siti', '081234567891'),
  ('33333333-3333-3333-3333-333333333333', 'Desa Cikanyere', 'Sukamakmur', 'Cianjur', 'Desa penghasil kopi arabika terbaik di Jawa Barat dengan pemandangan perkebunan teh yang memukau.', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800', true, 'APPROVED', -6.8234, 107.0123, 'Pak Dedi', '081234567892'),
  ('44444444-4444-4444-4444-444444444444', 'Desa Ciburial', 'Cilember', 'Bogor', 'Desa dengan air terjun tersembunyi dan hutan pinus yang asri. Cocok untuk camping dan hiking.', 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', true, 'APPROVED', -6.7456, 106.8789, 'Pak Jajang', '081234567893')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url;

-- Trade Groups
INSERT INTO public.trade_groups (id, name, code, village_id, description, kas_amount, monthly_fee, is_active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kelompok Kuliner Sukamaju', 'KKS001', '11111111-1111-1111-1111-111111111111', 'Kelompok pedagang kuliner tradisional', 10000, 10000, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Kelompok Kerajinan Bojong', 'KKB001', '22222222-2222-2222-2222-222222222222', 'Kelompok pengrajin bambu dan anyaman', 15000, 15000, true)
ON CONFLICT (id) DO NOTHING;

-- Merchants
INSERT INTO public.merchants (id, name, village_id, group_id, address, phone, business_category, business_description, open_time, close_time, status, registration_status, is_open, location_lat, location_lng, rating_avg, rating_count, badge, is_verified, image_url, payment_cod_enabled, payment_transfer_enabled, bank_name, bank_account_number, bank_account_name, available_balance) VALUES
  ('m1111111-1111-1111-1111-111111111111', 'Warung Bu Imas', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Jl. Raya Sukamaju No. 12', '081234500001', 'kuliner', 'Warung makan tradisional Sunda dengan resep turun temurun. Spesialis nasi liwet dan sayur asem.', '06:00', '21:00', 'ACTIVE', 'APPROVED', true, -6.7234, 106.8123, 4.8, 156, 'VERIFIED', true, 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400', true, true, 'BCA', '1234567890', 'Bu Imas', 1500000),
  ('m2222222-2222-2222-2222-222222222222', 'Kerajinan Pak Udin', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Jl. Bojong Indah No. 5', '081234500002', 'kriya', 'Pengrajin anyaman bambu berkualitas tinggi. Produk handmade dengan sentuhan modern.', '08:00', '17:00', 'ACTIVE', 'APPROVED', true, -6.6912, 106.9456, 4.9, 89, 'POPULAR', true, 'https://images.unsplash.com/photo-1528396518501-b53b655eb9b3?w=400', true, true, 'BRI', '0987654321', 'Pak Udin', 2500000),
  ('m3333333-3333-3333-3333-333333333333', 'Kopi Cikanyere', '33333333-3333-3333-3333-333333333333', NULL, 'Perkebunan Kopi Cikanyere', '081234500003', 'kuliner', 'Kopi arabika premium langsung dari petani. Roasting fresh setiap minggu.', '07:00', '18:00', 'ACTIVE', 'APPROVED', true, -6.8234, 107.0123, 4.7, 234, 'VERIFIED', true, 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400', false, true, 'Mandiri', '1122334455', 'Kopi Cikanyere', 3200000),
  ('m4444444-4444-4444-4444-444444444444', 'Sambal Neng Evi', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Jl. Sukamaju Dalam No. 8', '081234500004', 'kuliner', 'Aneka sambal tradisional khas Sunda. Pedas nikmat tahan lama.', '08:00', '20:00', 'ACTIVE', 'APPROVED', true, -6.7256, 106.8145, 4.6, 178, 'NEW', false, 'https://images.unsplash.com/photo-1534940519139-f860fb3c6e38?w=400', true, false, NULL, NULL, NULL, 450000),
  ('m5555555-5555-5555-5555-555555555555', 'Batik Cirebon Asli', '44444444-4444-4444-4444-444444444444', NULL, 'Jl. Ciburial Raya No. 20', '081234500005', 'fashion', 'Batik tulis asli Cirebon dengan motif khas mega mendung.', '09:00', '17:00', 'ACTIVE', 'APPROVED', true, -6.7456, 106.8789, 4.9, 67, 'VERIFIED', true, 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400', true, true, 'BNI', '5566778899', 'Batik Cirebon', 5600000),
  ('m6666666-6666-6666-6666-666666666666', 'Keripik Singkong Makmur', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Jl. Bojong Tengah No. 15', '081234500006', 'kuliner', 'Keripik singkong renyah aneka rasa. Oleh-oleh khas Bogor.', '07:00', '19:00', 'ACTIVE', 'APPROVED', true, -6.6934, 106.9478, 4.5, 312, 'POPULAR', true, 'https://images.unsplash.com/photo-1621447504864-d8686e12698c?w=400', true, true, 'BCA', '9988776655', 'Keripik Makmur', 890000)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url,
  available_balance = EXCLUDED.available_balance;

-- Products
INSERT INTO public.products (id, merchant_id, name, description, price, stock, image_url, category, is_active, is_promo, view_count, order_count) VALUES
  -- Warung Bu Imas
  ('p1111111-1111-1111-1111-111111111111', 'm1111111-1111-1111-1111-111111111111', 'Nasi Liwet Komplit', 'Nasi liwet dengan lauk ikan asin, tempe, tahu, dan sambal. Porsi mengenyangkan.', 25000, 50, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400', 'kuliner', true, false, 1234, 456),
  ('p1111111-1111-1111-1111-111111111112', 'm1111111-1111-1111-1111-111111111111', 'Sayur Asem Segar', 'Sayur asem khas Sunda dengan jagung manis, kacang panjang, dan labu siam.', 15000, 30, 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=400', 'kuliner', true, true, 876, 234),
  ('p1111111-1111-1111-1111-111111111113', 'm1111111-1111-1111-1111-111111111111', 'Pepes Ikan Mas', 'Pepes ikan mas bumbu rica dengan daun pisang. Fresh from the fish pond.', 35000, 20, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400', 'kuliner', true, false, 654, 123),
  
  -- Kerajinan Pak Udin
  ('p2222222-2222-2222-2222-222222222221', 'm2222222-2222-2222-2222-222222222222', 'Tas Anyaman Bambu Premium', 'Tas anyaman bambu handmade dengan finishing natural. Cocok untuk fashion statement.', 150000, 15, 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400', 'kriya', true, false, 543, 67),
  ('p2222222-2222-2222-2222-222222222222', 'm2222222-2222-2222-2222-222222222222', 'Lampu Hias Bambu', 'Lampu hias dari anyaman bambu. Cahaya hangat untuk suasana ruangan.', 85000, 25, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400', 'kriya', true, true, 432, 89),
  ('p2222222-2222-2222-2222-222222222223', 'm2222222-2222-2222-2222-222222222222', 'Set Piring Bambu (6pcs)', 'Set piring makan dari bambu. Food grade dan ramah lingkungan.', 120000, 10, 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=400', 'kriya', true, false, 321, 45),
  
  -- Kopi Cikanyere
  ('p3333333-3333-3333-3333-333333333331', 'm3333333-3333-3333-3333-333333333333', 'Kopi Arabika 250gr', 'Biji kopi arabika premium dari ketinggian 1200m. Medium roast.', 75000, 100, 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400', 'kuliner', true, false, 2345, 567),
  ('p3333333-3333-3333-3333-333333333332', 'm3333333-3333-3333-3333-333333333333', 'Drip Bag Coffee (10pcs)', 'Kopi siap seduh dalam kemasan drip. Praktis untuk traveling.', 85000, 80, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400', 'kuliner', true, true, 1876, 423),
  
  -- Sambal Neng Evi
  ('p4444444-4444-4444-4444-444444444441', 'm4444444-4444-4444-4444-444444444444', 'Sambal Terasi Original', 'Sambal terasi khas Sunda. Level pedas medium, cocok untuk semua.', 25000, 50, 'https://images.unsplash.com/photo-1534940519139-f860fb3c6e38?w=400', 'kuliner', true, false, 987, 234),
  ('p4444444-4444-4444-4444-444444444442', 'm4444444-4444-4444-4444-444444444444', 'Sambal Cabe Ijo', 'Sambal cabai hijau pedas segar. Cocok untuk seafood.', 28000, 40, 'https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=400', 'kuliner', true, false, 765, 189),
  
  -- Batik Cirebon Asli
  ('p5555555-5555-5555-5555-555555555551', 'm5555555-5555-5555-5555-555555555555', 'Batik Mega Mendung Tulis', 'Batik tulis motif mega mendung klasik. 100% katun primisima.', 450000, 8, 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400', 'fashion', true, false, 543, 23),
  ('p5555555-5555-5555-5555-555555555552', 'm5555555-5555-5555-5555-555555555555', 'Kemeja Batik Pria', 'Kemeja batik lengan panjang motif Cirebon modern.', 285000, 20, 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400', 'fashion', true, true, 432, 67),
  
  -- Keripik Singkong Makmur
  ('p6666666-6666-6666-6666-666666666661', 'm6666666-6666-6666-6666-666666666666', 'Keripik Singkong Original 250gr', 'Keripik singkong renyah rasa original. Tanpa MSG.', 15000, 200, 'https://images.unsplash.com/photo-1621447504864-d8686e12698c?w=400', 'kuliner', true, false, 3456, 1234),
  ('p6666666-6666-6666-6666-666666666662', 'm6666666-6666-6666-6666-666666666666', 'Keripik Singkong Balado 250gr', 'Keripik singkong rasa balado pedas manis.', 18000, 150, 'https://images.unsplash.com/photo-1604467715878-83e57e8bc129?w=400', 'kuliner', true, true, 2876, 987),
  ('p6666666-6666-6666-6666-666666666663', 'm6666666-6666-6666-6666-666666666666', 'Paket Keripik Mix (5 Rasa)', 'Paket lengkap 5 rasa: original, balado, keju, BBQ, seaweed.', 65000, 50, 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400', 'kuliner', true, false, 1543, 432)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  image_url = EXCLUDED.image_url;

-- Tourism
INSERT INTO public.tourism (id, village_id, name, description, image_url, location_lat, location_lng, wa_link, facilities, is_active, view_count) VALUES
  ('t1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Curug Cilember', 'Air terjun 7 tingkat yang indah dengan trek hiking menantang. Cocok untuk pecinta alam dan fotografi.', 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800', -6.7156, 106.8234, 'https://wa.me/6281234567890', ARRAY['Toilet', 'Mushola', 'Warung Makan', 'Area Parkir', 'Pemandu Wisata'], true, 5678),
  ('t2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Kampung Wisata Sawah', 'Pengalaman menanam padi dan panen di sawah terasering. Belajar pertanian organik langsung dari petani.', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800', -6.6834, 106.9512, 'https://wa.me/6281234567891', ARRAY['Homestay', 'Restoran', 'Toilet', 'Mushola', 'Area Foto'], true, 4321),
  ('t3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Perkebunan Kopi Arabika', 'Tur edukasi proses kopi dari biji hingga cangkir. Termasuk cupping session dan take home coffee.', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800', -6.8156, 107.0234, 'https://wa.me/6281234567892', ARRAY['Coffee Shop', 'Toilet', 'Area Parkir', 'Souvenir Shop', 'Pemandu Wisata'], true, 3456),
  ('t4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'Hutan Pinus Ciburial', 'Area camping dan hiking di hutan pinus yang sejuk. Sunset point terbaik di Bogor.', 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', -6.7389, 106.8856, 'https://wa.me/6281234567893', ARRAY['Camping Ground', 'Toilet', 'Warung', 'Area Parkir', 'Gazebo'], true, 6789),
  ('t5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Taman Budaya Sukamaju', 'Pusat kesenian dan budaya Sunda. Pertunjukan wayang, angklung, dan tari jaipong setiap weekend.', 'https://images.unsplash.com/photo-1545893835-abaa50cbe628?w=800', -6.7278, 106.8089, 'https://wa.me/6281234567894', ARRAY['Auditorium', 'Galeri Seni', 'Toilet', 'Kantin', 'Area Parkir'], true, 2345),
  ('t6666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'Danau Bojong', 'Danau alami dengan perahu wisata dan spot memancing. View sunrise yang spektakuler.', 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800', -6.6978, 106.9389, 'https://wa.me/6281234567895', ARRAY['Perahu Wisata', 'Pemancingan', 'Warung Apung', 'Toilet', 'Area Parkir'], true, 4567)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url;

-- Promotions/Banners
INSERT INTO public.promotions (id, title, subtitle, image_url, type, link_type, link_url, start_date, end_date, is_active, is_approved, sort_order) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'Flash Sale Kuliner', 'Diskon hingga 50% untuk produk kuliner lokal', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200', 'banner', 'category', '/products?category=kuliner', now(), now() + interval '30 days', true, true, 1),
  ('b2222222-2222-2222-2222-222222222222', 'Kerajinan Tangan Asli', 'Produk handmade berkualitas tinggi dari pengrajin lokal', 'https://images.unsplash.com/photo-1528396518501-b53b655eb9b3?w=1200', 'banner', 'category', '/products?category=kriya', now(), now() + interval '30 days', true, true, 2),
  ('b3333333-3333-3333-3333-333333333333', 'Jelajahi Desa Wisata', 'Temukan keindahan alam dan budaya desa-desa Indonesia', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', 'banner', 'page', '/tourism', now(), now() + interval '30 days', true, true, 3),
  ('b4444444-4444-4444-4444-444444444444', 'Kopi Nusantara', 'Nikmati kopi arabika premium dari petani lokal', 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=1200', 'banner', 'merchant', '/shops/m3333333-3333-3333-3333-333333333333', now(), now() + interval '30 days', true, true, 4),
  ('b5555555-5555-5555-5555-555555555555', 'Batik Cirebon Collection', 'Koleksi batik tulis motif mega mendung', 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=1200', 'banner', 'category', '/products?category=fashion', now(), now() + interval '30 days', true, true, 5),
  ('b6666666-6666-6666-6666-666666666666', 'Promo Gratis Ongkir', 'Gratis ongkir untuk pembelian minimal Rp 100.000', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200', 'banner', 'page', '/products', now(), now() + interval '14 days', true, true, 6),
  ('b7777777-7777-7777-7777-777777777777', 'Weekend Getaway', 'Paket wisata akhir pekan ke desa-desa terindah', 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200', 'banner', 'page', '/tourism', now(), now() + interval '30 days', true, true, 7)
ON CONFLICT (id) DO UPDATE SET 
  title = EXCLUDED.title,
  image_url = EXCLUDED.image_url,
  is_active = true,
  is_approved = true;

-- Couriers
INSERT INTO public.couriers (id, name, phone, email, province, city, district, subdistrict, address, ktp_number, ktp_image_url, photo_url, vehicle_type, vehicle_plate, vehicle_image_url, registration_status, status, is_available, current_lat, current_lng, village_id) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Agus Setiawan', '081234600001', 'agus@email.com', 'Jawa Barat', 'Bogor', 'Sukamakmur', 'Sukamaju', 'Jl. Kurir No. 1', '3201234567890001', 'https://placehold.co/400x300', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', 'motor', 'B 1234 ABC', 'https://placehold.co/400x300', 'APPROVED', 'ACTIVE', true, -6.7234, 106.8123, '11111111-1111-1111-1111-111111111111'),
  ('c2222222-2222-2222-2222-222222222222', 'Budi Santoso', '081234600002', 'budi@email.com', 'Jawa Barat', 'Bogor', 'Babakan Madang', 'Bojong Koneng', 'Jl. Kurir No. 2', '3201234567890002', 'https://placehold.co/400x300', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200', 'motor', 'B 5678 DEF', 'https://placehold.co/400x300', 'APPROVED', 'ACTIVE', true, -6.6912, 106.9456, '22222222-2222-2222-2222-222222222222'),
  ('c3333333-3333-3333-3333-333333333333', 'Dani Wijaya', '081234600003', 'dani@email.com', 'Jawa Barat', 'Cianjur', 'Sukamakmur', 'Cikanyere', 'Jl. Kurir No. 3', '3201234567890003', 'https://placehold.co/400x300', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200', 'motor', 'B 9012 GHI', 'https://placehold.co/400x300', 'APPROVED', 'ACTIVE', false, -6.8234, 107.0123, '33333333-3333-3333-3333-333333333333')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  status = 'ACTIVE',
  registration_status = 'APPROVED';

-- Flash Sales
INSERT INTO public.flash_sales (id, merchant_id, product_id, original_price, flash_price, stock_available, stock_sold, start_time, end_time, status, reason) VALUES
  ('f1111111-1111-1111-1111-111111111111', 'm1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111112', 15000, 10000, 20, 5, now(), now() + interval '24 hours', 'ACTIVE', 'Cuci gudang sayur segar'),
  ('f2222222-2222-2222-2222-222222222222', 'm2222222-2222-2222-2222-222222222222', 'p2222222-2222-2222-2222-222222222222', 85000, 59000, 10, 3, now(), now() + interval '48 hours', 'ACTIVE', 'Promo pembukaan toko online'),
  ('f3333333-3333-3333-3333-333333333333', 'm6666666-6666-6666-6666-666666666666', 'p6666666-6666-6666-6666-666666666662', 18000, 12000, 50, 12, now(), now() + interval '12 hours', 'ACTIVE', 'Happy hour promo')
ON CONFLICT (id) DO UPDATE SET 
  flash_price = EXCLUDED.flash_price,
  end_time = EXCLUDED.end_time,
  status = 'ACTIVE';

-- Vouchers
INSERT INTO public.vouchers (id, merchant_id, code, name, description, discount_type, discount_value, min_order_amount, max_discount, usage_limit, is_active) VALUES
  ('v1111111-1111-1111-1111-111111111111', NULL, 'WELCOME10', 'Diskon Pengguna Baru', 'Diskon 10% untuk pengguna baru', 'percentage', 10, 50000, 25000, 1000, true),
  ('v2222222-2222-2222-2222-222222222222', NULL, 'GRATISONGKIR', 'Gratis Ongkir', 'Gratis ongkir max Rp 15.000', 'fixed', 15000, 75000, NULL, 500, true),
  ('v3333333-3333-3333-3333-333333333333', 'm1111111-1111-1111-1111-111111111111', 'BUIMAS15', 'Diskon Warung Bu Imas', 'Diskon 15% khusus Warung Bu Imas', 'percentage', 15, 30000, 20000, 100, true),
  ('v4444444-4444-4444-4444-444444444444', 'm3333333-3333-3333-3333-333333333333', 'KOPICIKANYERE', 'Diskon Kopi Cikanyere', 'Diskon Rp 10.000 untuk kopi', 'fixed', 10000, 50000, NULL, 200, true)
ON CONFLICT (id) DO UPDATE SET 
  is_active = true;

-- Dummy Orders (with various statuses)
INSERT INTO public.orders (id, buyer_id, merchant_id, courier_id, status, handled_by, delivery_type, delivery_name, delivery_phone, delivery_address, delivery_lat, delivery_lng, subtotal, shipping_cost, total, payment_method, payment_status, notes, created_at) VALUES
  -- Order 1: DONE (completed)
  ('ord11111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'm1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'DONE', 'ADMIN', 'INTERNAL', 'Ahmad Supardi', '081234567001', 'Jl. Merdeka No. 10, Sukamaju', -6.7234, 106.8123, 75000, 10000, 85000, 'TRANSFER', 'PAID', 'Pesanan sukses', now() - interval '5 days'),
  
  -- Order 2: DONE (completed with COD)
  ('ord22222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', 'm2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'DONE', 'ADMIN', 'INTERNAL', 'Dewi Sartika', '081234567002', 'Jl. Pahlawan No. 25, Bojong Koneng', -6.6912, 106.9456, 235000, 15000, 250000, 'COD', 'PAID', 'COD berhasil', now() - interval '3 days'),
  
  -- Order 3: SENT (in delivery)
  ('ord33333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000003', 'm3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'SENT', 'ADMIN', 'INTERNAL', 'Budi Hartono', '081234567003', 'Jl. Cikanyere No. 8', -6.8234, 107.0123, 160000, 12000, 172000, 'TRANSFER', 'PAID', 'Sedang diantar', now() - interval '1 day'),
  
  -- Order 4: PROCESSED (being prepared)
  ('ord44444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'm4444444-4444-4444-4444-444444444444', NULL, 'PROCESSED', 'ADMIN', 'INTERNAL', 'Ahmad Supardi', '081234567001', 'Jl. Merdeka No. 10, Sukamaju', -6.7234, 106.8123, 53000, 8000, 61000, 'COD', 'UNPAID', 'Tolong dipaket rapi', now() - interval '6 hours'),
  
  -- Order 5: NEW (just created)
  ('ord55555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000002', 'm6666666-6666-6666-6666-666666666666', NULL, 'NEW', 'ADMIN', 'INTERNAL', 'Dewi Sartika', '081234567002', 'Jl. Pahlawan No. 25, Bojong Koneng', -6.6912, 106.9456, 98000, 10000, 108000, 'TRANSFER', 'UNPAID', NULL, now() - interval '2 hours'),
  
  -- Order 6: PENDING_CONFIRMATION (waiting COD confirmation)
  ('ord66666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000003', 'm1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'PENDING_CONFIRMATION', 'ADMIN', 'INTERNAL', 'Cecep Suhendar', '081234567004', 'Jl. Sukamaju Dalam No. 15', -6.7256, 106.8145, 40000, 8000, 50000, 'COD', 'UNPAID', 'Menunggu konfirmasi', now() - interval '30 minutes'),
  
  -- Order 7: CANCELED
  ('ord77777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000001', 'm5555555-5555-5555-5555-555555555555', NULL, 'CANCELED', 'ADMIN', 'PICKUP', 'Ahmad Supardi', '081234567001', NULL, NULL, NULL, 450000, 0, 450000, 'TRANSFER', 'UNPAID', 'Dibatalkan: stok habis', now() - interval '7 days'),
  
  -- Order 8: PICKUP (self pickup)
  ('ord88888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000002', 'm3333333-3333-3333-3333-333333333333', NULL, 'READY', 'ADMIN', 'PICKUP', 'Dewi Sartika', '081234567002', NULL, NULL, NULL, 150000, 0, 150000, 'TRANSFER', 'PAID', 'Siap diambil', now() - interval '4 hours'),
  
  -- Order 9: ASSIGNED (assigned to courier)
  ('ord99999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000003', 'm2222222-2222-2222-2222-222222222222', 'c3333333-3333-3333-3333-333333333333', 'ASSIGNED', 'ADMIN', 'INTERNAL', 'Fitri Handayani', '081234567005', 'Jl. Raya Ciburial No. 5', -6.7456, 106.8789, 270000, 15000, 285000, 'TRANSFER', 'PAID', 'Sudah ada kurir', now() - interval '3 hours'),
  
  -- Order 10: PICKED_UP (courier picked up)
  ('ordaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'm6666666-6666-6666-6666-666666666666', 'c1111111-1111-1111-1111-111111111111', 'PICKED_UP', 'ADMIN', 'INTERNAL', 'Ahmad Supardi', '081234567001', 'Jl. Merdeka No. 10, Sukamaju', -6.7234, 106.8123, 65000, 8000, 73000, 'COD', 'UNPAID', 'Kurir sudah ambil', now() - interval '1 hour')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- Order Items for each order
INSERT INTO public.order_items (id, order_id, product_id, product_name, product_price, quantity, subtotal) VALUES
  -- Order 1 items
  ('oi111111-1111-1111-1111-111111111111', 'ord11111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 'Nasi Liwet Komplit', 25000, 2, 50000),
  ('oi111111-1111-1111-1111-111111111112', 'ord11111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111112', 'Sayur Asem Segar', 15000, 1, 15000),
  ('oi111111-1111-1111-1111-111111111113', 'ord11111-1111-1111-1111-111111111111', 'p4444444-4444-4444-4444-444444444441', 'Sambal Terasi Original', 25000, 1, 25000),
  
  -- Order 2 items
  ('oi222222-2222-2222-2222-222222222221', 'ord22222-2222-2222-2222-222222222222', 'p2222222-2222-2222-2222-222222222221', 'Tas Anyaman Bambu Premium', 150000, 1, 150000),
  ('oi222222-2222-2222-2222-222222222222', 'ord22222-2222-2222-2222-222222222222', 'p2222222-2222-2222-2222-222222222222', 'Lampu Hias Bambu', 85000, 1, 85000),
  
  -- Order 3 items
  ('oi333333-3333-3333-3333-333333333331', 'ord33333-3333-3333-3333-333333333333', 'p3333333-3333-3333-3333-333333333331', 'Kopi Arabika 250gr', 75000, 2, 150000),
  ('oi333333-3333-3333-3333-333333333332', 'ord33333-3333-3333-3333-333333333333', 'p3333333-3333-3333-3333-333333333332', 'Drip Bag Coffee (10pcs)', 85000, 1, 85000),
  
  -- Order 4 items
  ('oi444444-4444-4444-4444-444444444441', 'ord44444-4444-4444-4444-444444444444', 'p4444444-4444-4444-4444-444444444441', 'Sambal Terasi Original', 25000, 1, 25000),
  ('oi444444-4444-4444-4444-444444444442', 'ord44444-4444-4444-4444-444444444444', 'p4444444-4444-4444-4444-444444444442', 'Sambal Cabe Ijo', 28000, 1, 28000),
  
  -- Order 5 items
  ('oi555555-5555-5555-5555-555555555551', 'ord55555-5555-5555-5555-555555555555', 'p6666666-6666-6666-6666-666666666661', 'Keripik Singkong Original 250gr', 15000, 3, 45000),
  ('oi555555-5555-5555-5555-555555555552', 'ord55555-5555-5555-5555-555555555555', 'p6666666-6666-6666-6666-666666666662', 'Keripik Singkong Balado 250gr', 18000, 2, 36000),
  ('oi555555-5555-5555-5555-555555555553', 'ord55555-5555-5555-5555-555555555555', 'p6666666-6666-6666-6666-666666666663', 'Paket Keripik Mix (5 Rasa)', 65000, 1, 65000),
  
  -- Order 6 items
  ('oi666666-6666-6666-6666-666666666661', 'ord66666-6666-6666-6666-666666666666', 'p1111111-1111-1111-1111-111111111111', 'Nasi Liwet Komplit', 25000, 1, 25000),
  ('oi666666-6666-6666-6666-666666666662', 'ord66666-6666-6666-6666-666666666666', 'p1111111-1111-1111-1111-111111111112', 'Sayur Asem Segar', 15000, 1, 15000),
  
  -- Order 7 items
  ('oi777777-7777-7777-7777-777777777771', 'ord77777-7777-7777-7777-777777777777', 'p5555555-5555-5555-5555-555555555551', 'Batik Mega Mendung Tulis', 450000, 1, 450000),
  
  -- Order 8 items
  ('oi888888-8888-8888-8888-888888888881', 'ord88888-8888-8888-8888-888888888888', 'p3333333-3333-3333-3333-333333333331', 'Kopi Arabika 250gr', 75000, 2, 150000),
  
  -- Order 9 items
  ('oi999999-9999-9999-9999-999999999991', 'ord99999-9999-9999-9999-999999999999', 'p2222222-2222-2222-2222-222222222221', 'Tas Anyaman Bambu Premium', 150000, 1, 150000),
  ('oi999999-9999-9999-9999-999999999992', 'ord99999-9999-9999-9999-999999999999', 'p2222222-2222-2222-2222-222222222223', 'Set Piring Bambu (6pcs)', 120000, 1, 120000),
  
  -- Order 10 items
  ('oiaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa1', 'ordaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'p6666666-6666-6666-6666-666666666663', 'Paket Keripik Mix (5 Rasa)', 65000, 1, 65000)
ON CONFLICT (id) DO NOTHING;

-- Reviews for completed orders
INSERT INTO public.reviews (id, order_id, product_id, merchant_id, buyer_id, rating, comment, is_visible, created_at) VALUES
  ('rev11111-1111-1111-1111-111111111111', 'ord11111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 'm1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 5, 'Nasi liwetnya enak banget, porsi besar! Pasti order lagi.', true, now() - interval '4 days'),
  ('rev22222-2222-2222-2222-222222222222', 'ord22222-2222-2222-2222-222222222222', 'p2222222-2222-2222-2222-222222222221', 'm2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', 5, 'Anyamannya rapi dan kuat. Recommended untuk souvenir!', true, now() - interval '2 days'),
  ('rev33333-3333-3333-3333-333333333333', 'ord11111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111112', 'm1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 4, 'Sayur asemnya seger, sedikit kurang asem untuk saya tapi overall enak.', true, now() - interval '4 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PART 9: INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON public.products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON public.orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_merchants_village_id ON public.merchants(village_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON public.merchants(status);
CREATE INDEX IF NOT EXISTS idx_merchants_registration_status ON public.merchants(registration_status);
CREATE INDEX IF NOT EXISTS idx_couriers_village_id ON public.couriers(village_id);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON public.couriers(status);
CREATE INDEX IF NOT EXISTS idx_tourism_village_id ON public.tourism(village_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_flash_sales_status ON public.flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_flash_sales_end_time ON public.flash_sales(end_time);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON public.wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id ON public.saved_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_merchant_id ON public.reviews(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- =====================================================
-- END OF COMPLETE DATABASE SCHEMA
-- =====================================================
