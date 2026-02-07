-- Add cover_image_url column to merchants table
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS cover_image_url TEXT;