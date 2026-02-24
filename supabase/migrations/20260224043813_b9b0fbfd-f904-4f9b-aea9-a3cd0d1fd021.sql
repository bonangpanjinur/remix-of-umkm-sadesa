-- Add sold_count column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0;

-- Create index for sorting by sold_count
CREATE INDEX IF NOT EXISTS idx_products_sold_count ON public.products(sold_count DESC);
