-- Flash Sales Table
CREATE TABLE IF NOT EXISTS public.flash_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  original_price INTEGER NOT NULL,
  flash_price INTEGER NOT NULL,
  stock_available INTEGER NOT NULL DEFAULT 1,
  stock_sold INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED', 'CANCELLED')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for flash_sales
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active flash sales" 
ON public.flash_sales FOR SELECT 
USING (status = 'ACTIVE' AND end_time > now());

CREATE POLICY "Merchants can manage their flash sales" 
ON public.flash_sales FOR ALL 
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all flash sales"
ON public.flash_sales FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Add verified badge to merchants if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'merchants' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE public.merchants ADD COLUMN is_verified BOOLEAN DEFAULT false;
    ALTER TABLE public.merchants ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.merchants ADD COLUMN verified_by UUID;
  END IF;
END $$;

-- Fix RLS policies that are too permissive
-- Drop and recreate permissive policies with proper checks

-- Fix product_variants policies
DROP POLICY IF EXISTS "Public can view product variants" ON public.product_variants;
CREATE POLICY "Public can view active product variants" 
ON public.product_variants FOR SELECT 
USING (is_active = true);

-- Fix product_images policies  
DROP POLICY IF EXISTS "Public can view product images" ON public.product_images;
CREATE POLICY "Public can view product images"
ON public.product_images FOR SELECT
USING (true);

-- Add index for flash sale queries
CREATE INDEX IF NOT EXISTS idx_flash_sales_status_end ON public.flash_sales(status, end_time);
CREATE INDEX IF NOT EXISTS idx_flash_sales_merchant ON public.flash_sales(merchant_id);

-- Enable realtime for flash_sales
ALTER PUBLICATION supabase_realtime ADD TABLE public.flash_sales;