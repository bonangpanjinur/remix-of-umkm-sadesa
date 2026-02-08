-- Add notification sound setting to merchants
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS notification_sound_enabled BOOLEAN DEFAULT true;
