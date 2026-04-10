-- 1. Perbarui tabel refund_requests dengan kolom baru
ALTER TABLE public.refund_requests 
ADD COLUMN IF NOT EXISTS evidence_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS refund_type text DEFAULT 'FULL';

-- 2. Isi data merchant_id untuk data refund yang sudah ada (jika ada)
UPDATE public.refund_requests rr
SET merchant_id = o.merchant_id
FROM public.orders o
WHERE rr.order_id = o.id AND rr.merchant_id IS NULL;

-- 3. Tambahkan index untuk performa pencarian merchant
CREATE INDEX IF NOT EXISTS idx_refund_requests_merchant ON public.refund_requests(merchant_id);

-- 4. Tambahkan kebijakan keamanan (RLS) agar Merchant bisa melihat refund mereka sendiri
DROP POLICY IF EXISTS "Merchants can view own refunds" ON public.refund_requests;
CREATE POLICY "Merchants can view own refunds" ON public.refund_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = refund_requests.merchant_id
    AND m.user_id = auth.uid()
  )
);

-- 5. Pastikan bucket storage tersedia untuk bukti refund (Opsional jika belum ada)
-- Jalankan ini jika Anda ingin memastikan folder storage bisa diakses
-- INSERT INTO storage.buckets (id, name, public) VALUES ('public_assets', 'public_assets', true) ON CONFLICT (id) DO NOTHING;
