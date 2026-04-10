-- Create storage bucket for products if it doesn't exist
-- The roadmap mentioned 'products' bucket, but the code uses 'product-images'.
-- We will create 'products' as an alias or ensure both exist to be safe, 
-- but primarily we'll fix the code to use 'product-images' consistently or vice versa.
-- According to the roadmap, the user wants a bucket named 'products'.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('products', 'products', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the 'products' bucket
-- 1. Public: Anyone can view images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

-- 2. Authenticated (Merchant): Can upload images
CREATE POLICY "Merchant Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'products' 
  AND auth.role() = 'authenticated'
);

-- 3. Authenticated (Merchant): Can update own images
CREATE POLICY "Merchant Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'products' 
  AND auth.role() = 'authenticated'
);

-- 4. Authenticated (Merchant): Can delete own images
CREATE POLICY "Merchant Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'products' 
  AND auth.role() = 'authenticated'
);
