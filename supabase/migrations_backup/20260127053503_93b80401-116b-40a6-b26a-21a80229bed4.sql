-- Create helper functions for role checking
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role::text), ARRAY[]::text[])
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Function to check if user is merchant
CREATE OR REPLACE FUNCTION public.is_merchant()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'merchant')
$$;

-- Function to check if user is courier
CREATE OR REPLACE FUNCTION public.is_courier()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'courier')
$$;

-- Function to check if user is admin desa
CREATE OR REPLACE FUNCTION public.is_admin_desa()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin_desa')
$$;