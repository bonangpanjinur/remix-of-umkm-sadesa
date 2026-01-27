-- Create storage buckets for images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES 
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('tourism-images', 'tourism-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('profile-images', 'profile-images', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('merchant-images', 'merchant-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- RLS for product-images: Merchants can upload to their own folder
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Merchants can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.merchants 
      WHERE merchants.user_id = auth.uid() 
      AND merchants.status = 'ACTIVE'
    )
  )
);

CREATE POLICY "Merchants can update own product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.merchants 
      WHERE merchants.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Merchants can delete own product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.merchants 
      WHERE merchants.user_id = auth.uid()
    )
  )
);

-- RLS for tourism-images: Admin desa can upload
CREATE POLICY "Anyone can view tourism images"
ON storage.objects FOR SELECT
USING (bucket_id = 'tourism-images');

CREATE POLICY "Admin desa can upload tourism images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tourism-images' 
  AND (is_admin() OR is_admin_desa())
);

CREATE POLICY "Admin desa can update tourism images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tourism-images' 
  AND (is_admin() OR is_admin_desa())
);

CREATE POLICY "Admin desa can delete tourism images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tourism-images' 
  AND (is_admin() OR is_admin_desa())
);

-- RLS for profile-images: Users can upload their own
CREATE POLICY "Anyone can view profile images"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

CREATE POLICY "Users can upload own profile image"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update own profile image"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own profile image"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS for merchant-images: Merchants can upload their store image
CREATE POLICY "Anyone can view merchant images"
ON storage.objects FOR SELECT
USING (bucket_id = 'merchant-images');

CREATE POLICY "Merchants can upload merchant images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'merchant-images' 
  AND (
    is_admin() OR 
    auth.uid() IS NOT NULL
  )
);

CREATE POLICY "Merchants can update own merchant images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'merchant-images' 
  AND (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.merchants 
      WHERE merchants.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Merchants can delete own merchant images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'merchant-images' 
  AND (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.merchants 
      WHERE merchants.user_id = auth.uid()
    )
  )
);

-- Add avatar_url to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;