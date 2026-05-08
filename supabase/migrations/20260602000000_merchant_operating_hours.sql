-- P3-04: Merchant Operating Hours
-- Tabel jadwal operasional per hari untuk setiap merchant.

CREATE TABLE IF NOT EXISTS public.merchant_operating_hours (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id   uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0 = Minggu, 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu
  open_time     time NOT NULL DEFAULT '08:00:00',
  close_time    time NOT NULL DEFAULT '21:00:00',
  is_closed     boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (merchant_id, day_of_week)
);

ALTER TABLE public.merchant_operating_hours ENABLE ROW LEVEL SECURITY;

-- Merchant bisa baca dan kelola jam operasional miliknya sendiri
CREATE POLICY "merchant_own_hours" ON public.merchant_operating_hours
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

-- Admin bisa baca semua
CREATE POLICY "admin_read_hours" ON public.merchant_operating_hours
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Publik bisa baca (untuk menampilkan jadwal di halaman toko)
CREATE POLICY "public_read_hours" ON public.merchant_operating_hours
  FOR SELECT USING (true);

-- Seed default 7-hari untuk setiap merchant yang sudah ada (opsional, jalankan sekali)
-- INSERT INTO public.merchant_operating_hours (merchant_id, day_of_week)
-- SELECT m.id, d.day FROM public.merchants m CROSS JOIN generate_series(0,6) AS d(day)
-- ON CONFLICT (merchant_id, day_of_week) DO NOTHING;
