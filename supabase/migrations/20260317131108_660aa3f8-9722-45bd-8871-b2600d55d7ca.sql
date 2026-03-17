
-- Super admins table
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Security definer function to check super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = _user_id
  )
$$;

-- Super admins can read their own row
CREATE POLICY "Super admins can view own" ON public.super_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Company invitations table
CREATE TABLE public.company_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, email)
);

ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

-- Company members can view invitations for their company
CREATE POLICY "Members can view company invitations" ON public.company_invitations
  FOR SELECT TO authenticated
  USING (user_belongs_to_company(auth.uid(), company_id));

-- Company owners/admins can insert invitations
CREATE POLICY "Members can insert invitations" ON public.company_invitations
  FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

-- Company members can delete invitations
CREATE POLICY "Members can delete invitations" ON public.company_invitations
  FOR DELETE TO authenticated
  USING (user_belongs_to_company(auth.uid(), company_id));

-- Allow super admins to see all companies (add SELECT policy)
CREATE POLICY "Super admins can view all companies" ON public.companies
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

-- Allow super admins to update all companies
CREATE POLICY "Super admins can update all companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()));

-- Allow super admins to view all user_companies
CREATE POLICY "Super admins can view all memberships" ON public.user_companies
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));
