-- Phase 6: Integrasi Marketplace & API Publik
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================================
-- TABEL SINKRONISASI PRODUK POS ↔ MARKETPLACE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pos_marketplace_sync (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  pos_product_id UUID NOT NULL REFERENCES public.pos_products(id) ON DELETE CASCADE,
  marketplace_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  -- pending, synced, error, unlinked
  sync_direction TEXT NOT NULL DEFAULT 'pos_to_market',
  -- pos_to_market, market_to_pos, both
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_stock BOOLEAN NOT NULL DEFAULT true,
  sync_price BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, pos_product_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_marketplace_sync_tenant ON public.pos_marketplace_sync(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_marketplace_sync_status ON public.pos_marketplace_sync(tenant_id, sync_status);

ALTER TABLE public.pos_marketplace_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_marketplace_sync_access" ON public.pos_marketplace_sync
  USING (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()));

-- ============================================================
-- TABEL LOG SINKRONISASI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pos_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  sync_type TEXT NOT NULL,
  -- product_sync, stock_sync, order_import, price_sync
  status TEXT NOT NULL DEFAULT 'success',
  items_processed INTEGER DEFAULT 0,
  items_success INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.pos_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_sync_logs_access" ON public.pos_sync_logs
  USING (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()));

-- ============================================================
-- TABEL ORDER MARKETPLACE YANG MASUK KE POS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pos_marketplace_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  -- pending, processed, completed, cancelled
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_marketplace_orders_tenant ON public.pos_marketplace_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_marketplace_orders_status ON public.pos_marketplace_orders(tenant_id, status);

ALTER TABLE public.pos_marketplace_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_marketplace_orders_access" ON public.pos_marketplace_orders
  USING (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()));

-- ============================================================
-- TABEL PENGATURAN INTEGRASI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pos_integration_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

ALTER TABLE public.pos_integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_integration_settings_access" ON public.pos_integration_settings
  USING (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.pos_tenants WHERE user_id = auth.uid()));
