
-- Create chat_messages table if not exists
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  chat_type TEXT DEFAULT 'buyer_merchant',
  image_url TEXT,
  auto_delete_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Add columns if they don't exist (for cases where table exists but columns don't)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_messages' AND column_name='chat_type') THEN
    ALTER TABLE public.chat_messages ADD COLUMN chat_type TEXT DEFAULT 'buyer_merchant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_messages' AND column_name='image_url') THEN
    ALTER TABLE public.chat_messages ADD COLUMN image_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_messages' AND column_name='auto_delete_at') THEN
    ALTER TABLE public.chat_messages ADD COLUMN auto_delete_at TIMESTAMP WITH TIME ZONE;
  END IF;
END$$;

-- Drop and recreate function
DROP FUNCTION IF EXISTS public.is_chat_participant(uuid, uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION public.is_chat_participant(user_uuid UUID, p_order_id UUID, p_chat_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_chat_type = 'buyer_merchant' THEN
    RETURN EXISTS (
      SELECT 1 FROM orders o
      LEFT JOIN merchants m ON o.merchant_id = m.id
      WHERE o.id = p_order_id AND (o.buyer_id = user_uuid OR m.user_id = user_uuid)
    );
  ELSIF p_chat_type = 'buyer_courier' THEN
    RETURN EXISTS (
      SELECT 1 FROM orders o
      LEFT JOIN couriers c ON o.courier_id = c.id
      WHERE o.id = p_order_id AND (o.buyer_id = user_uuid OR c.user_id = user_uuid)
    );
  ELSIF p_chat_type = 'merchant_courier' THEN
    RETURN EXISTS (
      SELECT 1 FROM orders o
      LEFT JOIN merchants m ON o.merchant_id = m.id
      LEFT JOIN couriers c ON o.courier_id = c.id
      WHERE o.id = p_order_id AND (m.user_id = user_uuid OR c.user_id = user_uuid)
    );
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update own messages read status" ON public.chat_messages;
DROP POLICY IF EXISTS "Admins can manage all chat messages" ON public.chat_messages;

-- Create policies
CREATE POLICY "Users can view own chat messages"
ON public.chat_messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_chat_participant(auth.uid(), order_id, chat_type));

CREATE POLICY "Users can send chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (auth.uid() = sender_id AND is_chat_participant(auth.uid(), order_id, chat_type));

CREATE POLICY "Users can update own messages read status"
ON public.chat_messages FOR UPDATE
USING (auth.uid() = receiver_id);

CREATE POLICY "Admins can manage all chat messages"
ON public.chat_messages FOR ALL
USING (is_admin());

-- Enable realtime (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

-- Auto-delete trigger
CREATE OR REPLACE FUNCTION public.set_chat_auto_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('DONE', 'DELIVERED') AND OLD.status NOT IN ('DONE', 'DELIVERED') THEN
    UPDATE chat_messages
    SET auto_delete_at = now() + interval '3 hours'
    WHERE order_id = NEW.id AND auto_delete_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_set_chat_auto_delete ON public.orders;
CREATE TRIGGER trigger_set_chat_auto_delete
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_chat_auto_delete();

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_chats()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_messages WHERE auto_delete_at IS NOT NULL AND auto_delete_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
