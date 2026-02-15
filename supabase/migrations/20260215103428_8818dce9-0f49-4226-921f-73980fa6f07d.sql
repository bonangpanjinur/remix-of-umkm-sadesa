
-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  auto_delete_at timestamptz
);

-- Index for fast lookups
CREATE INDEX idx_chat_messages_order_id ON public.chat_messages(order_id);
CREATE INDEX idx_chat_messages_auto_delete ON public.chat_messages(auto_delete_at) WHERE auto_delete_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies: only sender/receiver can access
CREATE POLICY "Users can view own chat messages"
ON public.chat_messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own messages read status"
ON public.chat_messages FOR UPDATE
USING (auth.uid() = receiver_id);

CREATE POLICY "Admins can manage all chat messages"
ON public.chat_messages FOR ALL
USING (is_admin());

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Page views tracking table
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  viewer_id uuid,
  page_type text NOT NULL DEFAULT 'product',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_views_merchant ON public.page_views(merchant_id, created_at);
CREATE INDEX idx_page_views_product ON public.page_views(product_id, created_at);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert page views (anonymous tracking)
CREATE POLICY "Anyone can insert page views"
ON public.page_views FOR INSERT
WITH CHECK (true);

-- Merchants can view their own page views
CREATE POLICY "Merchants can view own page views"
ON public.page_views FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM merchants
    WHERE merchants.id = page_views.merchant_id
    AND merchants.user_id = auth.uid()
  )
  OR is_admin()
);

-- Function to set auto_delete_at when order is completed
CREATE OR REPLACE FUNCTION public.set_chat_auto_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('DONE', 'DELIVERED') AND OLD.status NOT IN ('DONE', 'DELIVERED') THEN
    UPDATE chat_messages
    SET auto_delete_at = now() + interval '3 hours'
    WHERE order_id = NEW.id AND auto_delete_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_chat_auto_delete
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_chat_auto_delete();

-- Function to clean up expired chat messages (called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_chats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM chat_messages WHERE auto_delete_at IS NOT NULL AND auto_delete_at <= now();
END;
$$;
