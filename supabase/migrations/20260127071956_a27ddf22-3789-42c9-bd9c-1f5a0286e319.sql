-- Transaction Packages Table (paket_transaksi)
CREATE TABLE public.transaction_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  classification_price TEXT NOT NULL,
  price_per_transaction INTEGER NOT NULL DEFAULT 0,
  kas_fee INTEGER NOT NULL DEFAULT 0,
  transaction_quota INTEGER NOT NULL DEFAULT 100,
  validity_days INTEGER NOT NULL DEFAULT 30,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Merchant Subscriptions Table (langganan pedagang)
CREATE TABLE public.merchant_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Enable RLS
ALTER TABLE public.transaction_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS for transaction_packages (public read, admin manage)
CREATE POLICY "Anyone can view active packages" 
ON public.transaction_packages FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage packages" 
ON public.transaction_packages FOR ALL 
USING (is_admin());

-- RLS for merchant_subscriptions
CREATE POLICY "Merchants can view own subscriptions" 
ON public.merchant_subscriptions FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM merchants 
  WHERE merchants.id = merchant_subscriptions.merchant_id 
  AND merchants.user_id = auth.uid()
));

CREATE POLICY "Merchants can create subscriptions" 
ON public.merchant_subscriptions FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM merchants 
  WHERE merchants.id = merchant_subscriptions.merchant_id 
  AND merchants.user_id = auth.uid()
) AND status = 'PENDING');

CREATE POLICY "Admins can manage all subscriptions" 
ON public.merchant_subscriptions FOR ALL 
USING (is_admin());

-- Add current_subscription_id to merchants table for quick access
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS current_subscription_id UUID REFERENCES public.merchant_subscriptions(id);

-- Create indexes
CREATE INDEX idx_merchant_subscriptions_merchant ON public.merchant_subscriptions(merchant_id);
CREATE INDEX idx_merchant_subscriptions_status ON public.merchant_subscriptions(status);
CREATE INDEX idx_transaction_packages_classification ON public.transaction_packages(classification_price);

-- Insert default packages based on classification
INSERT INTO public.transaction_packages (name, classification_price, price_per_transaction, kas_fee, transaction_quota, validity_days, description) VALUES
('Paket UMKM Mikro', 'UNDER_5K', 500, 1000, 50, 30, 'Untuk produk harga dibawah Rp 5.000'),
('Paket UMKM Kecil', 'FROM_5K_TO_10K', 750, 1500, 75, 30, 'Untuk produk harga Rp 5.000 - 10.000'),
('Paket UMKM Menengah', 'FROM_10K_TO_20K', 1000, 2000, 100, 30, 'Untuk produk harga Rp 10.000 - 20.000'),
('Paket UMKM Premium', 'ABOVE_20K', 1500, 2500, 150, 30, 'Untuk produk harga diatas Rp 20.000');

-- Function to check and decrement quota
CREATE OR REPLACE FUNCTION public.check_merchant_quota(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  -- Get active subscription
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

-- Function to use quota (call after successful order)
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

-- Trigger to update timestamps
CREATE TRIGGER update_transaction_packages_updated_at
BEFORE UPDATE ON public.transaction_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_merchant_subscriptions_updated_at
BEFORE UPDATE ON public.merchant_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();