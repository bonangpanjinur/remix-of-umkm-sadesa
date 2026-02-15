# Desa Wisata & UMKM Platform - Complete Database SQL

> **Catatan:** Semua tabel menggunakan `CREATE TABLE IF NOT EXISTS` sehingga aman dijalankan ulang tanpa error.
> Semua policy menggunakan `DROP POLICY IF EXISTS` sebelum `CREATE POLICY`.
> Semua trigger menggunakan `DROP TRIGGER IF EXISTS` sebelum `CREATE TRIGGER`.
> File ini merupakan satu sumber kebenaran (single source of truth) untuk seluruh skema database.

---

## Cara Penggunaan

Salin seluruh blok SQL di bawah ini dan jalankan di **SQL Editor** pada backend Lovable Cloud.

---

```sql
-- ============================================================
-- DESA WISATA & UMKM PLATFORM - COMPLETE DATABASE
-- Generated: 2026-02-15
-- Versi: 6.0 - Idempotent (aman dijalankan berulang)
-- ============================================================

-- ============================================================
-- BAGIAN 1: EXTENSIONS & ENUM TYPES
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'buyer', 'verifikator', 'merchant', 'courier', 'admin_desa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- BAGIAN 2: UTILITY FUNCTIONS (diperlukan sebelum tabel)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============================================================
-- BAGIAN 3: TABEL UTAMA
-- ============================================================

-- 3.1 PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  address text,
  address_detail text,
  avatar_url text,
  village text,
  village_id text,
  village_name text,
  province_id text,
  province_name text,
  city_id text,
  city_name text,
  district_id text,
  district_name text,
  trust_score integer DEFAULT 100,
  cod_enabled boolean DEFAULT true,
  cod_fail_count integer DEFAULT 0,
  is_verified_buyer boolean DEFAULT false,
  is_blocked boolean DEFAULT false,
  blocked_by uuid,
  blocked_at timestamptz,
  block_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.2 USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'buyer',
  UNIQUE (user_id, role)
);

-- 3.3 VILLAGES
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

-- 3.4 USER_VILLAGES
CREATE TABLE IF NOT EXISTS public.user_villages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  village_id uuid NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  role text DEFAULT 'admin_desa',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, village_id)
);

-- 3.5 CATEGORIES
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

-- 3.6 TRADE GROUPS
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

-- 3.7 TRANSACTION PACKAGES
CREATE TABLE IF NOT EXISTS public.transaction_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  classification_price text NOT NULL,
  price_per_transaction integer NOT NULL DEFAULT 0,
  group_commission_percent numeric NOT NULL DEFAULT 5,
  transaction_quota integer NOT NULL DEFAULT 100,
  total_credits integer NOT NULL DEFAULT 100,
  validity_days integer NOT NULL DEFAULT 30,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.8 MERCHANTS
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

-- 3.9 MERCHANT SUBSCRIPTIONS
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

-- FK constraint untuk merchants.current_subscription_id
DO $$ BEGIN
  ALTER TABLE public.merchants ADD CONSTRAINT merchants_current_subscription_id_fkey
    FOREIGN KEY (current_subscription_id) REFERENCES public.merchant_subscriptions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3.10 GROUP MEMBERS
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.trade_groups(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, merchant_id)
);

-- 3.11 KAS PAYMENTS
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

-- 3.12 PRODUCTS
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

-- 3.13 PRODUCT IMAGES
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_primary boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.14 PRODUCT VARIANTS
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

-- 3.15 QUOTA TIERS
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

-- 3.16 TOURISM
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

-- 3.17 COURIERS
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

-- 3.18 ORDERS
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
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.19 ORDER ITEMS
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

-- 3.20 FLASH SALES
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

-- 3.21 REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE SET NULL,
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

-- 3.22 REFUND REQUESTS
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  buyer_id uuid NOT NULL,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  amount integer NOT NULL,
  reason text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'PENDING',
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.23 WITHDRAWAL REQUESTS (Merchant)
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

-- 3.24 COURIER EARNINGS
CREATE TABLE IF NOT EXISTS public.courier_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount integer NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'DELIVERY',
  status text NOT NULL DEFAULT 'PENDING',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.25 COURIER WITHDRAWAL REQUESTS
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

-- 3.26 PLATFORM FEES
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

-- 3.27 INSURANCE FUND
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

-- 3.28 VERIFIKATOR CODES
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

-- 3.29 VERIFIKATOR EARNINGS
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

-- 3.30 VERIFIKATOR WITHDRAWALS
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

-- 3.31 GROUP ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS public.group_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.trade_groups(id),
  verifikator_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3.32 VOUCHERS
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

-- 3.33 VOUCHER USAGES
CREATE TABLE IF NOT EXISTS public.voucher_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount integer NOT NULL DEFAULT 0,
  used_at timestamptz DEFAULT now()
);

-- 3.34 PROMOTIONS
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

-- 3.35 NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.36 BROADCAST NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.broadcast_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  target_audience text NOT NULL DEFAULT 'ALL',
  target_roles text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'DRAFT',
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_count integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.37 CHAT MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  auto_delete_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.38 WISHLISTS
CREATE TABLE IF NOT EXISTS public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- 3.39 SAVED ADDRESSES
CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Rumah',
  recipient_name text NOT NULL,
  phone text NOT NULL,
  full_address text,
  address_detail text,
  province_id text,
  province_name text,
  city_id text,
  city_name text,
  district_id text,
  district_name text,
  village_id text,
  village_name text,
  lat numeric,
  lng numeric,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.40 PUSH SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.41 APP SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  category text NOT NULL DEFAULT 'general',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.42 ADMIN AUDIT LOGS
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

-- 3.43 BACKUP LOGS
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  file_url text,
  file_size integer,
  tables_included text[],
  error_message text,
  created_by uuid,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- 3.44 BACKUP SCHEDULES
CREATE TABLE IF NOT EXISTS public.backup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  schedule_type text NOT NULL DEFAULT 'daily',
  schedule_time time NOT NULL DEFAULT '02:00:00',
  schedule_day integer,
  tables_included text[] DEFAULT ARRAY['merchants','products','orders','villages','tourism','couriers'],
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.45 PASSWORD RESET TOKENS
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.46 RATE LIMITS
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action text NOT NULL,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (identifier, action, window_start)
);

-- 3.47 SEO SETTINGS
CREATE TABLE IF NOT EXISTS public.seo_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path text NOT NULL UNIQUE,
  title text,
  description text,
  og_title text,
  og_description text,
  og_image text,
  keywords text,
  canonical_url text,
  robots text DEFAULT 'index, follow',
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.48 QUOTA USAGE LOGS
CREATE TABLE IF NOT EXISTS public.quota_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.merchant_subscriptions(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_total numeric NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 1,
  remaining_quota integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.49 PAGE VIEWS
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type text NOT NULL DEFAULT 'product',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  viewer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.50 HALAL REGULATIONS
CREATE TABLE IF NOT EXISTS public.halal_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.51 POS PACKAGES
CREATE TABLE IF NOT EXISTS public.pos_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price integer NOT NULL DEFAULT 0,
  duration_months integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.52 POS SETTINGS
CREATE TABLE IF NOT EXISTS public.pos_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  paper_size text NOT NULL DEFAULT '58mm',
  font_size text NOT NULL DEFAULT 'normal',
  show_logo boolean NOT NULL DEFAULT true,
  show_address boolean NOT NULL DEFAULT true,
  show_phone boolean NOT NULL DEFAULT true,
  invoice_header text,
  invoice_footer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.53 POS SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.pos_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  package_id uuid REFERENCES public.pos_packages(id),
  payment_amount integer NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'UNPAID',
  payment_proof_url text,
  status text NOT NULL DEFAULT 'PENDING',
  is_trial boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  expired_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.54 POS TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.pos_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  transaction_number text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  subtotal integer NOT NULL DEFAULT 0,
  discount integer NOT NULL DEFAULT 0,
  tax integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'CASH',
  payment_amount integer NOT NULL DEFAULT 0,
  change_amount integer NOT NULL DEFAULT 0,
  customer_name text,
  cashier_name text,
  notes text,
  status text NOT NULL DEFAULT 'COMPLETED',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- BAGIAN 4: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity ON public.admin_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_merchant ON public.flash_sales(merchant_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_status_end ON public.flash_sales(status, end_time);
CREATE INDEX IF NOT EXISTS idx_merchant_subscriptions_merchant ON public.merchant_subscriptions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_subscriptions_status ON public.merchant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_merchants_location ON public.merchants(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON public.password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON public.product_images(product_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_usage_logs_merchant ON public.quota_usage_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_quota_usage_logs_order ON public.quota_usage_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_quota_usage_logs_created ON public.quota_usage_logs(created_at DESC);

-- ============================================================
-- BAGIAN 5: VIEWS
-- ============================================================

DROP VIEW IF EXISTS public.public_merchants CASCADE;
CREATE VIEW public.public_merchants WITH (security_invoker=on) AS
SELECT id, name, image_url, business_category, business_description, village_id,
  CASE WHEN phone IS NOT NULL THEN CONCAT('****', RIGHT(phone, 4)) ELSE NULL END AS phone_masked,
  city, district, province,
  CASE WHEN location_lat IS NOT NULL THEN ROUND(location_lat::numeric, 2) ELSE NULL END AS location_lat_approx,
  CASE WHEN location_lng IS NOT NULL THEN ROUND(location_lng::numeric, 2) ELSE NULL END AS location_lng_approx,
  is_open, open_time, close_time, rating_avg, rating_count, is_verified, badge, order_mode
FROM public.merchants
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

DROP VIEW IF EXISTS public.public_couriers CASCADE;
CREATE VIEW public.public_couriers WITH (security_invoker=on) AS
SELECT id, name,
  CASE WHEN phone IS NOT NULL THEN CONCAT('****', RIGHT(phone, 4)) ELSE NULL END AS phone_masked,
  photo_url, vehicle_type,
  CASE WHEN current_lat IS NOT NULL THEN ROUND(current_lat, 3) ELSE NULL END AS current_lat_approx,
  CASE WHEN current_lng IS NOT NULL THEN ROUND(current_lng, 3) ELSE NULL END AS current_lng_approx,
  is_available, status, village_id
FROM public.couriers
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

-- ============================================================
-- BAGIAN 6: FUNCTIONS
-- ============================================================

-- 6.1 Role checking functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(array_agg(role::text), ARRAY[]::text[]) FROM public.user_roles WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_merchant()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(), 'merchant')
$$;

CREATE OR REPLACE FUNCTION public.is_courier()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(), 'courier')
$$;

CREATE OR REPLACE FUNCTION public.is_verifikator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(), 'verifikator')
$$;

CREATE OR REPLACE FUNCTION public.is_admin_desa()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(), 'admin_desa')
$$;

-- 6.2 Entity lookup functions
CREATE OR REPLACE FUNCTION public.get_user_merchant_id(_user_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.merchants WHERE user_id = COALESCE(_user_id, auth.uid()) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_courier_id(_user_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.couriers WHERE user_id = COALESCE(_user_id, auth.uid()) LIMIT 1
$$;

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

CREATE OR REPLACE FUNCTION public.is_courier_owner(_user_id uuid, _courier_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.couriers WHERE id = _courier_id AND user_id = _user_id)
$$;

-- 6.3 Business logic functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_notification(p_user_id uuid, p_title text, p_message text, p_type text DEFAULT 'info', p_link text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link) VALUES (p_user_id, p_title, p_message, p_type, p_link) RETURNING id INTO notification_id;
  RETURN notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_quota_cost(product_price integer)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    (SELECT credit_cost FROM public.quota_tiers WHERE is_active = true AND product_price >= min_price AND (max_price IS NULL OR product_price <= max_price) ORDER BY min_price DESC LIMIT 1),
    1
  )
$$;

CREATE OR REPLACE FUNCTION public.check_merchant_quota(p_merchant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_subscription RECORD;
BEGIN
  SELECT * INTO v_subscription FROM merchant_subscriptions
  WHERE merchant_id = p_merchant_id AND status = 'ACTIVE' AND expired_at > now() AND used_quota < transaction_quota
  ORDER BY expired_at DESC LIMIT 1;
  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object('can_transact', false, 'reason', 'Tidak ada kuota transaksi aktif.', 'remaining_quota', 0);
  END IF;
  RETURN jsonb_build_object('can_transact', true, 'remaining_quota', v_subscription.transaction_quota - v_subscription.used_quota, 'subscription_id', v_subscription.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.use_merchant_quota(p_merchant_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE merchant_subscriptions SET used_quota = used_quota + 1, updated_at = now()
  WHERE merchant_id = p_merchant_id AND status = 'ACTIVE' AND expired_at > now() AND used_quota < transaction_quota;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.use_merchant_quota(_merchant_id uuid, _product_price integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _subscription_id UUID; _remaining_quota INTEGER; _cost INTEGER;
BEGIN
  _cost := public.get_quota_cost(_product_price);
  SELECT id, (transaction_quota - used_quota) INTO _subscription_id, _remaining_quota
  FROM public.merchant_subscriptions WHERE merchant_id = _merchant_id AND status = 'ACTIVE' AND expired_at > now()
  ORDER BY created_at DESC LIMIT 1;
  IF _subscription_id IS NULL OR _remaining_quota < _cost THEN RETURN FALSE; END IF;
  UPDATE public.merchant_subscriptions SET used_quota = used_quota + _cost, updated_at = now() WHERE id = _subscription_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_merchant_quota(p_merchant_id uuid, p_credits integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_sub_id UUID; v_remaining INTEGER;
BEGIN
  SELECT id, (transaction_quota - used_quota) INTO v_sub_id, v_remaining
  FROM public.merchant_subscriptions WHERE merchant_id = p_merchant_id AND status = 'ACTIVE' AND expired_at > now() AND (transaction_quota - used_quota) >= p_credits
  ORDER BY expired_at ASC LIMIT 1;
  IF v_sub_id IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.merchant_subscriptions SET used_quota = used_quota + p_credits, updated_at = now() WHERE id = v_sub_id;
  RETURN TRUE;
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
DECLARE completed_count INTEGER;
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
  UPDATE orders SET status = 'CANCELED', notes = COALESCE(notes, '') || ' [Auto-canceled]', updated_at = now()
  WHERE status = 'PENDING_CONFIRMATION' AND confirmation_deadline < now();
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_order_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE merchant_user_id UUID; order_status_text TEXT;
BEGIN
  SELECT user_id INTO merchant_user_id FROM merchants WHERE id = NEW.merchant_id;
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
    PERFORM send_notification(NEW.buyer_id, 'Status Pesanan Diperbarui', 'Pesanan #' || LEFT(NEW.id::TEXT, 8) || ' ' || order_status_text, 'order', '/orders/' || NEW.id);
  END IF;
  IF TG_OP = 'INSERT' AND merchant_user_id IS NOT NULL THEN
    PERFORM send_notification(merchant_user_id, 'Pesanan Baru', 'Anda menerima pesanan baru senilai Rp ' || NEW.total::TEXT, 'order', '/merchant/orders');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_merchant_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND TG_OP = 'UPDATE' AND OLD.registration_status IS DISTINCT FROM NEW.registration_status THEN
    IF NEW.registration_status = 'APPROVED' THEN
      PERFORM send_notification(NEW.user_id, 'Pendaftaran Merchant Disetujui', 'Selamat! Toko ' || NEW.name || ' telah diverifikasi.', 'success', '/merchant');
    ELSIF NEW.registration_status = 'REJECTED' THEN
      PERFORM send_notification(NEW.user_id, 'Pendaftaran Merchant Ditolak', 'Maaf, pendaftaran toko ' || NEW.name || ' ditolak. Alasan: ' || COALESCE(NEW.rejection_reason, 'Tidak memenuhi syarat'), 'error', '/register/merchant');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_withdrawal_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE merchant_user_id UUID; status_text TEXT;
BEGIN
  SELECT user_id INTO merchant_user_id FROM merchants WHERE id = NEW.merchant_id;
  IF merchant_user_id IS NULL THEN RETURN NEW; END IF;
  CASE NEW.status WHEN 'APPROVED' THEN status_text := 'disetujui'; WHEN 'REJECTED' THEN status_text := 'ditolak'; WHEN 'COMPLETED' THEN status_text := 'telah ditransfer'; ELSE status_text := NEW.status; END CASE;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status != 'PENDING' THEN
    PERFORM send_notification(merchant_user_id, 'Penarikan Saldo ' || INITCAP(status_text), 'Permintaan penarikan Rp ' || NEW.amount::TEXT || ' telah ' || status_text, 'withdrawal', '/merchant/withdrawal');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_new_withdrawal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE admin_id UUID; merchant_name TEXT;
BEGIN
  SELECT name INTO merchant_name FROM merchants WHERE id = NEW.merchant_id;
  FOR admin_id IN SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    PERFORM send_notification(admin_id, 'Permintaan Penarikan Baru', merchant_name || ' mengajukan penarikan Rp ' || NEW.amount::TEXT, 'withdrawal', '/admin/withdrawals');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_trust_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'REJECTED_BY_BUYER' AND OLD.status != 'REJECTED_BY_BUYER' THEN
    UPDATE profiles SET trust_score = GREATEST(0, trust_score - 50), cod_fail_count = cod_fail_count + 1,
      cod_enabled = CASE WHEN trust_score - 50 < 50 THEN false ELSE cod_enabled END WHERE user_id = NEW.buyer_id;
  END IF;
  IF NEW.status = 'DONE' AND OLD.status != 'DONE' AND NEW.payment_method = 'COD' THEN
    UPDATE profiles SET trust_score = LEAST(100, trust_score + 1) WHERE user_id = NEW.buyer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_cod_trust_score(p_buyer_id uuid, p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cod_settings JSONB; v_penalty INTEGER; v_bonus INTEGER; v_min INTEGER; v_current INTEGER; v_fail INTEGER; v_new INTEGER;
BEGIN
  SELECT value INTO v_cod_settings FROM app_settings WHERE key = 'cod_settings';
  v_penalty := COALESCE((v_cod_settings->>'penalty_points')::INTEGER, 50);
  v_bonus := COALESCE((v_cod_settings->>'success_bonus_points')::INTEGER, 1);
  v_min := COALESCE((v_cod_settings->>'min_trust_score')::INTEGER, 50);
  SELECT trust_score, cod_fail_count INTO v_current, v_fail FROM profiles WHERE user_id = p_buyer_id;
  v_current := COALESCE(v_current, 100); v_fail := COALESCE(v_fail, 0);
  IF p_success THEN
    v_new := LEAST(100, v_current + v_bonus); UPDATE profiles SET trust_score = v_new WHERE user_id = p_buyer_id;
  ELSE
    v_new := GREATEST(0, v_current - v_penalty);
    UPDATE profiles SET trust_score = v_new, cod_fail_count = v_fail + 1, cod_enabled = CASE WHEN v_new < v_min THEN false ELSE cod_enabled END WHERE user_id = p_buyer_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_cod_eligibility(p_buyer_id uuid, p_merchant_id uuid, p_total_amount integer, p_distance_km numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cod JSONB; v_max_amt INTEGER; v_max_dist NUMERIC; v_min_trust INTEGER; v_trust INTEGER; v_cod_enabled BOOLEAN; v_m_max_amt INTEGER; v_m_max_dist NUMERIC;
BEGIN
  SELECT value INTO v_cod FROM app_settings WHERE key = 'cod_settings';
  v_max_amt := COALESCE((v_cod->>'max_amount')::INTEGER, 75000);
  v_max_dist := COALESCE((v_cod->>'max_distance_km')::NUMERIC, 3);
  v_min_trust := COALESCE((v_cod->>'min_trust_score')::INTEGER, 50);
  SELECT trust_score, cod_enabled INTO v_trust, v_cod_enabled FROM profiles WHERE user_id = p_buyer_id;
  IF v_cod_enabled = false THEN RETURN jsonb_build_object('eligible', false, 'reason', 'Akun Anda tidak dapat menggunakan COD'); END IF;
  IF COALESCE(v_trust, 100) < v_min_trust THEN RETURN jsonb_build_object('eligible', false, 'reason', 'Trust score tidak mencukupi'); END IF;
  SELECT cod_max_amount, cod_max_distance_km INTO v_m_max_amt, v_m_max_dist FROM merchants WHERE id = p_merchant_id;
  v_max_amt := LEAST(v_max_amt, COALESCE(v_m_max_amt, v_max_amt));
  v_max_dist := LEAST(v_max_dist, COALESCE(v_m_max_dist, v_max_dist));
  IF p_total_amount > v_max_amt THEN RETURN jsonb_build_object('eligible', false, 'reason', format('Nominal terlalu besar. Maks: Rp %s', to_char(v_max_amt, 'FM999,999,999'))); END IF;
  IF p_distance_km IS NOT NULL AND p_distance_km > v_max_dist THEN RETURN jsonb_build_object('eligible', false, 'reason', format('Jarak terlalu jauh. Maks: %s KM', v_max_dist)); END IF;
  RETURN jsonb_build_object('eligible', true, 'reason', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_identifier text, p_action text, p_max_requests integer DEFAULT 10, p_window_seconds integer DEFAULT 60)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_window_start TIMESTAMPTZ; v_current_count INTEGER;
BEGIN
  v_window_start := date_trunc('minute', now());
  SELECT count INTO v_current_count FROM rate_limits WHERE identifier = p_identifier AND action = p_action AND window_start = v_window_start;
  IF v_current_count IS NULL THEN
    INSERT INTO rate_limits (identifier, action, count, window_start) VALUES (p_identifier, p_action, 1, v_window_start)
    ON CONFLICT (identifier, action, window_start) DO UPDATE SET count = rate_limits.count + 1;
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1);
  END IF;
  IF v_current_count >= p_max_requests THEN RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after', p_window_seconds); END IF;
  UPDATE rate_limits SET count = count + 1 WHERE identifier = p_identifier AND action = p_action AND window_start = v_window_start;
  RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - v_current_count - 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_voucher(p_code text, p_user_id uuid, p_order_total integer, p_merchant_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_voucher RECORD; v_usage_count INTEGER; v_discount INTEGER;
BEGIN
  SELECT * INTO v_voucher FROM vouchers WHERE UPPER(code) = UPPER(p_code) AND is_active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now());
  IF v_voucher IS NULL THEN RETURN jsonb_build_object('valid', false, 'error', 'Kode voucher tidak ditemukan'); END IF;
  IF v_voucher.merchant_id IS NOT NULL AND v_voucher.merchant_id != p_merchant_id THEN RETURN jsonb_build_object('valid', false, 'error', 'Voucher tidak berlaku untuk toko ini'); END IF;
  IF p_order_total < v_voucher.min_order_amount THEN RETURN jsonb_build_object('valid', false, 'error', 'Minimum belanja Rp ' || v_voucher.min_order_amount); END IF;
  IF v_voucher.usage_limit IS NOT NULL AND v_voucher.used_count >= v_voucher.usage_limit THEN RETURN jsonb_build_object('valid', false, 'error', 'Voucher sudah habis'); END IF;
  SELECT COUNT(*) INTO v_usage_count FROM voucher_usages WHERE voucher_id = v_voucher.id AND user_id = p_user_id;
  IF v_usage_count > 0 THEN RETURN jsonb_build_object('valid', false, 'error', 'Anda sudah menggunakan voucher ini'); END IF;
  IF v_voucher.discount_type = 'percentage' THEN
    v_discount := FLOOR(p_order_total * v_voucher.discount_value / 100);
    IF v_voucher.max_discount IS NOT NULL AND v_discount > v_voucher.max_discount THEN v_discount := v_voucher.max_discount; END IF;
  ELSE v_discount := v_voucher.discount_value; END IF;
  RETURN jsonb_build_object('valid', true, 'voucher_id', v_voucher.id, 'discount', v_discount, 'voucher_name', v_voucher.name);
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_merchant_to_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_code RECORD; v_group RECORD;
BEGIN
  IF NEW.verifikator_code IS NOT NULL AND NEW.group_id IS NULL THEN
    SELECT * INTO v_code FROM verifikator_codes WHERE code = NEW.verifikator_code AND is_active = true LIMIT 1;
    IF v_code IS NOT NULL THEN
      SELECT * INTO v_group FROM trade_groups WHERE verifikator_id = v_code.verifikator_id AND is_active = true LIMIT 1;
      IF v_group IS NOT NULL THEN
        NEW.group_id := v_group.id;
        INSERT INTO group_members (group_id, merchant_id, status) VALUES (v_group.id, NEW.id, 'ACTIVE') ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_monthly_kas(p_group_id uuid, p_month integer, p_year integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_group RECORD; v_member RECORD; v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_group FROM trade_groups WHERE id = p_group_id;
  IF v_group IS NULL THEN RETURN 0; END IF;
  FOR v_member IN SELECT * FROM group_members WHERE group_id = p_group_id AND status = 'ACTIVE'
  LOOP
    INSERT INTO kas_payments (group_id, merchant_id, amount, payment_month, payment_year, status)
    VALUES (p_group_id, v_member.merchant_id, v_group.monthly_fee, p_month, p_year, 'UNPAID')
    ON CONFLICT (group_id, merchant_id, payment_month, payment_year) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_verifikator_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_merchant RECORD; v_package RECORD; v_commission INTEGER;
BEGIN
  IF NEW.payment_status = 'PAID' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'PAID') THEN
    SELECT * INTO v_merchant FROM merchants WHERE id = NEW.merchant_id;
    IF v_merchant.verifikator_id IS NOT NULL THEN
      SELECT * INTO v_package FROM transaction_packages WHERE id = NEW.package_id;
      v_commission := FLOOR(NEW.payment_amount * v_package.group_commission_percent / 100);
      IF v_commission > 0 THEN
        INSERT INTO verifikator_earnings (verifikator_id, merchant_id, subscription_id, package_id, package_amount, commission_percent, commission_amount, status)
        VALUES (v_merchant.verifikator_id, NEW.merchant_id, NEW.id, NEW.package_id, NEW.payment_amount, v_package.group_commission_percent, v_commission, 'PENDING');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_verifikator_withdrawal(p_withdrawal_id uuid, p_status text, p_admin_notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_withdrawal RECORD; v_total_pending INTEGER;
BEGIN
  SELECT * INTO v_withdrawal FROM verifikator_withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v_withdrawal.status != 'PENDING' THEN RAISE EXCEPTION 'Already processed'; END IF;
  IF p_status = 'APPROVED' THEN
    SELECT COALESCE(SUM(commission_amount), 0) INTO v_total_pending FROM verifikator_earnings WHERE verifikator_id = v_withdrawal.verifikator_id AND status = 'PENDING';
    IF v_total_pending < v_withdrawal.amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    WITH earnings_to_pay AS (
      SELECT id, commission_amount, SUM(commission_amount) OVER (ORDER BY created_at) as running_total
      FROM verifikator_earnings WHERE verifikator_id = v_withdrawal.verifikator_id AND status = 'PENDING' ORDER BY created_at
    ) UPDATE verifikator_earnings SET status = 'PAID', paid_at = now() WHERE id IN (SELECT id FROM earnings_to_pay WHERE running_total <= v_withdrawal.amount);
  END IF;
  UPDATE verifikator_withdrawals SET status = p_status, admin_notes = p_admin_notes, processed_by = auth.uid(), processed_at = now(), updated_at = now() WHERE id = p_withdrawal_id;
  RETURN TRUE;
END;
$$;

-- ============================================================
-- BAGIAN 7: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kas_payments ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.courier_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halal_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BAGIAN 8: RLS POLICIES (Drop dulu semua, lalu buat ulang)
-- ============================================================

-- Drop semua policy yang ada
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- === PROFILES ===
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id AND is_blocked = false);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR ALL USING (is_admin());
CREATE POLICY "Service role profiles" ON public.profiles FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- === USER ROLES ===
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (is_admin());
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update user roles" ON public.user_roles FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE USING (is_admin());

-- === VILLAGES ===
CREATE POLICY "Anyone can view active villages" ON public.villages FOR SELECT USING (is_active = true);
CREATE POLICY "Village owners can view own village" ON public.villages FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Authenticated users can register village" ON public.villages FOR INSERT TO authenticated WITH CHECK (registration_status = 'PENDING' AND is_active = false);
CREATE POLICY "Admins can manage villages" ON public.villages FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Village owners can update own village" ON public.villages FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin desa can update own village" ON public.villages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM user_villages uv WHERE uv.village_id = villages.id AND uv.user_id = auth.uid()));

-- === USER VILLAGES ===
CREATE POLICY "Admins manage village assignments" ON public.user_villages FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users view own village assignments" ON public.user_villages FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Users can register own village assignment" ON public.user_villages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- === CATEGORIES ===
CREATE POLICY "Anyone can view active categories" ON public.categories FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (is_admin());

-- === TRADE GROUPS ===
CREATE POLICY "Anyone can view active groups" ON public.trade_groups FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage all groups" ON public.trade_groups FOR ALL USING (is_admin());
CREATE POLICY "Verifikators can manage own groups" ON public.trade_groups FOR ALL USING (verifikator_id = auth.uid() OR is_admin());

-- === TRANSACTION PACKAGES ===
CREATE POLICY "Anyone can view active packages" ON public.transaction_packages FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage packages" ON public.transaction_packages FOR ALL USING (is_admin());

-- === MERCHANTS ===
CREATE POLICY "Admins can manage merchants" ON public.merchants FOR ALL USING (is_admin());
CREATE POLICY "Verifikator can manage merchants" ON public.merchants FOR ALL USING (is_verifikator());
CREATE POLICY "Merchants can view own data" ON public.merchants FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Merchants can update own data" ON public.merchants FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Anyone can register merchant" ON public.merchants FOR INSERT WITH CHECK (registration_status = 'PENDING' AND status = 'PENDING');
CREATE POLICY "Authenticated users view active merchants" ON public.merchants FOR SELECT USING ((user_id = auth.uid()) OR ((status = 'ACTIVE' AND registration_status = 'APPROVED' AND auth.uid() IS NOT NULL)) OR is_admin() OR is_verifikator());
CREATE POLICY "Anon can view basic merchant info" ON public.merchants FOR SELECT TO anon USING (status = 'ACTIVE' AND registration_status = 'APPROVED');

-- === MERCHANT SUBSCRIPTIONS ===
CREATE POLICY "Admins can manage all subscriptions" ON public.merchant_subscriptions FOR ALL USING (is_admin());
CREATE POLICY "Merchants can view own subscriptions" ON public.merchant_subscriptions FOR SELECT USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = merchant_subscriptions.merchant_id AND merchants.user_id = auth.uid()));
CREATE POLICY "Merchants can create subscriptions" ON public.merchant_subscriptions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = merchant_subscriptions.merchant_id AND merchants.user_id = auth.uid()) AND status = 'PENDING');

-- === GROUP MEMBERS ===
CREATE POLICY "Admins can manage all members" ON public.group_members FOR ALL USING (is_admin());
CREATE POLICY "Merchants can view own membership" ON public.group_members FOR SELECT USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = group_members.merchant_id AND merchants.user_id = auth.uid()));
CREATE POLICY "Verifikators can manage group members" ON public.group_members FOR ALL USING (EXISTS (SELECT 1 FROM trade_groups WHERE trade_groups.id = group_members.group_id AND (trade_groups.verifikator_id = auth.uid() OR is_admin())));

-- === KAS PAYMENTS ===
CREATE POLICY "Admins can manage all payments" ON public.kas_payments FOR ALL USING (is_admin());
CREATE POLICY "Merchants can view own payments" ON public.kas_payments FOR SELECT USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = kas_payments.merchant_id AND merchants.user_id = auth.uid()));
CREATE POLICY "Verifikators can manage payments in their groups" ON public.kas_payments FOR ALL USING (EXISTS (SELECT 1 FROM trade_groups WHERE trade_groups.id = kas_payments.group_id AND (trade_groups.verifikator_id = auth.uid() OR is_admin())));

-- === PRODUCTS ===
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (is_admin());
CREATE POLICY "Merchants can manage own products" ON public.products FOR ALL USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid()));

-- === PRODUCT IMAGES ===
CREATE POLICY "Anyone can view product images" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Admins can manage all product images" ON public.product_images FOR ALL USING (is_admin());
CREATE POLICY "Merchants can manage their product images" ON public.product_images FOR ALL USING (EXISTS (SELECT 1 FROM products p JOIN merchants m ON p.merchant_id = m.id WHERE p.id = product_images.product_id AND m.user_id = auth.uid()));

-- === PRODUCT VARIANTS ===
CREATE POLICY "Anyone can view active product variants" ON public.product_variants FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage all product variants" ON public.product_variants FOR ALL USING (is_admin());
CREATE POLICY "Merchants can manage their product variants" ON public.product_variants FOR ALL USING (EXISTS (SELECT 1 FROM products p JOIN merchants m ON p.merchant_id = m.id WHERE p.id = product_variants.product_id AND m.user_id = auth.uid()));

-- === QUOTA TIERS ===
CREATE POLICY "Anyone can view quota tiers" ON public.quota_tiers FOR SELECT USING (true);
CREATE POLICY "Admins can manage quota tiers" ON public.quota_tiers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- === TOURISM ===
CREATE POLICY "Anyone can view active tourism" ON public.tourism FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage tourism" ON public.tourism FOR ALL USING (is_admin());
CREATE POLICY "Admin desa can manage tourism" ON public.tourism FOR ALL USING (EXISTS (SELECT 1 FROM villages WHERE villages.id = tourism.village_id AND villages.registration_status = 'APPROVED') AND is_admin_desa()) WITH CHECK (EXISTS (SELECT 1 FROM villages WHERE villages.id = tourism.village_id AND villages.registration_status = 'APPROVED') AND is_admin_desa());

-- === COURIERS ===
CREATE POLICY "Admins can manage couriers" ON public.couriers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Verifikator can manage couriers" ON public.couriers FOR ALL TO authenticated USING (has_role(auth.uid(), 'verifikator'));
CREATE POLICY "Anyone can register as courier" ON public.couriers FOR INSERT TO authenticated WITH CHECK (registration_status = 'PENDING' AND status = 'INACTIVE');
CREATE POLICY "Couriers can view own data" ON public.couriers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Couriers can update own location" ON public.couriers FOR UPDATE TO authenticated USING (user_id = auth.uid() AND status = 'ACTIVE');
CREATE POLICY "Public can view approved couriers" ON public.couriers FOR SELECT TO authenticated USING (registration_status = 'APPROVED' AND status = 'ACTIVE');

-- === ORDERS ===
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Buyers can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyers can view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = buyer_id);
CREATE POLICY "Buyers can update own orders" ON public.orders FOR UPDATE USING (auth.uid() = buyer_id AND status IN ('NEW','PENDING_PAYMENT','DELIVERED')) WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Merchants can view own orders" ON public.orders FOR SELECT TO authenticated USING (is_order_merchant(auth.uid(), merchant_id));
CREATE POLICY "Merchants can update own orders" ON public.orders FOR UPDATE TO authenticated USING (is_order_merchant(auth.uid(), merchant_id));
CREATE POLICY "Couriers can view assigned orders" ON public.orders FOR SELECT TO authenticated USING (is_courier_owner(auth.uid(), courier_id));
CREATE POLICY "Couriers can update assigned orders" ON public.orders FOR UPDATE TO authenticated USING (is_courier_owner(auth.uid(), courier_id));

-- === ORDER ITEMS ===
CREATE POLICY "Users can insert order items for own orders" ON public.order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.buyer_id = auth.uid()));
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.buyer_id = auth.uid() OR is_admin())));
CREATE POLICY "Merchants can view order items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM orders o JOIN merchants m ON o.merchant_id = m.id WHERE o.id = order_items.order_id AND m.user_id = auth.uid()));
CREATE POLICY "Couriers can view order items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM orders o JOIN couriers c ON o.courier_id = c.id WHERE o.id = order_items.order_id AND c.user_id = auth.uid()));

-- === FLASH SALES ===
CREATE POLICY "Public can view active flash sales" ON public.flash_sales FOR SELECT USING (status = 'ACTIVE' AND end_time > now());
CREATE POLICY "Admins can manage all flash sales" ON public.flash_sales FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "Merchants can manage their flash sales" ON public.flash_sales FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- === REVIEWS ===
CREATE POLICY "Anyone can view visible reviews" ON public.reviews FOR SELECT USING (is_visible = true);
CREATE POLICY "Buyers can create reviews for their orders" ON public.reviews FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Merchants can reply to their reviews" ON public.reviews FOR UPDATE USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = reviews.merchant_id AND merchants.user_id = auth.uid()));
CREATE POLICY "Admins can manage reviews" ON public.reviews FOR ALL USING (is_admin());

-- === REFUND REQUESTS ===
CREATE POLICY "Admins can manage refunds" ON public.refund_requests FOR ALL USING (is_admin());
CREATE POLICY "Buyers can create refund requests" ON public.refund_requests FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Buyers can view own refunds" ON public.refund_requests FOR SELECT USING (buyer_id = auth.uid());
CREATE POLICY "Merchants can view refunds for their orders" ON public.refund_requests FOR SELECT USING (EXISTS (SELECT 1 FROM orders o JOIN merchants m ON o.merchant_id = m.id WHERE o.id = refund_requests.order_id AND m.user_id = auth.uid()));

-- === WITHDRAWAL REQUESTS ===
CREATE POLICY "Admins can manage withdrawals" ON public.withdrawal_requests FOR ALL USING (is_admin());
CREATE POLICY "Merchants can create withdrawals" ON public.withdrawal_requests FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = withdrawal_requests.merchant_id AND merchants.user_id = auth.uid()) AND status = 'PENDING');
CREATE POLICY "Merchants can view own withdrawals" ON public.withdrawal_requests FOR SELECT USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = withdrawal_requests.merchant_id AND merchants.user_id = auth.uid()));

-- === COURIER EARNINGS ===
CREATE POLICY "Admins can manage courier earnings" ON public.courier_earnings FOR ALL USING (is_admin());
CREATE POLICY "Couriers can view own earnings" ON public.courier_earnings FOR SELECT USING (EXISTS (SELECT 1 FROM couriers WHERE couriers.id = courier_earnings.courier_id AND couriers.user_id = auth.uid()));

-- === COURIER WITHDRAWAL REQUESTS ===
CREATE POLICY "Admins full access courier withdrawals" ON public.courier_withdrawal_requests FOR ALL USING (is_admin());
CREATE POLICY "Couriers can view own withdrawals" ON public.courier_withdrawal_requests FOR SELECT USING (courier_id = get_user_courier_id());
CREATE POLICY "Couriers can create own withdrawals" ON public.courier_withdrawal_requests FOR INSERT WITH CHECK (courier_id = get_user_courier_id());

-- === PLATFORM FEES ===
CREATE POLICY "Admins can manage platform_fees" ON public.platform_fees FOR ALL USING (is_admin());
CREATE POLICY "Merchants can view own fees" ON public.platform_fees FOR SELECT USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = platform_fees.merchant_id AND merchants.user_id = auth.uid()));

-- === INSURANCE FUND ===
CREATE POLICY "Admins can manage insurance fund" ON public.insurance_fund FOR ALL USING (is_admin());
CREATE POLICY "Merchants can view own insurance" ON public.insurance_fund FOR SELECT USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = insurance_fund.merchant_id AND merchants.user_id = auth.uid()));
CREATE POLICY "Merchants can create claims" ON public.insurance_fund FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = insurance_fund.merchant_id AND merchants.user_id = auth.uid()) AND type = 'claim' AND status = 'PENDING');

-- === VERIFIKATOR CODES ===
CREATE POLICY "Anyone can view active codes" ON public.verifikator_codes FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage all codes" ON public.verifikator_codes FOR ALL USING (is_admin());
CREATE POLICY "Verifikator can manage own codes" ON public.verifikator_codes FOR ALL USING (verifikator_id = auth.uid() OR is_admin());

-- === VERIFIKATOR EARNINGS ===
CREATE POLICY "Admins can manage all earnings" ON public.verifikator_earnings FOR ALL USING (is_admin());
CREATE POLICY "Verifikators can view own earnings" ON public.verifikator_earnings FOR SELECT USING (verifikator_id = auth.uid());

-- === VERIFIKATOR WITHDRAWALS ===
CREATE POLICY "Admins manage withdrawals" ON public.verifikator_withdrawals FOR ALL USING (is_admin());
CREATE POLICY "Verifikators can create withdrawals" ON public.verifikator_withdrawals FOR INSERT WITH CHECK (verifikator_id = auth.uid() AND status = 'PENDING');
CREATE POLICY "Verifikators view own withdrawals" ON public.verifikator_withdrawals FOR SELECT USING (verifikator_id = auth.uid() OR is_admin());

-- === GROUP ANNOUNCEMENTS ===
CREATE POLICY "Verifikator can manage own announcements" ON public.group_announcements FOR ALL USING (verifikator_id = auth.uid());
CREATE POLICY "Group members can read announcements" ON public.group_announcements FOR SELECT USING (EXISTS (SELECT 1 FROM group_members gm JOIN merchants m ON m.id = gm.merchant_id WHERE gm.group_id = group_announcements.group_id AND m.user_id = auth.uid()));

-- === VOUCHERS ===
CREATE POLICY "Vouchers viewable by everyone" ON public.vouchers FOR SELECT USING (is_active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));
CREATE POLICY "Admins manage all vouchers" ON public.vouchers FOR ALL USING (is_admin());
CREATE POLICY "Merchants manage own vouchers" ON public.vouchers FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()) OR is_admin());

-- === VOUCHER USAGES ===
CREATE POLICY "Users can use vouchers" ON public.voucher_usages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users view own usage" ON public.voucher_usages FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- === PROMOTIONS ===
CREATE POLICY "Anyone can view active promotions" ON public.promotions FOR SELECT USING (is_active = true AND is_approved = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));
CREATE POLICY "Admins can manage promotions" ON public.promotions FOR ALL USING (is_admin());
CREATE POLICY "Merchants can create own promotions" ON public.promotions FOR INSERT WITH CHECK (advertiser_type = 'merchant' AND is_approved = false);
CREATE POLICY "Villages can create own promotions" ON public.promotions FOR INSERT WITH CHECK (advertiser_type = 'village' AND is_approved = false);

-- === NOTIFICATIONS ===
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can receive notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR is_admin());
CREATE POLICY "Admins can manage all notifications" ON public.notifications FOR ALL USING (is_admin());

-- === BROADCAST NOTIFICATIONS ===
CREATE POLICY "Admins can manage broadcasts" ON public.broadcast_notifications FOR ALL USING (is_admin());

-- === CHAT MESSAGES ===
CREATE POLICY "Users can view own chat messages" ON public.chat_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send chat messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update own messages read status" ON public.chat_messages FOR UPDATE USING (auth.uid() = receiver_id);
CREATE POLICY "Admins can manage all chat messages" ON public.chat_messages FOR ALL USING (is_admin());

-- === WISHLISTS ===
CREATE POLICY "Users can view own wishlists" ON public.wishlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to own wishlist" ON public.wishlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from own wishlist" ON public.wishlists FOR DELETE USING (auth.uid() = user_id);

-- === SAVED ADDRESSES ===
CREATE POLICY "Users can view own addresses" ON public.saved_addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own addresses" ON public.saved_addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses" ON public.saved_addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses" ON public.saved_addresses FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role saved_addresses" ON public.saved_addresses FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- === PUSH SUBSCRIPTIONS ===
CREATE POLICY "Users can view their own push subscriptions" ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own push subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own push subscriptions" ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own push subscriptions" ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- === APP SETTINGS ===
CREATE POLICY "Anyone can view settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL USING (is_admin());

-- === ADMIN AUDIT LOGS ===
CREATE POLICY "Admins can view logs" ON public.admin_audit_logs FOR SELECT USING (is_admin());
CREATE POLICY "Admins can insert logs" ON public.admin_audit_logs FOR INSERT WITH CHECK (is_admin());

-- === BACKUP LOGS ===
CREATE POLICY "Admins view backups" ON public.backup_logs FOR SELECT USING (is_admin());
CREATE POLICY "Admins create backups" ON public.backup_logs FOR INSERT WITH CHECK (is_admin());

-- === BACKUP SCHEDULES ===
CREATE POLICY "Admins can manage backup schedules" ON public.backup_schedules FOR ALL USING (is_admin());

-- === PASSWORD RESET TOKENS ===
CREATE POLICY "Users can verify their tokens" ON public.password_reset_tokens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Password reset token insert" ON public.password_reset_tokens FOR INSERT TO anon, authenticated WITH CHECK (email IS NOT NULL AND token IS NOT NULL AND expires_at > now());
CREATE POLICY "Tokens can be marked as used" ON public.password_reset_tokens FOR UPDATE TO anon, authenticated USING (used_at IS NULL AND expires_at > now());

-- === RATE LIMITS ===
CREATE POLICY "Rate limits managed by functions" ON public.rate_limits FOR SELECT USING (identifier = auth.uid()::text OR is_admin());
CREATE POLICY "Users can insert own rate limits" ON public.rate_limits FOR INSERT TO authenticated WITH CHECK (identifier = auth.uid()::text);
CREATE POLICY "Users can update own rate limits" ON public.rate_limits FOR UPDATE TO authenticated USING (identifier = auth.uid()::text);

-- === SEO SETTINGS ===
CREATE POLICY "Anyone can view SEO settings" ON public.seo_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage SEO" ON public.seo_settings FOR ALL USING (is_admin());

-- === QUOTA USAGE LOGS ===
CREATE POLICY "Admin can view all quota logs" ON public.quota_usage_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Merchant can view own quota logs" ON public.quota_usage_logs FOR SELECT TO authenticated USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));
CREATE POLICY "Authenticated users can insert quota logs" ON public.quota_usage_logs FOR INSERT TO authenticated WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- === PAGE VIEWS ===
CREATE POLICY "Anyone can insert page views" ON public.page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Merchants can view own page views" ON public.page_views FOR SELECT USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = page_views.merchant_id AND merchants.user_id = auth.uid()) OR is_admin());

-- === HALAL REGULATIONS ===
CREATE POLICY "Anyone can read halal_regulations" ON public.halal_regulations FOR SELECT USING (true);
CREATE POLICY "Admin can manage halal_regulations" ON public.halal_regulations FOR ALL USING (is_admin());

-- === POS PACKAGES ===
CREATE POLICY "Anyone can view active POS packages" ON public.pos_packages FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage POS packages" ON public.pos_packages FOR ALL USING (is_admin());

-- === POS SETTINGS ===
CREATE POLICY "Merchants can manage own POS settings" ON public.pos_settings FOR ALL USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = pos_settings.merchant_id AND merchants.user_id = auth.uid()));
CREATE POLICY "Admins can manage all POS settings" ON public.pos_settings FOR ALL USING (is_admin());

-- === POS SUBSCRIPTIONS ===
CREATE POLICY "Merchants can view own POS subscriptions" ON public.pos_subscriptions FOR SELECT USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = pos_subscriptions.merchant_id AND merchants.user_id = auth.uid()));
CREATE POLICY "Merchants can create POS subscriptions" ON public.pos_subscriptions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = pos_subscriptions.merchant_id AND merchants.user_id = auth.uid()));
CREATE POLICY "Merchants can update own POS subscriptions" ON public.pos_subscriptions FOR UPDATE USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = pos_subscriptions.merchant_id AND merchants.user_id = auth.uid()));
CREATE POLICY "Admins can manage all POS subscriptions" ON public.pos_subscriptions FOR ALL USING (is_admin());

-- === POS TRANSACTIONS ===
CREATE POLICY "Merchants can manage own POS transactions" ON public.pos_transactions FOR ALL USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = pos_transactions.merchant_id AND merchants.user_id = auth.uid()));
CREATE POLICY "Admins can view all POS transactions" ON public.pos_transactions FOR SELECT USING (is_admin());

-- ============================================================
-- BAGIAN 9: TRIGGERS
-- ============================================================

-- Auto-update timestamps
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_villages_updated_at ON public.villages;
CREATE TRIGGER update_villages_updated_at BEFORE UPDATE ON public.villages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchants_updated_at ON public.merchants;
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchant_subscriptions_updated_at ON public.merchant_subscriptions;
CREATE TRIGGER update_merchant_subscriptions_updated_at BEFORE UPDATE ON public.merchant_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_couriers_updated_at ON public.couriers;
CREATE TRIGGER update_couriers_updated_at BEFORE UPDATE ON public.couriers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promotions_updated_at ON public.promotions;
CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_addresses_updated_at ON public.saved_addresses;
CREATE TRIGGER update_saved_addresses_updated_at BEFORE UPDATE ON public.saved_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kas_payments_updated_at ON public.kas_payments;
CREATE TRIGGER update_kas_payments_updated_at BEFORE UPDATE ON public.kas_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trade_groups_updated_at ON public.trade_groups;
CREATE TRIGGER update_trade_groups_updated_at BEFORE UPDATE ON public.trade_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transaction_packages_updated_at ON public.transaction_packages;
CREATE TRIGGER update_transaction_packages_updated_at BEFORE UPDATE ON public.transaction_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quota_tiers_updated_at ON public.quota_tiers;
CREATE TRIGGER update_quota_tiers_updated_at BEFORE UPDATE ON public.quota_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_refund_requests_updated_at ON public.refund_requests;
CREATE TRIGGER update_refund_requests_updated_at BEFORE UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_seo_settings_updated_at ON public.seo_settings;
CREATE TRIGGER update_seo_settings_updated_at BEFORE UPDATE ON public.seo_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Business triggers
DROP TRIGGER IF EXISTS order_notification_trigger ON public.orders;
CREATE TRIGGER order_notification_trigger AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION notify_order_change();

DROP TRIGGER IF EXISTS trigger_set_auto_complete_deadline ON public.orders;
CREATE TRIGGER trigger_set_auto_complete_deadline BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_auto_complete_deadline();

DROP TRIGGER IF EXISTS trigger_update_trust_score ON public.orders;
CREATE TRIGGER trigger_update_trust_score AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_trust_score();

DROP TRIGGER IF EXISTS merchant_verification_trigger ON public.merchants;
CREATE TRIGGER merchant_verification_trigger AFTER UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION notify_merchant_verification();

DROP TRIGGER IF EXISTS trigger_auto_assign_merchant_group ON public.merchants;
CREATE TRIGGER trigger_auto_assign_merchant_group BEFORE INSERT OR UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION auto_assign_merchant_to_group();

DROP TRIGGER IF EXISTS trigger_record_verifikator_commission ON public.merchant_subscriptions;
CREATE TRIGGER trigger_record_verifikator_commission AFTER INSERT OR UPDATE ON public.merchant_subscriptions FOR EACH ROW EXECUTE FUNCTION record_verifikator_commission();

-- Auth trigger (handle_new_user)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- BAGIAN 10: STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('merchant-images', 'merchant-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('village-images', 'village-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('tourism-images', 'tourism-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('courier-documents', 'courier-documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('pod-images', 'pod-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('review-images', 'review-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('promotions', 'promotions', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-assets', 'admin-assets', true) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- BAGIAN 11: REALTIME
-- ============================================================

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.couriers; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- BAGIAN 12: DEFAULT DATA
-- ============================================================

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

-- ============================================================
-- SELESAI!
-- ============================================================
```
