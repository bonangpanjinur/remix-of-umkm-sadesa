
-- Atomic RPC to accept a ride, preventing race conditions
CREATE OR REPLACE FUNCTION public.accept_ride(p_ride_id UUID, p_courier_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE ride_requests
  SET driver_id = p_courier_id,
      status = 'ACCEPTED',
      accepted_at = now()
  WHERE id = p_ride_id
    AND status = 'SEARCHING'
    AND driver_id IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN FALSE;
  END IF;

  -- Send notification to passenger
  PERFORM send_notification(
    passenger_id,
    'Driver Ditemukan! 🏍️',
    'Driver sedang menuju lokasi jemput Anda',
    'ride',
    '/ride/' || p_ride_id::text
  )
  FROM ride_requests WHERE id = p_ride_id;

  RETURN TRUE;
END;
$$;
