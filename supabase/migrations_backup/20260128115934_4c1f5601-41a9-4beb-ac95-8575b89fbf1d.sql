-- Product Variants table
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

-- Product Images table
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_variants
CREATE POLICY "Anyone can view active product variants"
ON public.product_variants FOR SELECT
USING (is_active = true);

CREATE POLICY "Merchants can manage their product variants"
ON public.product_variants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN merchants m ON p.merchant_id = m.id
    WHERE p.id = product_variants.product_id
    AND m.user_id = auth.uid()
  )
);

-- RLS Policies for product_images
CREATE POLICY "Anyone can view product images"
ON public.product_images FOR SELECT
USING (true);

CREATE POLICY "Merchants can manage their product images"
ON public.product_images FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN merchants m ON p.merchant_id = m.id
    WHERE p.id = product_images.product_id
    AND m.user_id = auth.uid()
  )
);

-- Admin policies
CREATE POLICY "Admins can manage all product variants"
ON public.product_variants FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins can manage all product images"
ON public.product_images FOR ALL
USING (public.is_admin());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON public.product_images(product_id, is_primary) WHERE is_primary = true;

-- Trigger for updated_at
CREATE TRIGGER update_product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();