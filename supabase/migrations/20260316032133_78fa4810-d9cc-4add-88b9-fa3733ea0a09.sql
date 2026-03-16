
-- Fix permissive INSERT policy on companies - restrict to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );
