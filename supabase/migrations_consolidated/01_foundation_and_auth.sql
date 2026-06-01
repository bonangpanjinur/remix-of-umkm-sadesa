-- ============================================================
-- FILE 01: FOUNDATION & AUTH
-- ============================================================
-- Berisi: Extensions, Enums, Utility Functions, Tabel Profiles,
-- User Roles, Password Reset, Rate Limits, Role helpers, dan
-- trigger handle_new_user.
-- Aman dijalankan berulang (idempotent).
-- ============================================================

-- 1. EXTENSIONS ----------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES ----------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'buyer', 'verifikator', 'merchant', 'courier', 'admin_desa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. UTILITY FUNCTIONS --------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 4. TABEL ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  email text,
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

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'buyer',
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action text NOT NULL,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (identifier, action, window_start)
);

-- 5. INDEXES -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON public.password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);

-- 6. GRANTS --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.password_reset_tokens TO anon, authenticated;
GRANT ALL ON public.password_reset_tokens TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;

-- 7. ENABLE RLS ----------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 8. ROLE HELPER FUNCTIONS ----------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
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

-- 9. RATE LIMIT FUNCTION ------------------------------------------
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_identifier text, p_action text, p_max_requests integer DEFAULT 10, p_window_seconds integer DEFAULT 60)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_window_start timestamptz; v_current_count integer;
BEGIN
  v_window_start := date_trunc('minute', now());
  SELECT count INTO v_current_count FROM public.rate_limits WHERE identifier = p_identifier AND action = p_action AND window_start = v_window_start;
  IF v_current_count IS NULL THEN
    INSERT INTO public.rate_limits (identifier, action, count, window_start) VALUES (p_identifier, p_action, 1, v_window_start)
    ON CONFLICT (identifier, action, window_start) DO UPDATE SET count = rate_limits.count + 1;
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1);
  END IF;
  IF v_current_count >= p_max_requests THEN RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after', p_window_seconds); END IF;
  UPDATE public.rate_limits SET count = count + 1 WHERE identifier = p_identifier AND action = p_action AND window_start = v_window_start;
  RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - v_current_count - 1);
END;
$$;

-- 10. AUTH TRIGGER (auto-create profile + buyer role) -------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. TRIGGERS UPDATED_AT -----------------------------------------
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. RLS POLICIES ------------------------------------------------
-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id AND is_blocked = false);

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR ALL
  USING (public.is_admin());

-- user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
CREATE POLICY "Admins can update user roles" ON public.user_roles FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE
  USING (public.is_admin());

-- password_reset_tokens
DROP POLICY IF EXISTS "Users can verify their tokens" ON public.password_reset_tokens;
CREATE POLICY "Users can verify their tokens" ON public.password_reset_tokens FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Password reset token insert" ON public.password_reset_tokens;
CREATE POLICY "Password reset token insert" ON public.password_reset_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND token IS NOT NULL AND expires_at > now());

DROP POLICY IF EXISTS "Tokens can be marked as used" ON public.password_reset_tokens;
CREATE POLICY "Tokens can be marked as used" ON public.password_reset_tokens FOR UPDATE
  TO anon, authenticated USING (used_at IS NULL AND expires_at > now());

-- rate_limits
DROP POLICY IF EXISTS "Rate limits managed by functions" ON public.rate_limits;
CREATE POLICY "Rate limits managed by functions" ON public.rate_limits FOR SELECT
  USING (identifier = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own rate limits" ON public.rate_limits;
CREATE POLICY "Users can insert own rate limits" ON public.rate_limits FOR INSERT
  TO authenticated WITH CHECK (identifier = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own rate limits" ON public.rate_limits;
CREATE POLICY "Users can update own rate limits" ON public.rate_limits FOR UPDATE
  TO authenticated USING (identifier = auth.uid()::text);
