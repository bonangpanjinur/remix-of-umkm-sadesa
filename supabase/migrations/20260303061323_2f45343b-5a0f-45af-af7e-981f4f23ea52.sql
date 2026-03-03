
-- Create ride_requests table for Ojek Desa feature
CREATE TABLE public.ride_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  passenger_id uuid NOT NULL,
  driver_id uuid REFERENCES public.couriers(id) ON DELETE SET NULL,
  pickup_lat numeric NOT NULL,
  pickup_lng numeric NOT NULL,
  pickup_address text NOT NULL DEFAULT '',
  destination_lat numeric NOT NULL,
  destination_lng numeric NOT NULL,
  destination_address text NOT NULL DEFAULT '',
  distance_km numeric NOT NULL DEFAULT 0,
  estimated_fare integer NOT NULL DEFAULT 0,
  final_fare integer,
  status text NOT NULL DEFAULT 'SEARCHING',
  accepted_at timestamp with time zone,
  picked_up_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  rating integer,
  rating_comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;

-- Passengers can create ride requests
CREATE POLICY "Passengers can create rides"
ON public.ride_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = passenger_id);

-- Passengers can view own rides
CREATE POLICY "Passengers can view own rides"
ON public.ride_requests
FOR SELECT
TO authenticated
USING (auth.uid() = passenger_id);

-- Passengers can update own rides (cancel)
CREATE POLICY "Passengers can update own rides"
ON public.ride_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = passenger_id);

-- Drivers can view SEARCHING rides (to accept)
CREATE POLICY "Drivers can view searching rides"
ON public.ride_requests
FOR SELECT
TO authenticated
USING (
  status = 'SEARCHING' AND EXISTS (
    SELECT 1 FROM public.couriers
    WHERE couriers.user_id = auth.uid()
    AND couriers.registration_status = 'APPROVED'
    AND couriers.status = 'ACTIVE'
    AND couriers.is_available = true
  )
);

-- Drivers can view their assigned rides
CREATE POLICY "Drivers can view assigned rides"
ON public.ride_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.couriers
    WHERE couriers.id = ride_requests.driver_id
    AND couriers.user_id = auth.uid()
  )
);

-- Drivers can update rides they accepted
CREATE POLICY "Drivers can update assigned rides"
ON public.ride_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.couriers
    WHERE couriers.id = ride_requests.driver_id
    AND couriers.user_id = auth.uid()
  )
);

-- Admin full access
CREATE POLICY "Admins can manage all rides"
ON public.ride_requests
FOR ALL
TO authenticated
USING (public.is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_ride_requests_updated_at
BEFORE UPDATE ON public.ride_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for ride_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_requests;

-- Insert default ride fare settings
INSERT INTO public.app_settings (key, value, category, description)
VALUES (
  'ride_fare_settings',
  '{"base_fare": 5000, "per_km_fare": 3000, "min_fare": 5000, "max_fare": 100000}'::jsonb,
  'ride',
  'Pengaturan tarif ojek desa: base_fare (tarif dasar), per_km_fare (tarif per km), min_fare (tarif minimum), max_fare (tarif maksimum)'
)
ON CONFLICT (key) DO NOTHING;
