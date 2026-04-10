-- Add location coordinates to villages table
ALTER TABLE public.villages 
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);

-- Add location coordinates to merchants table for precise location
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);

-- Update existing villages with approximate coordinates (Tasikmalaya area)
UPDATE public.villages SET 
  location_lat = -7.3274,
  location_lng = 108.2207
WHERE district = 'Megamendung' AND location_lat IS NULL;

UPDATE public.villages SET 
  location_lat = -7.3350,
  location_lng = 108.2150
WHERE district = 'Cisarua' AND location_lat IS NULL;

-- Create index for location queries
CREATE INDEX IF NOT EXISTS idx_villages_location ON public.villages(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_merchants_location ON public.merchants(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_tourism_location ON public.tourism(location_lat, location_lng);