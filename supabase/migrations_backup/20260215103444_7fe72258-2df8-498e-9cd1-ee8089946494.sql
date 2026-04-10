
-- Fix search_path on generate_merchant_slug
ALTER FUNCTION public.generate_merchant_slug(text) SET search_path = public;
