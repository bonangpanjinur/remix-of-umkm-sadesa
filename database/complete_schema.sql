-- =====================================================
-- PLATFORM DESA WISATA & UMKM - COMPLETE DATABASE SCHEMA
-- =====================================================
-- Version: 1.0.0
-- Date: 2026-02-04
-- Description: Complete SQL schema with tables, functions, 
--              triggers, RLS policies, and dummy data
-- =====================================================

-- =====================================================
-- PART 1: EXTENSIONS & TYPES
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'admin_desa', 'merchant', 'buyer', 'verifikator', 'courier');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- PART 2: TABLES
-- =====================================================

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    address TEXT,
    village TEXT,
    avatar_url TEXT,
    province_id TEXT,
    province_name TEXT,
    city_id TEXT,
    city_name TEXT,
    district_id TEXT,
    district_name TEXT,
    village_id TEXT,
    village_name TEXT,
    address_detail TEXT,
    trust_score INTEGER DEFAULT 100,
    cod_enabled BOOLEAN DEFAULT true,
    cod_fail_count INTEGER DEFAULT 0,
    is_verified_buyer BOOLEAN DEFAULT false,
    is_blocked BOOLEAN DEFAULT false,
    blocked_by UUID,
    blocked_at TIMESTAMP WITH TIME ZONE,
    block_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'buyer',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Villages table
CREATE TABLE IF NOT EXISTS public.villages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    regency TEXT NOT NULL,
    subdistrict TEXT,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    registration_status TEXT DEFAULT 'PENDING',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID,
    rejection_reason TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    user_id UUID,
    location_lat NUMERIC,
    location_lng NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trade groups table
CREATE TABLE IF NOT EXISTS public.trade_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    village_id UUID REFERENCES public.villages(id),
    verifikator_id UUID,
    monthly_fee INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Verifikator codes table
CREATE TABLE IF NOT EXISTS public.verifikator_codes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    verifikator_id UUID NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    max_usage INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Transaction packages table
CREATE TABLE IF NOT EXISTS public.transaction_packages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    transaction_quota INTEGER NOT NULL DEFAULT 0,
    validity_days INTEGER NOT NULL DEFAULT 30,
    group_commission_percent NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Quota tiers table
CREATE TABLE IF NOT EXISTS public.quota_tiers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    min_price INTEGER NOT NULL DEFAULT 0,
    max_price INTEGER,
    credit_cost INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Merchants table
CREATE TABLE IF NOT EXISTS public.merchants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    village_id UUID REFERENCES public.villages(id),
    group_id UUID REFERENCES public.trade_groups(id),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    image_url TEXT,
    open_time TIME,
    close_time TIME,
    classification_price TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    order_mode TEXT NOT NULL DEFAULT 'ADMIN_ASSISTED',
    badge TEXT,
    rating_avg NUMERIC DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    is_open BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    registration_status TEXT NOT NULL DEFAULT 'PENDING',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID,
    rejection_reason TEXT,
    province TEXT,
    city TEXT,
    district TEXT,
    subdistrict TEXT,
    business_category TEXT DEFAULT 'kuliner',
    business_description TEXT,
    trade_group TEXT,
    verifikator_code TEXT,
    verifikator_id UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID,
    location_lat NUMERIC,
    location_lng NUMERIC,
    available_balance INTEGER DEFAULT 0,
    pending_balance INTEGER DEFAULT 0,
    total_withdrawn INTEGER DEFAULT 0,
    cod_max_amount INTEGER DEFAULT 75000,
    cod_max_distance_km NUMERIC DEFAULT 3,
    current_subscription_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Merchant subscriptions table
CREATE TABLE IF NOT EXISTS public.merchant_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    package_id UUID NOT NULL REFERENCES public.transaction_packages(id),
    transaction_quota INTEGER NOT NULL DEFAULT 0,
    used_quota INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    payment_amount INTEGER NOT NULL DEFAULT 0,
    paid_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expired_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for current_subscription_id (only if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'merchants_current_subscription_id_fkey'
    ) THEN
        ALTER TABLE public.merchants 
        ADD CONSTRAINT merchants_current_subscription_id_fkey 
        FOREIGN KEY (current_subscription_id) REFERENCES public.merchant_subscriptions(id);
    END IF;
END $$;

-- Group members table
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES public.trade_groups(id),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    UNIQUE(group_id, merchant_id)
);

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    category TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_promo BOOLEAN NOT NULL DEFAULT false,
    discount_percent INTEGER DEFAULT 0,
    discount_end_date TIMESTAMP WITH TIME ZONE,
    min_stock_alert INTEGER DEFAULT 5,
    view_count INTEGER DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product images table
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product variants table
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Couriers table
CREATE TABLE IF NOT EXISTS public.couriers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    village_id UUID REFERENCES public.villages(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    province TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    subdistrict TEXT NOT NULL,
    address TEXT NOT NULL,
    ktp_number TEXT NOT NULL,
    ktp_image_url TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'motor',
    vehicle_plate TEXT,
    vehicle_image_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'INACTIVE',
    registration_status TEXT NOT NULL DEFAULT 'PENDING',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID,
    rejection_reason TEXT,
    is_available BOOLEAN NOT NULL DEFAULT false,
    current_lat NUMERIC,
    current_lng NUMERIC,
    last_location_update TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID NOT NULL,
    merchant_id UUID REFERENCES public.merchants(id),
    courier_id UUID REFERENCES public.couriers(id),
    status TEXT NOT NULL DEFAULT 'NEW',
    handled_by TEXT NOT NULL DEFAULT 'ADMIN',
    delivery_type TEXT NOT NULL DEFAULT 'PICKUP',
    delivery_name TEXT,
    delivery_phone TEXT,
    delivery_address TEXT,
    delivery_lat NUMERIC,
    delivery_lng NUMERIC,
    notes TEXT,
    subtotal INTEGER NOT NULL DEFAULT 0,
    shipping_cost INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT,
    payment_channel TEXT,
    payment_status TEXT DEFAULT 'UNPAID',
    payment_invoice_id TEXT,
    payment_invoice_url TEXT,
    payment_paid_at TIMESTAMP WITH TIME ZONE,
    is_flash_sale BOOLEAN DEFAULT false,
    flash_sale_discount INTEGER DEFAULT 0,
    cod_service_fee INTEGER DEFAULT 0,
    buyer_distance_km NUMERIC,
    confirmation_deadline TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    pod_image_url TEXT,
    pod_notes TEXT,
    pod_uploaded_at TIMESTAMP WITH TIME ZONE,
    cod_confirmed_at TIMESTAMP WITH TIME ZONE,
    cod_rejected_at TIMESTAMP WITH TIME ZONE,
    cod_rejection_reason TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order items table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    product_name TEXT NOT NULL,
    product_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Courier earnings table
CREATE TABLE IF NOT EXISTS public.courier_earnings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    courier_id UUID NOT NULL REFERENCES public.couriers(id),
    order_id UUID REFERENCES public.orders(id),
    amount INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'DELIVERY',
    status TEXT NOT NULL DEFAULT 'PENDING',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tourism table
CREATE TABLE IF NOT EXISTS public.tourism (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    village_id UUID NOT NULL REFERENCES public.villages(id),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    location_lat NUMERIC,
    location_lng NUMERIC,
    wa_link TEXT,
    sosmed_link TEXT,
    facilities TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    product_id UUID REFERENCES public.products(id),
    merchant_id UUID REFERENCES public.merchants(id),
    order_id UUID REFERENCES public.orders(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    images TEXT[],
    is_verified BOOLEAN DEFAULT false,
    reply TEXT,
    replied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Flash sales table
CREATE TABLE IF NOT EXISTS public.flash_sales (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    product_id UUID NOT NULL REFERENCES public.products(id),
    original_price INTEGER NOT NULL,
    flash_price INTEGER NOT NULL,
    stock_available INTEGER NOT NULL DEFAULT 1,
    stock_sold INTEGER NOT NULL DEFAULT 0,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Vouchers table
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_id UUID REFERENCES public.merchants(id),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL DEFAULT 'percentage',
    discount_value INTEGER NOT NULL,
    max_discount INTEGER,
    min_order_amount INTEGER DEFAULT 0,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Voucher usages table
CREATE TABLE IF NOT EXISTS public.voucher_usages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    voucher_id UUID NOT NULL REFERENCES public.vouchers(id),
    user_id UUID NOT NULL,
    order_id UUID REFERENCES public.orders(id),
    discount_amount INTEGER NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Promotions table
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT,
    type TEXT NOT NULL,
    link_type TEXT,
    link_url TEXT,
    link_id UUID,
    advertiser_id UUID,
    advertiser_type TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT false,
    is_paid BOOLEAN DEFAULT false,
    price INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Withdrawal requests table
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    amount INTEGER NOT NULL,
    bank_name TEXT NOT NULL,
    bank_account_number TEXT NOT NULL,
    bank_account_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    processed_by UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Verifikator earnings table
CREATE TABLE IF NOT EXISTS public.verifikator_earnings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    verifikator_id UUID NOT NULL,
    merchant_id UUID REFERENCES public.merchants(id),
    subscription_id UUID REFERENCES public.merchant_subscriptions(id),
    package_id UUID REFERENCES public.transaction_packages(id),
    package_amount INTEGER NOT NULL DEFAULT 0,
    commission_percent NUMERIC NOT NULL DEFAULT 0,
    commission_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Verifikator withdrawals table
CREATE TABLE IF NOT EXISTS public.verifikator_withdrawals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    verifikator_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    bank_name TEXT NOT NULL,
    bank_account_number TEXT NOT NULL,
    bank_account_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    processed_by UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Refund requests table
CREATE TABLE IF NOT EXISTS public.refund_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id),
    buyer_id UUID NOT NULL,
    reason TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    processed_by UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    evidence_urls TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Platform fees table
CREATE TABLE IF NOT EXISTS public.platform_fees (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id),
    merchant_id UUID REFERENCES public.merchants(id),
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

-- Insurance fund table
CREATE TABLE IF NOT EXISTS public.insurance_fund (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    order_id UUID REFERENCES public.orders(id),
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    claim_reason TEXT,
    evidence_urls TEXT[] DEFAULT '{}',
    processed_by UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Kas payments table
CREATE TABLE IF NOT EXISTS public.kas_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES public.trade_groups(id),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    amount INTEGER NOT NULL,
    payment_month INTEGER NOT NULL,
    payment_year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'UNPAID',
    notes TEXT,
    payment_date TIMESTAMP WITH TIME ZONE,
    collected_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(group_id, merchant_id, payment_month, payment_year)
);

-- App settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Admin audit logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID NOT NULL,
    entity_id UUID,
    entity_type TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Backup logs table
CREATE TABLE IF NOT EXISTS public.backup_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_type TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'pending',
    tables_included TEXT[],
    file_url TEXT,
    file_size INTEGER,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID
);

-- Backup schedules table
CREATE TABLE IF NOT EXISTS public.backup_schedules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    schedule_type TEXT NOT NULL DEFAULT 'daily',
    schedule_time TIME NOT NULL DEFAULT '02:00:00',
    schedule_day INTEGER,
    tables_included TEXT[] DEFAULT ARRAY['merchants', 'products', 'orders', 'villages', 'tourism', 'couriers'],
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Broadcast notifications table
CREATE TABLE IF NOT EXISTS public.broadcast_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_audience TEXT NOT NULL DEFAULT 'ALL',
    target_roles TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    sent_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, endpoint)
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier TEXT NOT NULL,
    action TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(identifier, action, window_start)
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Saved addresses table
CREATE TABLE IF NOT EXISTS public.saved_addresses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    label TEXT NOT NULL,
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
    latitude NUMERIC,
    longitude NUMERIC,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Wishlists table
CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, product_id)
);

-- =====================================================
-- PART 3: VIEWS
-- =====================================================

-- Public merchants view (for safe public access)
CREATE OR REPLACE VIEW public.public_merchants AS
SELECT 
    id,
    name,
    image_url,
    business_category,
    business_description,
    province,
    city,
    district,
    open_time,
    close_time,
    order_mode,
    badge,
    rating_avg,
    rating_count,
    is_open,
    is_verified,
    village_id,
    ROUND(location_lat, 2) as location_lat_approx,
    ROUND(location_lng, 2) as location_lng_approx,
    CASE WHEN phone IS NOT NULL THEN CONCAT(LEFT(phone, 4), '****', RIGHT(phone, 3)) ELSE NULL END as phone_masked
FROM public.merchants
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

-- Public couriers view (for safe public access)
CREATE OR REPLACE VIEW public.public_couriers AS
SELECT 
    id,
    name,
    photo_url,
    vehicle_type,
    status,
    is_available,
    village_id,
    ROUND(current_lat, 2) as current_lat_approx,
    ROUND(current_lng, 2) as current_lng_approx,
    CASE WHEN phone IS NOT NULL THEN CONCAT(LEFT(phone, 4), '****', RIGHT(phone, 3)) ELSE NULL END as phone_masked
FROM public.couriers
WHERE status = 'ACTIVE' AND registration_status = 'APPROVED';

-- =====================================================
-- PART 4: FUNCTIONS
-- =====================================================

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any of the specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role::text), ARRAY[]::text[])
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Function to check if user is merchant
CREATE OR REPLACE FUNCTION public.is_merchant()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'merchant')
$$;

-- Function to check if user is courier
CREATE OR REPLACE FUNCTION public.is_courier()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'courier')
$$;

-- Function to check if user is verifikator
CREATE OR REPLACE FUNCTION public.is_verifikator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'verifikator')
$$;

-- Function to check if user is admin desa
CREATE OR REPLACE FUNCTION public.is_admin_desa()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin_desa')
$$;

-- Function to get user's merchant ID
CREATE OR REPLACE FUNCTION public.get_user_merchant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.merchants WHERE user_id = _user_id LIMIT 1
$$;

-- Function to get user's courier ID
CREATE OR REPLACE FUNCTION public.get_user_courier_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.couriers WHERE user_id = _user_id LIMIT 1
$$;

-- Function to check if user owns the courier
CREATE OR REPLACE FUNCTION public.is_courier_owner(_user_id UUID, _courier_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.couriers 
    WHERE id = _courier_id AND user_id = _user_id
  )
$$;

-- Function to check if user owns the merchant for order
CREATE OR REPLACE FUNCTION public.is_order_merchant(_user_id UUID, _merchant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchants 
    WHERE id = _merchant_id AND user_id = _user_id
  )
$$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'buyer');
    
    RETURN NEW;
END;
$$;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Function to send notification
CREATE OR REPLACE FUNCTION public.send_notification(
    p_user_id UUID, 
    p_title TEXT, 
    p_message TEXT, 
    p_type TEXT DEFAULT 'info', 
    p_link TEXT DEFAULT NULL
)
RETURNS UUID
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

-- Function to check merchant quota
CREATE OR REPLACE FUNCTION public.check_merchant_quota(p_merchant_id UUID)
RETURNS JSONB
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

-- Function to use merchant quota
CREATE OR REPLACE FUNCTION public.use_merchant_quota(p_merchant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function to apply voucher
CREATE OR REPLACE FUNCTION public.apply_voucher(
    p_code TEXT, 
    p_user_id UUID, 
    p_order_total INTEGER, 
    p_merchant_id UUID DEFAULT NULL
)
RETURNS JSONB
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

-- Function to check COD eligibility
CREATE OR REPLACE FUNCTION public.check_cod_eligibility(
    p_buyer_id UUID, 
    p_merchant_id UUID, 
    p_total_amount INTEGER, 
    p_distance_km NUMERIC DEFAULT NULL
)
RETURNS JSONB
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
    
    IF v_cod_settings IS NULL THEN
        v_max_amount := 75000;
        v_max_distance := 3;
        v_min_trust_score := 50;
    ELSE
        v_max_amount := COALESCE((v_cod_settings->>'max_amount')::INTEGER, 75000);
        v_max_distance := COALESCE((v_cod_settings->>'max_distance_km')::NUMERIC, 3);
        v_min_trust_score := COALESCE((v_cod_settings->>'min_trust_score')::INTEGER, 50);
    END IF;
    
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

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_identifier TEXT, 
    p_action TEXT, 
    p_max_requests INTEGER DEFAULT 10, 
    p_window_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
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

-- Function to update COD trust score
CREATE OR REPLACE FUNCTION public.update_cod_trust_score(p_buyer_id UUID, p_success BOOLEAN)
RETURNS VOID
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

-- Function to generate monthly kas
CREATE OR REPLACE FUNCTION public.generate_monthly_kas(p_group_id UUID, p_month INTEGER, p_year INTEGER)
RETURNS INTEGER
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

-- Function to record verifikator commission
CREATE OR REPLACE FUNCTION public.record_verifikator_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant RECORD;
  v_package RECORD;
  v_commission INTEGER;
BEGIN
  IF NEW.payment_status = 'PAID' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'PAID') THEN
    SELECT * INTO v_merchant FROM merchants WHERE id = NEW.merchant_id;
    
    IF v_merchant.verifikator_id IS NOT NULL THEN
      SELECT * INTO v_package FROM transaction_packages WHERE id = NEW.package_id;
      
      v_commission := FLOOR(NEW.payment_amount * v_package.group_commission_percent / 100);
      
      IF v_commission > 0 THEN
        INSERT INTO verifikator_earnings (
          verifikator_id,
          merchant_id,
          subscription_id,
          package_id,
          package_amount,
          commission_percent,
          commission_amount,
          status
        ) VALUES (
          v_merchant.verifikator_id,
          NEW.merchant_id,
          NEW.id,
          NEW.package_id,
          NEW.payment_amount,
          v_package.group_commission_percent,
          v_commission,
          'PENDING'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to process verifikator withdrawal
CREATE OR REPLACE FUNCTION public.process_verifikator_withdrawal(
    p_withdrawal_id UUID, 
    p_status TEXT, 
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal RECORD;
  v_total_pending INTEGER;
BEGIN
  SELECT * INTO v_withdrawal FROM verifikator_withdrawals WHERE id = p_withdrawal_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;
  
  IF v_withdrawal.status != 'PENDING' THEN
    RAISE EXCEPTION 'Withdrawal already processed';
  END IF;
  
  IF p_status = 'APPROVED' THEN
    SELECT COALESCE(SUM(commission_amount), 0) INTO v_total_pending
    FROM verifikator_earnings
    WHERE verifikator_id = v_withdrawal.verifikator_id AND status = 'PENDING';
    
    IF v_total_pending < v_withdrawal.amount THEN
      RAISE EXCEPTION 'Insufficient pending balance';
    END IF;
    
    WITH earnings_to_pay AS (
      SELECT id, commission_amount,
        SUM(commission_amount) OVER (ORDER BY created_at) as running_total
      FROM verifikator_earnings
      WHERE verifikator_id = v_withdrawal.verifikator_id AND status = 'PENDING'
      ORDER BY created_at
    )
    UPDATE verifikator_earnings
    SET status = 'PAID', paid_at = now()
    WHERE id IN (
      SELECT id FROM earnings_to_pay WHERE running_total <= v_withdrawal.amount
    );
  END IF;
  
  UPDATE verifikator_withdrawals
  SET 
    status = p_status,
    admin_notes = p_admin_notes,
    processed_by = auth.uid(),
    processed_at = now(),
    updated_at = now()
  WHERE id = p_withdrawal_id;
  
  RETURN TRUE;
END;
$$;

-- Function to notify on order change
CREATE OR REPLACE FUNCTION public.notify_order_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  merchant_user_id UUID;
  order_status_text TEXT;
BEGIN
  SELECT user_id INTO merchant_user_id
  FROM merchants
  WHERE id = NEW.merchant_id;

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
    PERFORM send_notification(
      NEW.buyer_id,
      'Status Pesanan Diperbarui',
      'Pesanan #' || LEFT(NEW.id::TEXT, 8) || ' ' || order_status_text,
      'order',
      '/orders/' || NEW.id
    );
  END IF;

  IF TG_OP = 'INSERT' AND merchant_user_id IS NOT NULL THEN
    PERFORM send_notification(
      merchant_user_id,
      'Pesanan Baru',
      'Anda menerima pesanan baru senilai Rp ' || NEW.total::TEXT,
      'order',
      '/merchant/orders'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Function to notify merchant verification
CREATE OR REPLACE FUNCTION public.notify_merchant_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND TG_OP = 'UPDATE' AND OLD.registration_status IS DISTINCT FROM NEW.registration_status THEN
    IF NEW.registration_status = 'APPROVED' THEN
      PERFORM send_notification(
        NEW.user_id,
        'Pendaftaran Merchant Disetujui',
        'Selamat! Toko ' || NEW.name || ' telah diverifikasi. Anda dapat mulai berjualan.',
        'success',
        '/merchant'
      );
    ELSIF NEW.registration_status = 'REJECTED' THEN
      PERFORM send_notification(
        NEW.user_id,
        'Pendaftaran Merchant Ditolak',
        'Maaf, pendaftaran toko ' || NEW.name || ' ditolak. Alasan: ' || COALESCE(NEW.rejection_reason, 'Tidak memenuhi syarat'),
        'error',
        '/register/merchant'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to notify withdrawal change
CREATE OR REPLACE FUNCTION public.notify_withdrawal_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  merchant_user_id UUID;
  status_text TEXT;
BEGIN
  SELECT user_id INTO merchant_user_id
  FROM merchants
  WHERE id = NEW.merchant_id;

  IF merchant_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'APPROVED' THEN status_text := 'disetujui';
    WHEN 'REJECTED' THEN status_text := 'ditolak';
    WHEN 'COMPLETED' THEN status_text := 'telah ditransfer';
    ELSE status_text := NEW.status;
  END CASE;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status != 'PENDING' THEN
    PERFORM send_notification(
      merchant_user_id,
      'Penarikan Saldo ' || INITCAP(status_text),
      'Permintaan penarikan Rp ' || NEW.amount::TEXT || ' telah ' || status_text,
      'withdrawal',
      '/merchant/withdrawal'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Function to notify admin new withdrawal
CREATE OR REPLACE FUNCTION public.notify_admin_new_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID;
  merchant_name TEXT;
BEGIN
  SELECT name INTO merchant_name FROM merchants WHERE id = NEW.merchant_id;

  FOR admin_id IN SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    PERFORM send_notification(
      admin_id,
      'Permintaan Penarikan Baru',
      merchant_name || ' mengajukan penarikan Rp ' || NEW.amount::TEXT,
      'withdrawal',
      '/admin/withdrawals'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Function to auto assign merchant to group
CREATE OR REPLACE FUNCTION public.auto_assign_merchant_to_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code RECORD;
  v_group RECORD;
BEGIN
  IF NEW.verifikator_code IS NOT NULL AND NEW.group_id IS NULL THEN
    SELECT * INTO v_code FROM verifikator_codes 
    WHERE code = NEW.verifikator_code AND is_active = true
    LIMIT 1;
    
    IF v_code IS NOT NULL THEN
      SELECT * INTO v_group FROM trade_groups 
      WHERE verifikator_id = v_code.verifikator_id AND is_active = true
      LIMIT 1;
      
      IF v_group IS NOT NULL THEN
        NEW.group_id := v_group.id;
        
        INSERT INTO group_members (group_id, merchant_id, status)
        VALUES (v_group.id, NEW.id, 'ACTIVE')
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to auto cancel pending orders
CREATE OR REPLACE FUNCTION public.auto_cancel_pending_orders()
RETURNS VOID
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

-- Function to update trust score on order status change
CREATE OR REPLACE FUNCTION public.update_trust_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'REJECTED_BY_BUYER' AND OLD.status != 'REJECTED_BY_BUYER' THEN
    UPDATE profiles 
    SET 
      trust_score = GREATEST(0, trust_score - 50),
      cod_fail_count = cod_fail_count + 1,
      cod_enabled = CASE WHEN trust_score - 50 < 50 THEN false ELSE cod_enabled END
    WHERE user_id = NEW.buyer_id;
  END IF;
  
  IF NEW.status = 'DONE' AND OLD.status != 'DONE' AND NEW.payment_method = 'COD' THEN
    UPDATE profiles 
    SET trust_score = LEAST(100, trust_score + 1)
    WHERE user_id = NEW.buyer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- PART 5: TRIGGERS
-- =====================================================

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_villages_updated_at BEFORE UPDATE ON public.villages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_couriers_updated_at BEFORE UPDATE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tourism_updated_at BEFORE UPDATE ON public.tourism
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Order notification triggers
CREATE TRIGGER notify_order_change_trigger
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_change();

-- Merchant verification trigger
CREATE TRIGGER notify_merchant_verification_trigger
  AFTER UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.notify_merchant_verification();

-- Withdrawal notification triggers
CREATE TRIGGER notify_withdrawal_change_trigger
  AFTER UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_withdrawal_change();

CREATE TRIGGER notify_admin_new_withdrawal_trigger
  AFTER INSERT ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_withdrawal();

-- Verifikator commission trigger
CREATE TRIGGER record_verifikator_commission_trigger
  AFTER UPDATE ON public.merchant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.record_verifikator_commission();

-- Trust score trigger
CREATE TRIGGER update_trust_score_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_trust_score();

-- =====================================================
-- PART 6: ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kas_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikator_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id AND is_blocked = false);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (is_admin());

CREATE POLICY "Service role has full access to profiles" ON public.profiles
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- =====================================================
-- USER ROLES POLICIES
-- =====================================================

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (is_admin());

-- =====================================================
-- VILLAGES POLICIES
-- =====================================================

CREATE POLICY "Anyone can view active villages" ON public.villages
  FOR SELECT USING (is_active = true AND registration_status = 'APPROVED');

CREATE POLICY "Users can view own village" ON public.villages
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can register village" ON public.villages
  FOR INSERT WITH CHECK (registration_status = 'PENDING');

CREATE POLICY "Village owners can update own data" ON public.villages
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all villages" ON public.villages
  FOR ALL USING (is_admin());

-- =====================================================
-- MERCHANTS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view active merchants" ON public.merchants
  FOR SELECT USING (status = 'ACTIVE' AND registration_status = 'APPROVED');

CREATE POLICY "Merchants can view own data" ON public.merchants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can register merchant" ON public.merchants
  FOR INSERT WITH CHECK (registration_status = 'PENDING' AND status = 'PENDING');

CREATE POLICY "Merchants can update own data" ON public.merchants
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all merchants" ON public.merchants
  FOR ALL USING (is_admin());

CREATE POLICY "Verifikators can manage merchants" ON public.merchants
  FOR ALL USING (is_verifikator());

-- =====================================================
-- PRODUCTS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Merchants can manage own products" ON public.products
  FOR ALL USING (EXISTS (
    SELECT 1 FROM merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all products" ON public.products
  FOR ALL USING (is_admin());

-- =====================================================
-- PRODUCT IMAGES POLICIES
-- =====================================================

CREATE POLICY "Anyone can view product images" ON public.product_images
  FOR SELECT USING (true);

CREATE POLICY "Merchants can manage their product images" ON public.product_images
  FOR ALL USING (EXISTS (
    SELECT 1 FROM products p JOIN merchants m ON p.merchant_id = m.id
    WHERE p.id = product_images.product_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all product images" ON public.product_images
  FOR ALL USING (is_admin());

-- =====================================================
-- PRODUCT VARIANTS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view active product variants" ON public.product_variants
  FOR SELECT USING (is_active = true);

CREATE POLICY "Merchants can manage their product variants" ON public.product_variants
  FOR ALL USING (EXISTS (
    SELECT 1 FROM products p JOIN merchants m ON p.merchant_id = m.id
    WHERE p.id = product_variants.product_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all product variants" ON public.product_variants
  FOR ALL USING (is_admin());

-- =====================================================
-- COURIERS POLICIES
-- =====================================================

CREATE POLICY "Public can view approved couriers" ON public.couriers
  FOR SELECT USING (registration_status = 'APPROVED' AND status = 'ACTIVE');

CREATE POLICY "Couriers can view own data" ON public.couriers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can register as courier" ON public.couriers
  FOR INSERT WITH CHECK (registration_status = 'PENDING' AND status = 'INACTIVE');

CREATE POLICY "Couriers can update own location" ON public.couriers
  FOR UPDATE USING (user_id = auth.uid() AND status = 'ACTIVE');

CREATE POLICY "Admins can manage all couriers" ON public.couriers
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Verifikators can manage couriers" ON public.couriers
  FOR ALL USING (has_role(auth.uid(), 'verifikator'));

-- =====================================================
-- ORDERS POLICIES
-- =====================================================

CREATE POLICY "Buyers can view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can create orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can update own pending orders" ON public.orders
  FOR UPDATE USING (auth.uid() = buyer_id AND status = 'NEW');

CREATE POLICY "Merchants can view own orders" ON public.orders
  FOR SELECT USING (is_order_merchant(auth.uid(), merchant_id));

CREATE POLICY "Merchants can update own orders" ON public.orders
  FOR UPDATE USING (is_order_merchant(auth.uid(), merchant_id));

CREATE POLICY "Couriers can view assigned orders" ON public.orders
  FOR SELECT USING (is_courier_owner(auth.uid(), courier_id));

CREATE POLICY "Couriers can update assigned orders" ON public.orders
  FOR UPDATE USING (is_courier_owner(auth.uid(), courier_id));

CREATE POLICY "Admins can manage all orders" ON public.orders
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- ORDER ITEMS POLICIES
-- =====================================================

CREATE POLICY "Users can view own order items" ON public.order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.buyer_id = auth.uid() OR is_admin())
  ));

CREATE POLICY "Users can insert order items for own orders" ON public.order_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.buyer_id = auth.uid()
  ));

-- =====================================================
-- COURIER EARNINGS POLICIES
-- =====================================================

CREATE POLICY "Couriers can view own earnings" ON public.courier_earnings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM couriers WHERE couriers.id = courier_earnings.courier_id AND couriers.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage courier earnings" ON public.courier_earnings
  FOR ALL USING (is_admin());

-- =====================================================
-- TOURISM POLICIES
-- =====================================================

CREATE POLICY "Anyone can view active tourism" ON public.tourism
  FOR SELECT USING (is_active = true);

CREATE POLICY "Village admins can manage own tourism" ON public.tourism
  FOR ALL USING (EXISTS (
    SELECT 1 FROM villages WHERE villages.id = tourism.village_id AND villages.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all tourism" ON public.tourism
  FOR ALL USING (is_admin());

-- =====================================================
-- REVIEWS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view verified reviews" ON public.reviews
  FOR SELECT USING (is_verified = true);

CREATE POLICY "Users can create reviews" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own reviews" ON public.reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Merchants can view and reply to reviews" ON public.reviews
  FOR ALL USING (EXISTS (
    SELECT 1 FROM merchants WHERE merchants.id = reviews.merchant_id AND merchants.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all reviews" ON public.reviews
  FOR ALL USING (is_admin());

-- =====================================================
-- FLASH SALES POLICIES
-- =====================================================

CREATE POLICY "Public can view active flash sales" ON public.flash_sales
  FOR SELECT USING (status = 'ACTIVE' AND end_time > now());

CREATE POLICY "Merchants can manage their flash sales" ON public.flash_sales
  FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all flash sales" ON public.flash_sales
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- =====================================================
-- VOUCHERS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view active vouchers" ON public.vouchers
  FOR SELECT USING (is_active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));

CREATE POLICY "Merchants can manage their vouchers" ON public.vouchers
  FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all vouchers" ON public.vouchers
  FOR ALL USING (is_admin());

-- =====================================================
-- VOUCHER USAGES POLICIES
-- =====================================================

CREATE POLICY "Users can view own voucher usages" ON public.voucher_usages
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create voucher usages" ON public.voucher_usages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all voucher usages" ON public.voucher_usages
  FOR SELECT USING (is_admin());

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can receive notifications" ON public.notifications
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage all notifications" ON public.notifications
  FOR ALL USING (is_admin());

-- =====================================================
-- PROMOTIONS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view active promotions" ON public.promotions
  FOR SELECT USING (is_active = true AND is_approved = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));

CREATE POLICY "Merchants can create own promotions" ON public.promotions
  FOR INSERT WITH CHECK (advertiser_type = 'merchant' AND is_approved = false);

CREATE POLICY "Villages can create own promotions" ON public.promotions
  FOR INSERT WITH CHECK (advertiser_type = 'village' AND is_approved = false);

CREATE POLICY "Admins can manage all promotions" ON public.promotions
  FOR ALL USING (is_admin());

-- =====================================================
-- WITHDRAWAL REQUESTS POLICIES
-- =====================================================

CREATE POLICY "Merchants can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM merchants WHERE merchants.id = withdrawal_requests.merchant_id AND merchants.user_id = auth.uid()
  ));

CREATE POLICY "Merchants can create withdrawals" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM merchants WHERE merchants.id = withdrawal_requests.merchant_id AND merchants.user_id = auth.uid()
  ) AND status = 'PENDING');

CREATE POLICY "Admins can manage all withdrawals" ON public.withdrawal_requests
  FOR ALL USING (is_admin());

-- =====================================================
-- VERIFIKATOR EARNINGS POLICIES
-- =====================================================

CREATE POLICY "Verifikators can view own earnings" ON public.verifikator_earnings
  FOR SELECT USING (verifikator_id = auth.uid());

CREATE POLICY "Admins can manage all verifikator earnings" ON public.verifikator_earnings
  FOR ALL USING (is_admin());

-- =====================================================
-- VERIFIKATOR WITHDRAWALS POLICIES
-- =====================================================

CREATE POLICY "Verifikators can view own withdrawals" ON public.verifikator_withdrawals
  FOR SELECT USING (verifikator_id = auth.uid());

CREATE POLICY "Verifikators can create withdrawals" ON public.verifikator_withdrawals
  FOR INSERT WITH CHECK (verifikator_id = auth.uid() AND status = 'PENDING');

CREATE POLICY "Admins can manage all verifikator withdrawals" ON public.verifikator_withdrawals
  FOR ALL USING (is_admin());

-- =====================================================
-- REFUND REQUESTS POLICIES
-- =====================================================

CREATE POLICY "Buyers can view own refund requests" ON public.refund_requests
  FOR SELECT USING (buyer_id = auth.uid());

CREATE POLICY "Buyers can create refund requests" ON public.refund_requests
  FOR INSERT WITH CHECK (buyer_id = auth.uid() AND status = 'PENDING');

CREATE POLICY "Admins can manage all refund requests" ON public.refund_requests
  FOR ALL USING (is_admin());

-- =====================================================
-- PLATFORM FEES POLICIES
-- =====================================================

CREATE POLICY "Merchants can view own fees" ON public.platform_fees
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM merchants WHERE merchants.id = platform_fees.merchant_id AND merchants.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage platform fees" ON public.platform_fees
  FOR ALL USING (is_admin());

-- =====================================================
-- INSURANCE FUND POLICIES
-- =====================================================

CREATE POLICY "Merchants can view own insurance" ON public.insurance_fund
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM merchants WHERE merchants.id = insurance_fund.merchant_id AND merchants.user_id = auth.uid()
  ));

CREATE POLICY "Merchants can create claims" ON public.insurance_fund
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM merchants WHERE merchants.id = insurance_fund.merchant_id AND merchants.user_id = auth.uid()
  ) AND type = 'claim' AND status = 'PENDING');

CREATE POLICY "Admins can manage insurance fund" ON public.insurance_fund
  FOR ALL USING (is_admin());

-- =====================================================
-- KAS PAYMENTS POLICIES
-- =====================================================

CREATE POLICY "Merchants can view own payments" ON public.kas_payments
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM merchants WHERE merchants.id = kas_payments.merchant_id AND merchants.user_id = auth.uid()
  ));

CREATE POLICY "Verifikators can manage payments in their groups" ON public.kas_payments
  FOR ALL USING (EXISTS (
    SELECT 1 FROM trade_groups WHERE trade_groups.id = kas_payments.group_id AND (trade_groups.verifikator_id = auth.uid() OR is_admin())
  ));

CREATE POLICY "Admins can manage all kas payments" ON public.kas_payments
  FOR ALL USING (is_admin());

-- =====================================================
-- MERCHANT SUBSCRIPTIONS POLICIES
-- =====================================================

CREATE POLICY "Merchants can view own subscriptions" ON public.merchant_subscriptions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM merchants WHERE merchants.id = merchant_subscriptions.merchant_id AND merchants.user_id = auth.uid()
  ));

CREATE POLICY "Merchants can create subscriptions" ON public.merchant_subscriptions
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM merchants WHERE merchants.id = merchant_subscriptions.merchant_id AND merchants.user_id = auth.uid()
  ) AND status = 'PENDING');

CREATE POLICY "Admins can manage all subscriptions" ON public.merchant_subscriptions
  FOR ALL USING (is_admin());

-- =====================================================
-- GROUP MEMBERS POLICIES
-- =====================================================

CREATE POLICY "Merchants can view own membership" ON public.group_members
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM merchants WHERE merchants.id = group_members.merchant_id AND merchants.user_id = auth.uid()
  ));

CREATE POLICY "Verifikators can manage group members" ON public.group_members
  FOR ALL USING (EXISTS (
    SELECT 1 FROM trade_groups WHERE trade_groups.id = group_members.group_id AND (trade_groups.verifikator_id = auth.uid() OR is_admin())
  ));

CREATE POLICY "Admins can manage all group members" ON public.group_members
  FOR ALL USING (is_admin());

-- =====================================================
-- TRADE GROUPS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view active trade groups" ON public.trade_groups
  FOR SELECT USING (is_active = true);

CREATE POLICY "Verifikators can manage own groups" ON public.trade_groups
  FOR ALL USING (verifikator_id = auth.uid());

CREATE POLICY "Admins can manage all trade groups" ON public.trade_groups
  FOR ALL USING (is_admin());

-- =====================================================
-- CATEGORIES POLICIES
-- =====================================================

CREATE POLICY "Anyone can view active categories" ON public.categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all categories" ON public.categories
  FOR ALL USING (is_admin());

-- =====================================================
-- QUOTA TIERS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view quota tiers" ON public.quota_tiers
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage quota tiers" ON public.quota_tiers
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- TRANSACTION PACKAGES POLICIES
-- =====================================================

CREATE POLICY "Anyone can view active packages" ON public.transaction_packages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all packages" ON public.transaction_packages
  FOR ALL USING (is_admin());

-- =====================================================
-- VERIFIKATOR CODES POLICIES
-- =====================================================

CREATE POLICY "Anyone can view active codes" ON public.verifikator_codes
  FOR SELECT USING (is_active = true);

CREATE POLICY "Verifikators can manage own codes" ON public.verifikator_codes
  FOR ALL USING (verifikator_id = auth.uid());

CREATE POLICY "Admins can manage all codes" ON public.verifikator_codes
  FOR ALL USING (is_admin());

-- =====================================================
-- APP SETTINGS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view settings" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON public.app_settings
  FOR ALL USING (is_admin());

-- =====================================================
-- ADMIN AUDIT LOGS POLICIES
-- =====================================================

CREATE POLICY "Admins can view logs" ON public.admin_audit_logs
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can insert logs" ON public.admin_audit_logs
  FOR INSERT WITH CHECK (is_admin());

-- =====================================================
-- BACKUP LOGS POLICIES
-- =====================================================

CREATE POLICY "Admins view backups" ON public.backup_logs
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins create backups" ON public.backup_logs
  FOR INSERT WITH CHECK (is_admin());

-- =====================================================
-- BACKUP SCHEDULES POLICIES
-- =====================================================

CREATE POLICY "Admins can manage backup schedules" ON public.backup_schedules
  FOR ALL USING (is_admin());

-- =====================================================
-- BROADCAST NOTIFICATIONS POLICIES
-- =====================================================

CREATE POLICY "Admins can manage broadcasts" ON public.broadcast_notifications
  FOR ALL USING (is_admin());

-- =====================================================
-- PUSH SUBSCRIPTIONS POLICIES
-- =====================================================

CREATE POLICY "Users can view their own push subscriptions" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- RATE LIMITS POLICIES
-- =====================================================

CREATE POLICY "Rate limits managed by functions" ON public.rate_limits
  FOR SELECT USING (identifier = auth.uid()::text OR is_admin());

CREATE POLICY "Users can insert own rate limits" ON public.rate_limits
  FOR INSERT WITH CHECK (identifier = auth.uid()::text);

CREATE POLICY "Users can update own rate limits" ON public.rate_limits
  FOR UPDATE USING (identifier = auth.uid()::text);

-- =====================================================
-- PASSWORD RESET TOKENS POLICIES
-- =====================================================

CREATE POLICY "Users can verify their tokens" ON public.password_reset_tokens
  FOR SELECT USING (true);

CREATE POLICY "Password reset token insert" ON public.password_reset_tokens
  FOR INSERT WITH CHECK (email IS NOT NULL AND token IS NOT NULL AND expires_at > now());

CREATE POLICY "Tokens can be marked as used" ON public.password_reset_tokens
  FOR UPDATE USING (used_at IS NULL AND expires_at > now());

-- =====================================================
-- SAVED ADDRESSES POLICIES
-- =====================================================

CREATE POLICY "Users can view own addresses" ON public.saved_addresses
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own addresses" ON public.saved_addresses
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own addresses" ON public.saved_addresses
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own addresses" ON public.saved_addresses
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- WISHLISTS POLICIES
-- =====================================================

CREATE POLICY "Users can view own wishlist" ON public.wishlists
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can add to wishlist" ON public.wishlists
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove from wishlist" ON public.wishlists
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- PART 7: STORAGE BUCKETS
-- =====================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('merchant-images', 'merchant-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('tourism-images', 'tourism-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('courier-documents', 'courier-documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('pod-images', 'pod-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('review-images', 'review-images', true) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Public can view public bucket images" ON storage.objects
  FOR SELECT USING (bucket_id IN ('product-images', 'merchant-images', 'tourism-images', 'profile-images', 'pod-images', 'review-images'));

CREATE POLICY "Authenticated users can upload to public buckets" ON storage.objects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND bucket_id IN ('product-images', 'merchant-images', 'tourism-images', 'profile-images', 'pod-images', 'review-images'));

CREATE POLICY "Users can update own uploads" ON storage.objects
  FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own uploads" ON storage.objects
  FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can upload courier documents" ON storage.objects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND bucket_id = 'courier-documents');

CREATE POLICY "Couriers can view own documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'courier-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all courier documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'courier-documents' AND is_admin());

-- =====================================================
-- PART 8: DUMMY DATA
-- =====================================================

-- Insert default categories
INSERT INTO public.categories (name, slug, description, icon, is_active, sort_order) VALUES
('Kuliner', 'kuliner', 'Makanan dan minuman khas desa', 'utensils', true, 1),
('Fashion', 'fashion', 'Pakaian dan aksesoris tradisional', 'shirt', true, 2),
('Kriya', 'kriya', 'Kerajinan tangan dan seni', 'palette', true, 3),
('Wisata', 'wisata', 'Destinasi wisata dan pengalaman', 'mountain', true, 4)
ON CONFLICT (slug) DO NOTHING;

-- Insert default quota tiers
INSERT INTO public.quota_tiers (min_price, max_price, credit_cost, description, is_active, sort_order) VALUES
(0, 3000, 1, 'Produk harga 0 - Rp 3.000', true, 1),
(3001, 5000, 2, 'Produk harga Rp 3.001 - Rp 5.000', true, 2),
(5001, 8000, 3, 'Produk harga Rp 5.001 - Rp 8.000', true, 3),
(8001, 15000, 4, 'Produk harga Rp 8.001 - Rp 15.000', true, 4),
(15001, 25000, 5, 'Produk harga Rp 15.001 - Rp 25.000', true, 5),
(25001, NULL, 6, 'Produk harga di atas Rp 25.000', true, 6)
ON CONFLICT DO NOTHING;

-- Insert default transaction packages
INSERT INTO public.transaction_packages (name, description, price, transaction_quota, validity_days, group_commission_percent, is_active, sort_order) VALUES
('Paket Starter', 'Cocok untuk pedagang baru yang ingin mencoba platform', 25000, 50, 30, 10, true, 1),
('Paket Basic', 'Paket ekonomis untuk pedagang dengan volume penjualan kecil', 50000, 150, 30, 10, true, 2),
('Paket Standard', 'Paket paling populer untuk pedagang dengan volume sedang', 100000, 400, 30, 15, true, 3),
('Paket Premium', 'Paket untuk pedagang dengan volume penjualan tinggi', 200000, 1000, 30, 20, true, 4),
('Paket Enterprise', 'Paket unlimited untuk pedagang dengan volume sangat tinggi', 500000, 5000, 30, 25, true, 5)
ON CONFLICT DO NOTHING;

-- Insert default app settings
INSERT INTO public.app_settings (key, value, description, category) VALUES
('registration', '{"merchant_enabled": true, "village_enabled": true, "courier_enabled": true}', 'Pengaturan registrasi', 'registration'),
('shipping_fee', '{"base_fee": 5000, "per_km_fee": 2000, "free_shipping_min": 50000}', 'Pengaturan ongkos kirim', 'shipping'),
('platform_fee', '{"percentage": 5, "min_fee": 500}', 'Pengaturan biaya platform', 'finance'),
('cod_settings', '{"max_amount": 75000, "max_distance_km": 3, "min_trust_score": 50, "penalty_points": 50, "success_bonus_points": 1}', 'Pengaturan COD', 'payment'),
('whitelabel', '{"site_name": "Desa Wisata & UMKM", "tagline": "Platform Belanja Produk Lokal", "primary_color": "#16a34a", "logo_url": null}', 'Pengaturan branding', 'branding'),
('address_api', '{"provider": "emsifa", "base_url": "https://www.emsifa.com/api-wilayah-indonesia/api"}', 'Pengaturan API wilayah', 'integration')
ON CONFLICT (key) DO NOTHING;

-- Insert sample villages
INSERT INTO public.villages (id, name, district, regency, description, is_active, registration_status) VALUES
('11111111-1111-1111-1111-111111111111', 'Desa Sukamaju', 'Kecamatan Cileungsi', 'Kabupaten Bogor', 'Desa wisata dengan pemandangan sawah yang indah dan tradisi budaya yang kaya', true, 'APPROVED'),
('22222222-2222-2222-2222-222222222222', 'Desa Bojong', 'Kecamatan Jonggol', 'Kabupaten Bogor', 'Desa dengan kerajinan anyaman bambu yang terkenal', true, 'APPROVED'),
('33333333-3333-3333-3333-333333333333', 'Desa Ciawi', 'Kecamatan Ciawi', 'Kabupaten Bogor', 'Desa dengan air terjun alami dan hutan pinus', true, 'APPROVED')
ON CONFLICT DO NOTHING;

-- Insert sample tourism
INSERT INTO public.tourism (village_id, name, description, location_lat, location_lng, wa_link, facilities, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'Wisata Sawah Sukamaju', 'Menikmati keindahan hamparan sawah dengan aktivitas menanam padi', -6.5234, 106.9876, 'https://wa.me/6281234567890', ARRAY['Toilet', 'Mushola', 'Warung Makan', 'Area Parkir'], true),
('22222222-2222-2222-2222-222222222222', 'Workshop Anyaman Bojong', 'Belajar membuat kerajinan anyaman bambu dari pengrajin lokal', -6.4567, 106.8765, 'https://wa.me/6281234567891', ARRAY['Toilet', 'Workshop', 'Galeri', 'Area Parkir'], true),
('33333333-3333-3333-3333-333333333333', 'Air Terjun Curug Ciawi', 'Air terjun alami dengan ketinggian 50 meter', -6.6789, 106.9234, 'https://wa.me/6281234567892', ARRAY['Toilet', 'Gazebo', 'Warung', 'Camping Ground'], true)
ON CONFLICT DO NOTHING;

-- Insert sample merchants
INSERT INTO public.merchants (id, village_id, name, address, phone, business_category, business_description, status, registration_status, is_open, province, city, district, subdistrict, location_lat, location_lng) VALUES
('aaaa1111-aaaa-1111-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', 'Warung Makan Bu Siti', 'Jl. Raya Sukamaju No. 10', '081234567890', 'kuliner', 'Warung makan dengan menu masakan Sunda autentik', 'ACTIVE', 'APPROVED', true, 'Jawa Barat', 'Kabupaten Bogor', 'Cileungsi', 'Sukamaju', -6.5234, 106.9876),
('bbbb2222-bbbb-2222-bbbb-222222222222', '11111111-1111-1111-1111-111111111111', 'Keripik Singkong Pak Udin', 'Jl. Kampung Baru No. 5', '081234567891', 'kuliner', 'Produsen keripik singkong dengan berbagai rasa', 'ACTIVE', 'APPROVED', true, 'Jawa Barat', 'Kabupaten Bogor', 'Cileungsi', 'Sukamaju', -6.5244, 106.9886),
('cccc3333-cccc-3333-cccc-333333333333', '22222222-2222-2222-2222-222222222222', 'Anyaman Bamboo Art', 'Jl. Pengrajin No. 15', '081234567892', 'kriya', 'Kerajinan anyaman bambu berkualitas tinggi', 'ACTIVE', 'APPROVED', true, 'Jawa Barat', 'Kabupaten Bogor', 'Jonggol', 'Bojong', -6.4567, 106.8765),
('dddd4444-dddd-4444-dddd-444444444444', '33333333-3333-3333-3333-333333333333', 'Kopi Ciawi', 'Jl. Perkebunan No. 8', '081234567893', 'kuliner', 'Kopi arabika dari perkebunan lokal', 'ACTIVE', 'APPROVED', true, 'Jawa Barat', 'Kabupaten Bogor', 'Ciawi', 'Ciawi Selatan', -6.6789, 106.9234)
ON CONFLICT DO NOTHING;

-- Insert sample products
INSERT INTO public.products (merchant_id, name, description, price, stock, category, is_active) VALUES
('aaaa1111-aaaa-1111-aaaa-111111111111', 'Nasi Liwet Komplit', 'Nasi liwet dengan lauk ikan teri, ayam goreng, dan sambal', 25000, 50, 'kuliner', true),
('aaaa1111-aaaa-1111-aaaa-111111111111', 'Soto Sunda', 'Soto ayam khas Sunda dengan kuah bening', 20000, 50, 'kuliner', true),
('bbbb2222-bbbb-2222-bbbb-222222222222', 'Keripik Singkong Original', 'Keripik singkong renyah tanpa MSG', 15000, 100, 'kuliner', true),
('bbbb2222-bbbb-2222-bbbb-222222222222', 'Keripik Singkong Pedas', 'Keripik singkong dengan bumbu pedas level 3', 18000, 100, 'kuliner', true),
('bbbb2222-bbbb-2222-bbbb-222222222222', 'Keripik Singkong Balado', 'Keripik singkong dengan bumbu balado', 18000, 100, 'kuliner', true),
('cccc3333-cccc-3333-cccc-333333333333', 'Tas Anyaman Bambu', 'Tas wanita dari anyaman bambu premium', 150000, 20, 'kriya', true),
('cccc3333-cccc-3333-cccc-333333333333', 'Keranjang Anyaman', 'Keranjang serbaguna dari anyaman bambu', 75000, 30, 'kriya', true),
('cccc3333-cccc-3333-cccc-333333333333', 'Tempat Tissue Anyaman', 'Tempat tissue dari anyaman bambu', 45000, 40, 'kriya', true),
('dddd4444-dddd-4444-dddd-444444444444', 'Kopi Arabika 250gr', 'Kopi arabika bubuk premium', 85000, 50, 'kuliner', true),
('dddd4444-dddd-4444-dddd-444444444444', 'Kopi Robusta 250gr', 'Kopi robusta bubuk', 65000, 50, 'kuliner', true)
ON CONFLICT DO NOTHING;

-- Insert sample couriers
INSERT INTO public.couriers (id, village_id, name, phone, province, city, district, subdistrict, address, ktp_number, ktp_image_url, photo_url, vehicle_type, vehicle_plate, vehicle_image_url, status, registration_status, is_available) VALUES
('cour1111-cour-1111-cour-111111111111', '11111111-1111-1111-1111-111111111111', 'Ahmad Kurniawan', '081345678901', 'Jawa Barat', 'Kabupaten Bogor', 'Cileungsi', 'Sukamaju', 'Jl. Kurir No. 1', '3201234567890001', 'https://placeholder.com/ktp1.jpg', 'https://placeholder.com/photo1.jpg', 'motor', 'F 1234 ABC', 'https://placeholder.com/vehicle1.jpg', 'ACTIVE', 'APPROVED', true),
('cour2222-cour-2222-cour-222222222222', '22222222-2222-2222-2222-222222222222', 'Budi Santoso', '081345678902', 'Jawa Barat', 'Kabupaten Bogor', 'Jonggol', 'Bojong', 'Jl. Kurir No. 2', '3201234567890002', 'https://placeholder.com/ktp2.jpg', 'https://placeholder.com/photo2.jpg', 'motor', 'F 5678 DEF', 'https://placeholder.com/vehicle2.jpg', 'ACTIVE', 'APPROVED', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- PART 9: INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- User roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Merchants indexes
CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON public.merchants(user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_village_id ON public.merchants(village_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON public.merchants(status);
CREATE INDEX IF NOT EXISTS idx_merchants_registration_status ON public.merchants(registration_status);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON public.products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON public.orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Couriers indexes
CREATE INDEX IF NOT EXISTS idx_couriers_user_id ON public.couriers(user_id);
CREATE INDEX IF NOT EXISTS idx_couriers_village_id ON public.couriers(village_id);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON public.couriers(status);

-- Tourism indexes
CREATE INDEX IF NOT EXISTS idx_tourism_village_id ON public.tourism(village_id);
CREATE INDEX IF NOT EXISTS idx_tourism_is_active ON public.tourism(is_active);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Flash sales indexes
CREATE INDEX IF NOT EXISTS idx_flash_sales_merchant_id ON public.flash_sales(merchant_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_product_id ON public.flash_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_status ON public.flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_flash_sales_end_time ON public.flash_sales(end_time);

-- =====================================================
-- END OF SCHEMA
-- =====================================================

-- Note: Run this SQL file in your Supabase SQL editor
-- Make sure to backup your data before running if you have existing data
