-- Create vouchers/coupons table
CREATE TABLE public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
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

-- Create voucher usage tracking
CREATE TABLE public.voucher_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  discount_amount INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create SEO settings table
CREATE TABLE public.seo_settings (
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

-- Create backup logs table
CREATE TABLE public.backup_logs (
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

-- Create rate limit tracking table
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add unique constraint for rate limits
CREATE UNIQUE INDEX idx_rate_limits_unique ON public.rate_limits(identifier, action, window_start);

-- Add index for cleanup
CREATE INDEX idx_rate_limits_window ON public.rate_limits(window_start);

-- Enable RLS
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Voucher policies
CREATE POLICY "Vouchers viewable by everyone" ON public.vouchers
  FOR SELECT USING (is_active = true AND (start_date <= now()) AND (end_date IS NULL OR end_date >= now()));

CREATE POLICY "Merchants manage own vouchers" ON public.vouchers
  FOR ALL USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Admins manage all vouchers" ON public.vouchers
  FOR ALL USING (public.is_admin());

-- Voucher usage policies
CREATE POLICY "Users view own usage" ON public.voucher_usages
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can use vouchers" ON public.voucher_usages
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- SEO policies (admin only)
CREATE POLICY "Anyone can view SEO settings" ON public.seo_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins manage SEO" ON public.seo_settings
  FOR ALL USING (public.is_admin());

-- Backup policies (admin only)
CREATE POLICY "Admins view backups" ON public.backup_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins create backups" ON public.backup_logs
  FOR INSERT WITH CHECK (public.is_admin());

-- Rate limits policies
CREATE POLICY "Rate limits public" ON public.rate_limits
  FOR ALL USING (true);

-- Add realtime for vouchers
ALTER PUBLICATION supabase_realtime ADD TABLE public.vouchers;

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_current_count INTEGER;
BEGIN
  v_window_start := date_trunc('minute', now());
  
  -- Get current count for this window
  SELECT count INTO v_current_count
  FROM rate_limits
  WHERE identifier = p_identifier 
    AND action = p_action 
    AND window_start = v_window_start;
  
  IF v_current_count IS NULL THEN
    -- First request in this window
    INSERT INTO rate_limits (identifier, action, count, window_start)
    VALUES (p_identifier, p_action, 1, v_window_start)
    ON CONFLICT (identifier, action, window_start) DO UPDATE SET count = rate_limits.count + 1;
    
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1);
  END IF;
  
  IF v_current_count >= p_max_requests THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after', p_window_seconds);
  END IF;
  
  -- Increment count
  UPDATE rate_limits
  SET count = count + 1
  WHERE identifier = p_identifier 
    AND action = p_action 
    AND window_start = v_window_start;
  
  RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - v_current_count - 1);
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
SET search_path TO 'public'
AS $$
DECLARE
  v_voucher RECORD;
  v_usage_count INTEGER;
  v_discount INTEGER;
BEGIN
  -- Find voucher
  SELECT * INTO v_voucher
  FROM vouchers
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true
    AND start_date <= now()
    AND (end_date IS NULL OR end_date >= now());
  
  IF v_voucher IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Kode voucher tidak ditemukan atau sudah kadaluarsa');
  END IF;
  
  -- Check merchant specific
  IF v_voucher.merchant_id IS NOT NULL AND v_voucher.merchant_id != p_merchant_id THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Voucher tidak berlaku untuk toko ini');
  END IF;
  
  -- Check minimum order
  IF p_order_total < v_voucher.min_order_amount THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Minimum belanja Rp ' || v_voucher.min_order_amount);
  END IF;
  
  -- Check usage limit
  IF v_voucher.usage_limit IS NOT NULL AND v_voucher.used_count >= v_voucher.usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Voucher sudah habis');
  END IF;
  
  -- Check if user already used
  SELECT COUNT(*) INTO v_usage_count
  FROM voucher_usages
  WHERE voucher_id = v_voucher.id AND user_id = p_user_id;
  
  IF v_usage_count > 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Anda sudah menggunakan voucher ini');
  END IF;
  
  -- Calculate discount
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

-- Add triggers for updated_at
CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seo_settings_updated_at
  BEFORE UPDATE ON public.seo_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();