-- ========================================
-- 7. STORAGE BUCKET FOR PRODUCT IMAGES
-- ========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images (with unique names)
CREATE POLICY "Public view product images bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Auth users upload product images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth users update product images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth users delete product images" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- ========================================
-- 8. ENABLE REALTIME FOR COURIER TRACKING
-- ========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.couriers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;