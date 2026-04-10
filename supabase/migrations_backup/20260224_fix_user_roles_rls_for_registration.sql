-- Fix RLS policies for user_roles to allow the system/trigger to manage roles
-- and ensure users can always see their own roles.

-- 1. Ensure the trigger function exists and is robust
CREATE OR REPLACE FUNCTION public.handle_merchant_approval_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status is APPROVED (either on insert or update)
  IF (NEW.registration_status = 'APPROVED') THEN
    -- Ensure user_id exists
    IF NEW.user_id IS NOT NULL THEN
      -- Add merchant role to user_roles table
      -- SECURITY DEFINER in the function handles the permission
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.user_id, 'merchant')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-apply the trigger for both INSERT and UPDATE
-- This ensures that if a merchant is created with 'APPROVED' status, the role is added immediately.
DROP TRIGGER IF EXISTS on_merchant_approval_insert ON public.merchants;
CREATE TRIGGER on_merchant_approval_insert
  AFTER INSERT ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_merchant_approval_role();

DROP TRIGGER IF EXISTS on_merchant_approval_update ON public.merchants;
CREATE TRIGGER on_merchant_approval_update
  AFTER UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_merchant_approval_role();

-- 3. Fix RLS for user_roles to be more reliable
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Ensure the enum 'merchant' is correctly handled (it already exists based on previous migrations)
