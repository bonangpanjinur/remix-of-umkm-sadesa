-- Create promotions storage bucket for banner images
INSERT INTO storage.buckets (id, name, public) VALUES ('promotions', 'promotions', true)
ON CONFLICT (id) DO NOTHING;

-- Create admin-assets bucket for QRIS images etc
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-assets', 'admin-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to promotions bucket
CREATE POLICY "Public can view promotion images"
ON storage.objects FOR SELECT
USING (bucket_id = 'promotions');

-- Allow authenticated users to upload to promotions bucket
CREATE POLICY "Authenticated users can upload promotion images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'promotions' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete promotion images
CREATE POLICY "Authenticated users can delete promotion images"
ON storage.objects FOR DELETE
USING (bucket_id = 'promotions' AND auth.role() = 'authenticated');

-- Allow public read access to admin-assets bucket
CREATE POLICY "Public can view admin assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'admin-assets');

-- Allow authenticated users to upload to admin-assets bucket
CREATE POLICY "Authenticated users can upload admin assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'admin-assets' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete admin assets
CREATE POLICY "Authenticated users can delete admin assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'admin-assets' AND auth.role() = 'authenticated');
