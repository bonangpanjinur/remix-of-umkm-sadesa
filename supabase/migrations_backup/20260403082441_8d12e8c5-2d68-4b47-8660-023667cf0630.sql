
-- Function to notify available couriers when a new ride request is created
CREATE OR REPLACE FUNCTION public.notify_couriers_new_ride()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert notifications for all active, available couriers
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT 
    c.user_id,
    '🏍️ Pesanan Ojek Baru!',
    'Jemput di: ' || COALESCE(NEW.pickup_address, 'Lokasi tidak diketahui') || ' • Estimasi: Rp ' || COALESCE(NEW.estimated_fare::text, '0'),
    'ride',
    '/courier/rides'
  FROM public.couriers c
  WHERE c.user_id IS NOT NULL
    AND c.registration_status = 'APPROVED'
    AND c.status = 'ACTIVE'
    AND c.is_available = true;
  
  RETURN NEW;
END;
$$;

-- Create trigger on ride_requests for new ride notifications
DROP TRIGGER IF EXISTS trigger_notify_couriers_new_ride ON public.ride_requests;
CREATE TRIGGER trigger_notify_couriers_new_ride
  AFTER INSERT ON public.ride_requests
  FOR EACH ROW
  WHEN (NEW.status = 'SEARCHING')
  EXECUTE FUNCTION public.notify_couriers_new_ride();
