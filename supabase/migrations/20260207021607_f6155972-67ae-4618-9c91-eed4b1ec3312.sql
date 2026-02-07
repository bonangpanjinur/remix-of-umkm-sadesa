
-- Add payment_proof_url column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Public read access for payment proof images
CREATE POLICY "Payment proofs are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs');

-- RLS: Authenticated users can upload payment proofs
CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

-- RLS: Users can update their own payment proofs
CREATE POLICY "Users can update their own payment proofs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

-- RLS: Users can delete their own payment proofs
CREATE POLICY "Users can delete their own payment proofs"
ON storage.objects FOR DELETE
USING (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');
