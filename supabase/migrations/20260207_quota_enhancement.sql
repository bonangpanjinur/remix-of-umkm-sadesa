-- MIGRATION: Sistem Kuota V2 (Request & Tiers Enhancement)
-- Deskripsi: Menambahkan kolom bukti pembayaran, catatan admin, memperbarui fungsi persetujuan kuota, dan membuat storage bucket.

-- 1. Modifikasi tabel merchant_subscriptions untuk mendukung bukti pembayaran dan catatan admin
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='merchant_subscriptions' AND column_name='payment_proof_url') THEN
        ALTER TABLE public.merchant_subscriptions ADD COLUMN payment_proof_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='merchant_subscriptions' AND column_name='admin_notes') THEN
        ALTER TABLE public.merchant_subscriptions ADD COLUMN admin_notes TEXT;
    END IF;
END $$;

-- 2. Memastikan tabel quota_tiers ada dan sesuai
CREATE TABLE IF NOT EXISTS public.quota_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    min_price integer NOT NULL DEFAULT 0,
    max_price integer,
    credit_cost integer NOT NULL DEFAULT 1,
    description text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Fungsi Helper untuk menghitung biaya kuota berdasarkan harga
CREATE OR REPLACE FUNCTION public.calculate_quota_cost(p_product_price integer)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_cost integer;
BEGIN
    SELECT credit_cost INTO v_cost
    FROM public.quota_tiers
    WHERE p_product_price >= min_price 
    AND (max_price IS NULL OR p_product_price <= max_price)
    AND is_active = true
    ORDER BY min_price DESC
    LIMIT 1;

    RETURN COALESCE(v_cost, 1);
END;
$$;

-- 4. Fungsi untuk menyetujui permintaan kuota (RPC)
CREATE OR REPLACE FUNCTION public.approve_quota_subscription(p_subscription_id UUID, p_admin_notes TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub RECORD;
BEGIN
    -- 1. Ambil data subscription
    SELECT * INTO v_sub FROM public.merchant_subscriptions WHERE id = p_subscription_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Subscription tidak ditemukan');
    END IF;

    IF v_sub.payment_status = 'PAID' AND v_sub.status = 'ACTIVE' THEN
        RETURN json_build_object('success', false, 'message', 'Subscription sudah aktif');
    END IF;

    -- 2. Update status subscription
    UPDATE public.merchant_subscriptions 
    SET 
        status = 'ACTIVE', 
        payment_status = 'PAID', 
        paid_at = now(),
        admin_notes = p_admin_notes,
        updated_at = now()
    WHERE id = p_subscription_id;

    -- 3. Update current_subscription_id di tabel merchants
    UPDATE public.merchants
    SET 
        current_subscription_id = p_subscription_id,
        updated_at = now()
    WHERE id = v_sub.merchant_id;

    RETURN json_build_object('success', true, 'message', 'Subscription berhasil disetujui dan diaktifkan');
END;
$$;

-- 5. Fungsi untuk menolak permintaan kuota (RPC)
CREATE OR REPLACE FUNCTION public.reject_quota_subscription(p_subscription_id UUID, p_admin_notes TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 6. Seed data awal untuk quota_tiers jika kosong
INSERT INTO public.quota_tiers (min_price, max_price, credit_cost, description, sort_order)
SELECT 0, 50000, 1, 'Produk Murah', 1
WHERE NOT EXISTS (SELECT 1 FROM public.quota_tiers);

INSERT INTO public.quota_tiers (min_price, max_price, credit_cost, description, sort_order)
SELECT 50001, 200000, 2, 'Produk Menengah', 2
WHERE NOT EXISTS (SELECT 1 FROM public.quota_tiers WHERE min_price = 50001);

INSERT INTO public.quota_tiers (min_price, max_price, credit_cost, description, sort_order)
SELECT 200001, NULL, 5, 'Produk Mahal', 3
WHERE NOT EXISTS (SELECT 1 FROM public.quota_tiers WHERE min_price = 200001);

-- 7. Membuat Storage Bucket 'merchants' jika belum ada
INSERT INTO storage.buckets (id, name, public)
SELECT 'merchants', 'merchants', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'merchants'
);

-- 8. Menambahkan Storage Policies untuk bucket 'merchants'
-- Menggunakan DROP POLICY IF EXISTS untuk menghindari error jika policy sudah ada
DROP POLICY IF EXISTS "Merchant upload proof" ON storage.objects;
CREATE POLICY "Merchant upload proof"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'merchants' AND 
    (storage.foldername(name))[1] = 'payment-proofs'
);

DROP POLICY IF EXISTS "Public view proof" ON storage.objects;
CREATE POLICY "Public view proof"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'merchants');

DROP POLICY IF EXISTS "Admin manage merchants bucket" ON storage.objects;
CREATE POLICY "Admin manage merchants bucket"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'merchants' AND
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);
