
-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Super admins can update all memberships
CREATE POLICY "Super admins can update all memberships"
ON public.user_companies FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()));

-- Super admins can delete all memberships  
CREATE POLICY "Super admins can delete all memberships"
ON public.user_companies FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));

-- Super admins can insert memberships
CREATE POLICY "Super admins can insert all memberships"
ON public.user_companies FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- Function to get all user auth data (only for super admins)
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE(id uuid, email text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id, au.email::text, au.created_at
  FROM auth.users au
  WHERE is_super_admin(auth.uid())
$$;
