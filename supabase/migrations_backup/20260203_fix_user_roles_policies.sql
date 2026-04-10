-- Add policies for user_roles to allow admins to manage roles
-- First, ensure the is_admin() function exists and is working correctly
-- (It should already exist based on previous migrations, but we use it in policies)

-- Policy for Admins to view all roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
    ON public.user_roles FOR SELECT
    USING (public.is_admin());

-- Policy for Admins to insert roles
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
    ON public.user_roles FOR INSERT
    WITH CHECK (public.is_admin());

-- Policy for Admins to update roles
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
    ON public.user_roles FOR UPDATE
    USING (public.is_admin());

-- Policy for Admins to delete roles
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
    ON public.user_roles FOR DELETE
    USING (public.is_admin());

-- Also add policy for profiles so admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());
