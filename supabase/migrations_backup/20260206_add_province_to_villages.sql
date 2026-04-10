-- Add province column to villages table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'villages' AND column_name = 'province') THEN
        ALTER TABLE public.villages ADD COLUMN province text;
    END IF;
END $$;

-- Update existing villages with a default province if needed
-- UPDATE public.villages SET province = 'Jawa Tengah' WHERE province IS NULL;
