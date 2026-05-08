-- Phase 5: Loyalty, Promosi & Diskon
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================================
-- TABEL PROMOSI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pos_promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  outlet_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'discount_percent',
  -- types: discount_percent, discount_amount, buy_x_get_y, bundle, happy_hour
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  min_purchase NUMERIC DEFAULT 0,
  max_discount NUMERIC,
  -- buy_x_get_y config
  buy_qty INTEGER DEFAULT 0,
  get_qty INTEGER DEFAULT 0,
  get_product_id UUID,
  -- bundle: array of product IDs
  bundle_product_ids JSONB DEFAULT '[]',
  bundle_price NUMERIC,
  -- happy_hour
  happy_hour_start TIME,
  happy_hour_end TIME,
  happy_hour_days JSONB DEFAULT '[0,1,2,3,4,5,6]',
  -- scope
  applies_to TEXT NOT NULL DEFAULT 'all',
  -- all, specific_products, specific_categories
  product_ids JSONB DEFAULT '[]',
  category_ids JSONB DEFAULT '[]',
  -- validity
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

ALTER TABLE public.pos_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_promotions_tenant_access" ON public.pos_promotions
  USING (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()));

-- ============================================================
-- TABEL VOUCHER / KODE KUPON
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pos_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'discount_percent',
  -- types: discount_percent, discount_amount, free_shipping
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

ALTER TABLE public.pos_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_vouchers_tenant_access" ON public.pos_vouchers
  USING (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()));

-- ============================================================
-- TABEL RIWAYAT PENGGUNAAN VOUCHER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pos_voucher_usages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL REFERENCES public.pos_vouchers(id) ON DELETE CASCADE,
  sale_id UUID,
  customer_id UUID,
  customer_name TEXT,
  discount_given NUMERIC NOT NULL DEFAULT 0,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_voucher_usages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_voucher_usages_access" ON public.pos_voucher_usages
  USING (voucher_id IN (
    SELECT id FROM public.pos_vouchers
    WHERE tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid())
  ));

-- ============================================================
-- TABEL PROGRAM POIN LOYALTY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pos_loyalty_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Program Poin',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- earn: berapa rupiah untuk 1 poin
  earn_per_rupiah INTEGER NOT NULL DEFAULT 10000,
  -- redeem: berapa poin = 1 rupiah
  redeem_rate INTEGER NOT NULL DEFAULT 100,
  min_redeem_points INTEGER NOT NULL DEFAULT 100,
  max_redeem_percent INTEGER NOT NULL DEFAULT 50,
  -- point expiry in days (0 = no expiry)
  point_expiry_days INTEGER NOT NULL DEFAULT 0,
  -- tiers
  tiers JSONB DEFAULT '[
    {"name":"Bronze","min_points":0,"discount_percent":0,"color":"#92400e"},
    {"name":"Silver","min_points":500,"discount_percent":2,"color":"#6b7280"},
    {"name":"Gold","min_points":2000,"discount_percent":5,"color":"#d97706"},
    {"name":"Platinum","min_points":5000,"discount_percent":8,"color":"#7c3aed"}
  ]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_loyalty_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_loyalty_programs_access" ON public.pos_loyalty_programs
  USING (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()));

-- ============================================================
-- TABEL POIN PELANGGAN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pos_loyalty_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

ALTER TABLE public.pos_loyalty_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_loyalty_points_access" ON public.pos_loyalty_points
  USING (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()));

-- ============================================================
-- TABEL RIWAYAT TRANSAKSI POIN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pos_loyalty_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.pos_customers(id) ON DELETE CASCADE,
  sale_id UUID,
  type TEXT NOT NULL,
  -- earn, redeem, adjust, expire
  points INTEGER NOT NULL,
  -- positive = earn, negative = redeem/expire
  balance_before INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_loyalty_tx_customer ON public.pos_loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_pos_loyalty_tx_tenant ON public.pos_loyalty_transactions(tenant_id);

ALTER TABLE public.pos_loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_loyalty_transactions_access" ON public.pos_loyalty_transactions
  USING (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()));

-- ============================================================
-- Tambah kolom ke pos_sales untuk support loyalty & promo
-- ============================================================
ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS promotion_id UUID,
  ADD COLUMN IF NOT EXISTS voucher_id UUID,
  ADD COLUMN IF NOT EXISTS voucher_code TEXT,
  ADD COLUMN IF NOT EXISTS promotion_discount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_discount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_discount NUMERIC DEFAULT 0;

-- Tambah kolom poin ke pos_customers
ALTER TABLE public.pos_customers
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'Bronze';
