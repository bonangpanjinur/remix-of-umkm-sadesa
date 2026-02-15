
-- Tabel pengumuman verifikator ke kelompok
CREATE TABLE IF NOT EXISTS public.group_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.trade_groups(id) ON DELETE CASCADE,
  verifikator_id uuid REFERENCES auth.users(id),
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.group_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verifikator can manage own announcements"
  ON public.group_announcements FOR ALL
  USING (verifikator_id = auth.uid());

CREATE POLICY "Group members can read announcements"
  ON public.group_announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      JOIN public.merchants m ON m.id = gm.merchant_id
      WHERE gm.group_id = group_announcements.group_id
      AND m.user_id = auth.uid()
    )
  );

-- Ambang batas stok per produk
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold integer DEFAULT 5;
