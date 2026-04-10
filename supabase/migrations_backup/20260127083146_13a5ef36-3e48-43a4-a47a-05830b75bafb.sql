-- Add POD (Proof of Delivery) columns to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS pod_image_url TEXT,
ADD COLUMN IF NOT EXISTS pod_notes TEXT,
ADD COLUMN IF NOT EXISTS pod_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Create platform_fees table for financial tracking
CREATE TABLE IF NOT EXISTS public.platform_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Enable RLS
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

-- RLS policies for platform_fees
CREATE POLICY "Admins can manage platform_fees" ON public.platform_fees
  FOR ALL USING (is_admin());

CREATE POLICY "Merchants can view own fees" ON public.platform_fees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM merchants 
      WHERE merchants.id = platform_fees.merchant_id 
      AND merchants.user_id = auth.uid()
    )
  );

-- Create broadcast_notifications table
CREATE TABLE IF NOT EXISTS public.broadcast_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Enable RLS
ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for broadcast_notifications
CREATE POLICY "Admins can manage broadcasts" ON public.broadcast_notifications
  FOR ALL USING (is_admin());

-- Add courier earnings table
CREATE TABLE IF NOT EXISTS public.courier_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'DELIVERY',
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.courier_earnings ENABLE ROW LEVEL SECURITY;

-- RLS policies for courier_earnings
CREATE POLICY "Admins can manage courier earnings" ON public.courier_earnings
  FOR ALL USING (is_admin());

CREATE POLICY "Couriers can view own earnings" ON public.courier_earnings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM couriers 
      WHERE couriers.id = courier_earnings.courier_id 
      AND couriers.user_id = auth.uid()
    )
  );

-- Create storage bucket for POD images
INSERT INTO storage.buckets (id, name, public)
VALUES ('pod-images', 'pod-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for POD images
CREATE POLICY "Anyone can view POD images" ON storage.objects
  FOR SELECT USING (bucket_id = 'pod-images');

CREATE POLICY "Couriers can upload POD images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'pod-images' AND auth.uid() IS NOT NULL);

-- Enable realtime for orders (for courier tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_earnings;