-- Create promotions/ads table for various ad types
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('banner', 'wisata_populer', 'produk_populer', 'promo_spesial')),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  link_type TEXT CHECK (link_type IN ('product', 'tourism', 'village', 'merchant', 'external', 'category')),
  link_id UUID,
  
  -- Who is advertising
  advertiser_type TEXT CHECK (advertiser_type IN ('admin', 'village', 'merchant')),
  advertiser_id UUID,
  
  -- Scheduling
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  
  -- Pricing & Status
  price INTEGER DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Anyone can view active & approved promotions within date range
CREATE POLICY "Anyone can view active promotions"
ON public.promotions
FOR SELECT
USING (
  is_active = true 
  AND is_approved = true 
  AND start_date <= now() 
  AND (end_date IS NULL OR end_date >= now())
);

-- Admin can manage all promotions
CREATE POLICY "Admins can manage promotions"
ON public.promotions
FOR ALL
USING (is_admin());

-- Villages can create promotions for themselves
CREATE POLICY "Villages can create own promotions"
ON public.promotions
FOR INSERT
WITH CHECK (
  advertiser_type = 'village' 
  AND is_approved = false
);

-- Merchants can create promotions for themselves  
CREATE POLICY "Merchants can create own promotions"
ON public.promotions
FOR INSERT
WITH CHECK (
  advertiser_type = 'merchant'
  AND is_approved = false
);

-- Add trigger for updated_at
CREATE TRIGGER update_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample banner promotions
INSERT INTO public.promotions (type, title, subtitle, image_url, link_url, link_type, advertiser_type, is_approved, sort_order) VALUES
('banner', 'Jelajahi Produk Asli Desa', 'Dukung UMKM lokal & ekonomi desa Indonesia', NULL, '/products', 'category', 'admin', true, 1),
('banner', 'Wisata Desa Bojong', 'Nikmati keindahan alam dan budaya desa', NULL, '/tourism', 'category', 'admin', true, 2),
('banner', 'Promo Spesial Akhir Bulan', 'Diskon hingga 30% untuk produk pilihan', NULL, '/products', 'category', 'admin', true, 3);