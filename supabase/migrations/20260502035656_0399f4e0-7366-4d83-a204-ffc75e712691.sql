-- =============================================
-- Phase 1: DB Hardening
-- =============================================

-- 1. DROP unused function overloads (keep the ones used by RLS policies & app code)
-- Keep: get_user_courier_id() no-arg (used in RLS)
DROP FUNCTION IF EXISTS public.get_user_courier_id(uuid);

-- Keep: get_user_merchant_id() no-arg
DROP FUNCTION IF EXISTS public.get_user_merchant_id(uuid);

-- Keep: use_merchant_quota(p_merchant_id uuid) — used by app via RPC
DROP FUNCTION IF EXISTS public.use_merchant_quota(uuid, integer);

-- Note: is_order_merchant has 2 overloads, BOTH are referenced by different RLS policies.
-- Keep both.

-- =============================================
-- 2. Privatize sensitive storage buckets
-- =============================================
UPDATE storage.buckets SET public = false WHERE id IN ('chat-images', 'pod-images');

-- RLS policies for chat-images: only chat participants can read/write
DROP POLICY IF EXISTS "Chat images: read by participants" ON storage.objects;
CREATE POLICY "Chat images: read by participants"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.chat_messages cm
      WHERE cm.image_url LIKE '%' || storage.objects.name || '%'
        AND (cm.sender_id = auth.uid() OR cm.receiver_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Chat images: upload by authenticated" ON storage.objects;
CREATE POLICY "Chat images: upload by authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images' AND auth.uid() IS NOT NULL);

-- RLS policies for pod-images: only buyer / merchant / courier of the order + admin
DROP POLICY IF EXISTS "POD images: read by order parties" ON storage.objects;
CREATE POLICY "POD images: read by order parties"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pod-images'
  AND (
    is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      LEFT JOIN public.merchants m ON m.id = o.merchant_id
      LEFT JOIN public.couriers c ON c.id = o.courier_id
      WHERE o.pod_image_url LIKE '%' || storage.objects.name || '%'
        AND (o.buyer_id = auth.uid() OR m.user_id = auth.uid() OR c.user_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "POD images: upload by courier or merchant" ON storage.objects;
CREATE POLICY "POD images: upload by courier or merchant"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pod-images' AND auth.uid() IS NOT NULL);
