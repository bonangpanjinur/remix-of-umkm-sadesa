-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'merchant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'courier';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_desa';