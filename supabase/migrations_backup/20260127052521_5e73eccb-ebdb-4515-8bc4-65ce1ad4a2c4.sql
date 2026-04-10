-- Add courier assignment to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES public.couriers(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC,
ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC;

-- Create index for courier lookups
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Update RLS policies for couriers to view assigned orders
CREATE POLICY "Couriers can view assigned orders" 
ON public.orders 
FOR SELECT 
USING (courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid()));

-- Couriers can update assigned orders (status changes)
CREATE POLICY "Couriers can update assigned orders" 
ON public.orders 
FOR UPDATE 
USING (courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid()));