
-- Function to update merchant rating when reviews change
CREATE OR REPLACE FUNCTION public.update_merchant_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_merchant_id uuid;
  new_avg numeric;
  new_count integer;
BEGIN
  -- Determine the merchant_id based on the operation
  IF TG_OP = 'DELETE' THEN
    target_merchant_id := OLD.merchant_id;
  ELSE
    target_merchant_id := NEW.merchant_id;
  END IF;

  -- Calculate new rating stats
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO new_avg, new_count
  FROM public.reviews
  WHERE merchant_id = target_merchant_id;

  -- Update the merchant
  UPDATE public.merchants
  SET rating_avg = ROUND(new_avg, 1),
      rating_count = new_count,
      updated_at = now()
  WHERE id = target_merchant_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on reviews table
DROP TRIGGER IF EXISTS trigger_update_merchant_rating ON public.reviews;
CREATE TRIGGER trigger_update_merchant_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_merchant_rating();
