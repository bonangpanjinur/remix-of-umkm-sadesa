
-- Create village-images storage bucket for village main images
INSERT INTO storage.buckets (id, name, public)
VALUES ('village-images', 'village-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to village images
CREATE POLICY "Village images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'village-images');

-- Allow authenticated users to upload village images
CREATE POLICY "Authenticated users can upload village images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'village-images' AND auth.role() = 'authenticated');

-- Allow authenticated users to update village images
CREATE POLICY "Authenticated users can update village images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'village-images' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete village images
CREATE POLICY "Authenticated users can delete village images"
ON storage.objects FOR DELETE
USING (bucket_id = 'village-images' AND auth.role() = 'authenticated');
