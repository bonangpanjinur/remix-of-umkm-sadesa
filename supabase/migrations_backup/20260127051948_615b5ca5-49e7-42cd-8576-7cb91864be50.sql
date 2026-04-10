-- Add address component columns to profiles table for auto-fill functionality
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS province_id TEXT,
ADD COLUMN IF NOT EXISTS province_name TEXT,
ADD COLUMN IF NOT EXISTS city_id TEXT,
ADD COLUMN IF NOT EXISTS city_name TEXT,
ADD COLUMN IF NOT EXISTS district_id TEXT,
ADD COLUMN IF NOT EXISTS district_name TEXT,
ADD COLUMN IF NOT EXISTS village_id TEXT,
ADD COLUMN IF NOT EXISTS village_name TEXT,
ADD COLUMN IF NOT EXISTS address_detail TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);