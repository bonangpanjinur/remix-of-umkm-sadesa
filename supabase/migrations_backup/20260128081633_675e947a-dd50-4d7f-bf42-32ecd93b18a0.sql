-- Create saved_addresses table for storing multiple addresses per user
CREATE TABLE public.saved_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT 'Rumah',
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province_id TEXT,
  province_name TEXT,
  city_id TEXT,
  city_name TEXT,
  district_id TEXT,
  district_name TEXT,
  village_id TEXT,
  village_name TEXT,
  address_detail TEXT,
  full_address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

-- Users can view their own addresses
CREATE POLICY "Users can view own addresses"
ON public.saved_addresses
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own addresses
CREATE POLICY "Users can insert own addresses"
ON public.saved_addresses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own addresses
CREATE POLICY "Users can update own addresses"
ON public.saved_addresses
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own addresses
CREATE POLICY "Users can delete own addresses"
ON public.saved_addresses
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_saved_addresses_updated_at
BEFORE UPDATE ON public.saved_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();