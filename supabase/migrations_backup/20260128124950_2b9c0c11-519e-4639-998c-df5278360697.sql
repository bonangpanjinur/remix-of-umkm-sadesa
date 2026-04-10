-- Create storage bucket for review images
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-images', 'review-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for users to upload their own review images
CREATE POLICY "Users can upload their own review images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'review-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for public read access to review images
CREATE POLICY "Review images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'review-images');

-- Create policy for users to delete their own review images
CREATE POLICY "Users can delete their own review images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'review-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);