-- Create merchant gallery table for "Tentang Kami" photos
CREATE TABLE public.merchant_gallery (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_gallery ENABLE ROW LEVEL SECURITY;

-- Anyone can view gallery images of active merchants
CREATE POLICY "Public can view merchant gallery"
  ON public.merchant_gallery FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM merchants 
    WHERE merchants.id = merchant_gallery.merchant_id 
    AND merchants.status = 'ACTIVE' 
    AND merchants.registration_status = 'APPROVED'
  ));

-- Merchants can manage own gallery
CREATE POLICY "Merchants can manage own gallery"
  ON public.merchant_gallery FOR ALL
  USING (EXISTS (
    SELECT 1 FROM merchants 
    WHERE merchants.id = merchant_gallery.merchant_id 
    AND merchants.user_id = auth.uid()
  ));

-- Admins can manage all galleries
CREATE POLICY "Admins can manage all galleries"
  ON public.merchant_gallery FOR ALL
  USING (is_admin());

-- Create storage bucket for merchant gallery images
INSERT INTO storage.buckets (id, name, public) VALUES ('merchant-gallery', 'merchant-gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for merchant gallery
CREATE POLICY "Public can view merchant gallery images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'merchant-gallery');

CREATE POLICY "Authenticated users can upload merchant gallery images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'merchant-gallery' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own merchant gallery images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'merchant-gallery' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own merchant gallery images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'merchant-gallery' AND auth.uid() IS NOT NULL);