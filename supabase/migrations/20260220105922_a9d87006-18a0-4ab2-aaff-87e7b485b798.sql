
-- Fase 1: Upgrade tabel chat_messages untuk multi-tipe chat

-- Tambah kolom chat_type dan image_url
ALTER TABLE public.chat_messages 
  ADD COLUMN IF NOT EXISTS chat_type TEXT DEFAULT 'buyer_merchant',
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Index untuk query berdasarkan chat_type
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_type ON public.chat_messages(order_id, chat_type);

-- Drop existing RLS policies yang akan di-update
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update own messages read status" ON public.chat_messages;

-- Helper function: cek apakah user adalah kurir pada order tertentu
CREATE OR REPLACE FUNCTION public.is_chat_participant(
  _user_id uuid,
  _order_id uuid,
  _chat_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _chat_type = 'buyer_merchant' THEN
      EXISTS (
        SELECT 1 FROM orders o
        LEFT JOIN merchants m ON o.merchant_id = m.id
        WHERE o.id = _order_id
          AND (o.buyer_id = _user_id OR m.user_id = _user_id)
      )
    WHEN _chat_type = 'buyer_courier' THEN
      EXISTS (
        SELECT 1 FROM orders o
        LEFT JOIN couriers c ON o.courier_id = c.id
        WHERE o.id = _order_id
          AND (o.buyer_id = _user_id OR c.user_id = _user_id)
      )
    WHEN _chat_type = 'merchant_courier' THEN
      EXISTS (
        SELECT 1 FROM orders o
        LEFT JOIN merchants m ON o.merchant_id = m.id
        LEFT JOIN couriers c ON o.courier_id = c.id
        WHERE o.id = _order_id
          AND (m.user_id = _user_id OR c.user_id = _user_id)
      )
    ELSE false
  END
$$;

-- RLS: Users can view chat messages where they are participants
CREATE POLICY "Users can view own chat messages"
ON public.chat_messages
FOR SELECT
USING (
  (auth.uid() = sender_id OR auth.uid() = receiver_id)
  OR is_chat_participant(auth.uid(), order_id, chat_type)
);

-- RLS: Users can send chat messages if they are a participant
CREATE POLICY "Users can send chat messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND is_chat_participant(auth.uid(), order_id, chat_type)
);

-- RLS: Users can update read status on messages they received
CREATE POLICY "Users can update own messages read status"
ON public.chat_messages
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat images
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view chat images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-images');
