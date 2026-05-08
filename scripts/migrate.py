#!/usr/bin/env python3
"""
DesaMart — Database Migration Script
Adapts Supabase migrations to plain PostgreSQL (Replit environment).
"""
import os, sys, glob, re, subprocess

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

MIGRATION_DIRS = ["supabase/migrations"]

def clean_sql(sql: str) -> str:
    lines = sql.split("\n")
    cleaned = []
    for line in lines:
        if "ALTER PUBLICATION supabase_realtime" in line:
            cleaned.append("-- SKIPPED: " + line); continue
        if re.search(r"GRANT .* TO (authenticated|anon)\b", line, re.IGNORECASE):
            cleaned.append("-- SKIPPED: " + line); continue
        if re.search(r"REVOKE .* FROM (authenticated|anon)\b", line, re.IGNORECASE):
            cleaned.append("-- SKIPPED: " + line); continue
        if "storage.buckets" in line or "storage.objects" in line:
            cleaned.append("-- SKIPPED: " + line); continue
        if "supabase_storage_admin" in line:
            cleaned.append("-- SKIPPED: " + line); continue
        if "WITH (security_invoker=on)" in line:
            line = line.replace("WITH (security_invoker=on)", "")
        line = line.replace("auth.users", "public.users")
        line = line.replace("auth.uid()", "public.current_user_id()")
        line = re.sub(r"\s+TO\s+authenticated\b", "", line)
        line = re.sub(r"\s+TO\s+anon\b", "", line)
        cleaned.append(line)
    return "\n".join(cleaned)

def run_sql_str(sql, label=""):
    result = subprocess.run(["psql", DATABASE_URL, "-c", sql, "--set=ON_ERROR_STOP=0"], capture_output=True, text=True)
    errs = [l for l in result.stderr.split("\n") if "ERROR" in l and "already exists" not in l]
    if errs and label:
        for e in errs[:3]: print(f"  {label} warn: {e[:150]}")
    return errs

def run_sql_file(path, label=""):
    result = subprocess.run(["psql", DATABASE_URL, "-f", path, "--set=ON_ERROR_STOP=0"], capture_output=True, text=True)
    errs = [l for l in result.stderr.split("\n") if "ERROR" in l and "already exists" not in l and "multiple primary keys" not in l]
    if errs:
        print(f"  ⚠ {label or path} ({len(errs)} warnings):")
        for e in errs[:3]: print(f"    {e[:120]}")
    return errs

def bootstrap_schema():
    print("→ Bootstrapping schema...")
    sql = """
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT, password_hash TEXT, replit_id TEXT, avatar_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_replit_id ON public.users(replit_id) WHERE replit_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    raw_user_meta_data jsonb DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','buyer','merchant','verifikator','courier','admin_desa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'merchant'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'verifikator'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'courier'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_desa'; EXCEPTION WHEN others THEN NULL; END $$;
"""
    run_sql_str(sql, "bootstrap")
    print("  ✓ Done")

def run_complete_database():
    print("→ Running COMPLETE_DATABASE.md...")
    if not os.path.exists("COMPLETE_DATABASE.md"):
        print("  SKIP: not found"); return
    with open("COMPLETE_DATABASE.md", "r") as f:
        content = f.read()
    match = re.search(r"```sql\n(.*?)```", content, re.DOTALL)
    if not match:
        print("  WARN: No SQL block found"); return
    cleaned = clean_sql(match.group(1))
    with open("/tmp/complete_database.sql", "w") as f:
        f.write(cleaned)
    run_sql_file("/tmp/complete_database.sql", "COMPLETE_DATABASE")
    print("  ✓ Done")

def run_migrations():
    files = sorted(glob.glob("supabase/migrations/*.sql"), key=os.path.basename)
    print(f"→ Running {len(files)} POS migrations...")
    ok, warn = 0, 0
    for fp in files:
        fn = os.path.basename(fp)
        with open(fp, "r") as f:
            sql = f.read()
        cleaned = clean_sql(sql)
        tmp = f"/tmp/mig_{fn}"
        with open(tmp, "w") as f:
            f.write(cleaned)
        errs = run_sql_file(tmp, fn)
        if errs: warn += 1
        else: ok += 1
    print(f"  ✓ {ok} ok, {warn} with warnings")

def post_migration():
    print("→ Post-migration fixes...")
    sql = """
-- Sync trigger
CREATE OR REPLACE FUNCTION public.sync_to_auth_users() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(NEW.id,NEW.email,jsonb_build_object('full_name',NEW.full_name)) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email;
  ELSIF TG_OP = 'UPDATE' THEN INSERT INTO auth.users(id,email) VALUES(NEW.id,NEW.email) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email;
  ELSIF TG_OP = 'DELETE' THEN DELETE FROM auth.users WHERE id=OLD.id; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS sync_users_to_auth ON public.users;
CREATE TRIGGER sync_users_to_auth AFTER INSERT OR UPDATE OR DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_to_auth_users();

-- Re-point all FKs from auth.users to public.users
DO $$ BEGIN ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey; ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey; ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.merchants DROP CONSTRAINT IF EXISTS merchants_user_id_fkey; ALTER TABLE public.merchants ADD CONSTRAINT merchants_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.couriers DROP CONSTRAINT IF EXISTS couriers_user_id_fkey; ALTER TABLE public.couriers ADD CONSTRAINT couriers_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey; ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey; ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY(sender_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.wishlists DROP CONSTRAINT IF EXISTS wishlists_user_id_fkey; ALTER TABLE public.wishlists ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.saved_addresses DROP CONSTRAINT IF EXISTS saved_addresses_user_id_fkey; ALTER TABLE public.saved_addresses ADD CONSTRAINT saved_addresses_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.merchant_favorites DROP CONSTRAINT IF EXISTS merchant_favorites_user_id_fkey; ALTER TABLE public.merchant_favorites ADD CONSTRAINT merchant_favorites_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey; ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ride_requests DROP CONSTRAINT IF EXISTS ride_requests_passenger_id_fkey; ALTER TABLE public.ride_requests ADD CONSTRAINT ride_requests_passenger_id_fkey FOREIGN KEY(passenger_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.pos_tenants DROP CONSTRAINT IF EXISTS pos_tenants_user_id_fkey; ALTER TABLE public.pos_tenants ADD CONSTRAINT pos_tenants_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.pos_users DROP CONSTRAINT IF EXISTS pos_users_user_id_fkey; ALTER TABLE public.pos_users ADD CONSTRAINT pos_users_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;

-- Convert user_roles.role to TEXT (flexible)
DO $$ BEGIN ALTER TABLE public.user_roles ALTER COLUMN role TYPE TEXT USING role::TEXT; EXCEPTION WHEN others THEN NULL; END $$;

-- Columns for Cashback/Referral pages
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cashback_balance INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID;

-- Extra tables needed by the app
CREATE TABLE IF NOT EXISTS public.product_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE', interval_days integer NOT NULL DEFAULT 7,
  next_order_date timestamptz, delivery_address text, total_orders integer DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cashback_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'EARN', amount integer NOT NULL DEFAULT 0,
  description text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.seo_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), page text NOT NULL UNIQUE,
  title text, description text, keywords text, og_image text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, page text NOT NULL,
  referrer text, user_agent text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.rate_limits (
  identifier text NOT NULL, action text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  PRIMARY KEY (identifier, action, window_start)
);
CREATE TABLE IF NOT EXISTS public.merchant_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.trade_groups(id) ON DELETE SET NULL,
  amount integer NOT NULL DEFAULT 0, month integer NOT NULL, year integer NOT NULL,
  status text NOT NULL DEFAULT 'UNPAID', paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), target_type text NOT NULL DEFAULT 'global',
  target_id uuid, commission_percent numeric NOT NULL DEFAULT 5,
  is_active boolean DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.halal_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  certificate_url text NOT NULL, issued_at timestamptz, expires_at timestamptz,
  status text DEFAULT 'PENDING', verified_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  proof_url text NOT NULL, notes text, uploaded_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.product_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.merchant_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.courier_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0, proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', admin_notes TEXT, approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), processed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.courier_balance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id), type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0, balance_before NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0, description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.merchant_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL, caption TEXT, sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.courier_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL, comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id UUID REFERENCES public.villages(id) ON DELETE CASCADE,
  sender_id UUID, title TEXT NOT NULL, message TEXT NOT NULL,
  target_audience TEXT DEFAULT 'ALL', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.village_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT, image_url TEXT,
  event_date TIMESTAMPTZ, location TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Merchant ratings trigger
CREATE OR REPLACE FUNCTION public.update_merchant_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_merchant_id uuid; new_avg numeric; new_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN target_merchant_id := OLD.merchant_id;
  ELSE target_merchant_id := NEW.merchant_id; END IF;
  SELECT COALESCE(AVG(rating),0), COUNT(*) INTO new_avg, new_count FROM public.reviews WHERE merchant_id=target_merchant_id;
  UPDATE public.merchants SET rating_avg=ROUND(new_avg,1), rating_count=new_count, updated_at=now() WHERE id=target_merchant_id;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trigger_update_merchant_rating ON public.reviews;
CREATE TRIGGER trigger_update_merchant_rating AFTER INSERT OR UPDATE OR DELETE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_merchant_rating();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON public.orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON public.products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchants_registration_status ON public.merchants(registration_status);

-- App settings
INSERT INTO public.app_settings (key, value, category, description) VALUES
  ('site_name', '"DesaMart"', 'general', 'Nama aplikasi'),
  ('site_tagline', '"Marketplace UMKM & Desa Wisata"', 'general', 'Tagline'),
  ('platform_fee_percent', '5', 'payment', 'Platform fee persen'),
  ('courier_fee_per_km', '3000', 'courier', 'Biaya kurir per KM'),
  ('cod_settings', '{"max_amount":75000,"max_distance_km":3,"min_trust_score":50,"penalty_points":50,"success_bonus_points":1}', 'payment', 'Pengaturan COD'),
  ('courier_minimum_balance', '{"amount":50000}', 'courier', 'Saldo minimum kurir'),
  ('ride_fare_settings', '{"base_fare":5000,"per_km_fare":3000,"min_fare":5000,"max_fare":100000}', 'ride', 'Tarif ojek')
ON CONFLICT (key) DO NOTHING;

-- Categories
INSERT INTO public.categories (name, slug, description, icon, is_active, sort_order) VALUES
  ('Kuliner','kuliner','Makanan & minuman lokal','utensils',true,1),
  ('Fashion','fashion','Pakaian & aksesoris','shirt',true,2),
  ('Kriya','kriya','Kerajinan tangan','palette',true,3),
  ('Pertanian','pertanian','Produk pertanian','wheat',true,4),
  ('Jasa','jasa','Layanan & jasa lokal','wrench',true,5)
ON CONFLICT (slug) DO NOTHING;

-- Quota tiers
INSERT INTO public.quota_tiers (min_price, max_price, credit_cost, description, is_active, sort_order) VALUES
  (0, 50000, 1, 'Produk <= Rp 50.000', true, 1),
  (50001, 100000, 2, 'Produk Rp 50.001-100.000', true, 2),
  (100001, NULL, 3, 'Produk > Rp 100.000', true, 3)
ON CONFLICT DO NOTHING;

-- Admin user
INSERT INTO public.users (email, full_name) VALUES ('admin@desamart.id', 'Admin DesaMart') ON CONFLICT (email) DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM public.users WHERE email='admin@desamart.id' ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.profiles (user_id, full_name) SELECT id, full_name FROM public.users WHERE email='admin@desamart.id' ON CONFLICT (user_id) DO NOTHING;
INSERT INTO auth.users (id, email) SELECT id, email FROM public.users ON CONFLICT (id) DO NOTHING;
"""
    run_sql_str(sql, "post")
    print("  ✓ Done")

def verify():
    print("→ Verifying...")
    result = subprocess.run(["psql", DATABASE_URL, "-t", "-c",
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"],
        capture_output=True, text=True)
    tables = [l.strip() for l in result.stdout.strip().split("\n") if l.strip()]
    print(f"  ✓ {len(tables)} tables")
    required = ["users","user_roles","profiles","merchants","products","orders",
                "villages","couriers","notifications","app_settings","categories",
                "pos_tenants","pos_outlets","pos_products","pos_sales"]
    missing = [t for t in required if t not in tables]
    for t in required:
        print(f"    {'✓' if t in tables else '✗'} {t}")
    return len(missing) == 0

if __name__ == "__main__":
    print("=== DesaMart DB Migration ===\n")
    bootstrap_schema()
    run_complete_database()
    run_migrations()
    post_migration()
    ok = verify()
    print("\n✅ Done!" if ok else "\n⚠️  Done with missing tables")
