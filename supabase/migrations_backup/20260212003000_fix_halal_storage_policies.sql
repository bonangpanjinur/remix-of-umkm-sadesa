-- Fix storage policies for halal certificates and KTP uploads
-- This ensures that users can upload files to 'certificate/' and 'ktp/' folders in the 'merchants' bucket

-- 1. Allow authenticated users to upload certificates
DROP POLICY IF EXISTS "Allow users to upload certificates" ON storage.objects;
CREATE POLICY "Allow users to upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'merchants' AND 
    (storage.foldername(name))[1] = 'certificate'
);

-- 2. Allow authenticated users to upload KTP
DROP POLICY IF EXISTS "Allow users to upload ktp" ON storage.objects;
CREATE POLICY "Allow users to upload ktp"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'merchants' AND 
    (storage.foldername(name))[1] = 'ktp'
);

-- 3. Ensure public read access for the merchants bucket (already exists but making sure)
DROP POLICY IF EXISTS "Public view merchants bucket" ON storage.objects;
CREATE POLICY "Public view merchants bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'merchants');
