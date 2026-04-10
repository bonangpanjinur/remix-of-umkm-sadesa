-- 1. Trigger untuk otomatis mengisi user_id saat pendaftaran merchant (jika belum diisi)
-- Ini memastikan user_id selalu terhubung dengan user yang sedang login
CREATE OR REPLACE FUNCTION public.handle_merchant_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_merchant_signup ON public.merchants;
CREATE TRIGGER on_merchant_signup
  BEFORE INSERT ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_merchant_user_id();

-- 2. Trigger untuk otomatis mengubah role user menjadi 'merchant' saat disetujui
CREATE OR REPLACE FUNCTION public.handle_merchant_approval_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Cek jika status berubah menjadi APPROVED
  IF (NEW.registration_status = 'APPROVED' AND OLD.registration_status != 'APPROVED') THEN
    -- Pastikan user_id ada
    IF NEW.user_id IS NOT NULL THEN
      -- Tambahkan role merchant ke tabel user_roles
      -- Menggunakan ON CONFLICT agar tidak error jika role sudah ada
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.user_id, 'merchant')
      ON CONFLICT (user_id, role) DO NOTHING;
      
      -- Opsional: Jika ingin menghapus role 'buyer' saat menjadi merchant
      -- DELETE FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'buyer';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_merchant_approval ON public.merchants;
CREATE TRIGGER on_merchant_approval
  AFTER UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_merchant_approval_role();

-- 3. Perbaikan RLS Policy agar user bisa mendaftar dengan aman
DROP POLICY IF EXISTS "merchants_register" ON public.merchants;
CREATE POLICY "merchants_register" ON public.merchants 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' AND 
  (user_id = auth.uid() OR user_id IS NULL) -- Izinkan NULL karena akan diisi oleh trigger
);
