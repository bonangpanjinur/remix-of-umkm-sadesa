-- COMPREHENSIVE FIX: Perbaikan RLS & Logika Kuota Transaksi
-- Deskripsi: Memastikan admin memiliki akses ke bukti bayar dan memperbaiki alur penyimpanan data.

-- 1. Memastikan kolom database ada
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='merchant_subscriptions' AND column_name='payment_proof_url') THEN
        ALTER TABLE public.merchant_subscriptions ADD COLUMN payment_proof_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='merchant_subscriptions' AND column_name='admin_notes') THEN
        ALTER TABLE public.merchant_subscriptions ADD COLUMN admin_notes TEXT;
    END IF;
END $$;

-- 2. Memperbaiki RLS Policy untuk merchant_subscriptions
-- Admin harus bisa melihat semua data untuk melakukan verifikasi
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.merchant_subscriptions;
CREATE POLICY "Admins can manage all subscriptions" 
ON public.merchant_subscriptions FOR ALL 
TO authenticated
USING (public.is_admin());

-- Memastikan merchant bisa melihat datanya sendiri (termasuk bukti bayar)
DROP POLICY IF EXISTS "Merchants can view own subscriptions" ON public.merchant_subscriptions;
CREATE POLICY "Merchants can view own subscriptions" 
ON public.merchant_subscriptions FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.merchants 
    WHERE merchants.id = merchant_subscriptions.merchant_id 
    AND merchants.user_id = auth.uid()
  )
);

-- 3. Memperbaiki RLS Policy untuk Storage (Bukti Pembayaran)
-- Admin harus bisa melihat semua file di bucket merchants
DROP POLICY IF EXISTS "Admin manage merchants bucket" ON storage.objects;
CREATE POLICY "Admin manage merchants bucket"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'merchants' AND
    public.is_admin()
);

-- Merchant harus bisa melihat file mereka sendiri
DROP POLICY IF EXISTS "Merchant view own proofs" ON storage.objects;
CREATE POLICY "Merchant view own proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'merchants' AND
    (storage.foldername(name))[1] = 'payment-proofs'
);

-- 4. Memperbaiki Fungsi RPC dengan search_path yang benar
CREATE OR REPLACE FUNCTION public.approve_quota_subscription(p_subscription_id UUID, p_admin_notes TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_sub RECORD;
BEGIN
    SELECT * INTO v_sub FROM public.merchant_subscriptions WHERE id = p_subscription_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Subscription tidak ditemukan');
    END IF;

    -- Update status subscription
    UPDATE public.merchant_subscriptions 
    SET 
        status = 'ACTIVE', 
        payment_status = 'PAID', 
        paid_at = now(),
        admin_notes = p_admin_notes,
        updated_at = now()
    WHERE id = p_subscription_id;

    -- Update current_subscription_id di tabel merchants
    UPDATE public.merchants
    SET 
        current_subscription_id = p_subscription_id,
        updated_at = now()
    WHERE id = v_sub.merchant_id;

    RETURN json_build_object('success', true, 'message', 'Subscription berhasil disetujui dan diaktifkan');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_quota_subscription(p_subscription_id UUID, p_admin_notes TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
    IF p_admin_notes IS NULL OR p_admin_notes = '' THEN
        RETURN json_build_object('success', false, 'message', 'Catatan admin wajib diisi saat menolak');
    END IF;

    UPDATE public.merchant_subscriptions 
    SET 
        status = 'INACTIVE', 
        payment_status = 'REJECTED', 
        admin_notes = p_admin_notes,
        updated_at = now()
    WHERE id = p_subscription_id;

    RETURN json_build_object('success', true, 'message', 'Subscription berhasil ditolak');
END;
$$;
