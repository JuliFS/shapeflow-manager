
-- Function to auto-accept pending invitations for a user
CREATE OR REPLACE FUNCTION public.accept_pending_invitations(_user_id uuid, _email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  FOR inv IN
    SELECT id, company_id, role
    FROM public.company_invitations
    WHERE email = lower(_email) AND status = 'pending'
  LOOP
    -- Add user to company if not already a member
    IF NOT EXISTS (
      SELECT 1 FROM public.user_companies
      WHERE user_id = _user_id AND company_id = inv.company_id
    ) THEN
      INSERT INTO public.user_companies (user_id, company_id, role)
      VALUES (_user_id, inv.company_id, inv.role);
    END IF;

    -- Mark invitation as accepted
    UPDATE public.company_invitations
    SET status = 'accepted'
    WHERE id = inv.id;
  END LOOP;
END;
$$;

-- Allow updating invitation status (needed for the security definer function)
CREATE POLICY "System can update invitations" ON public.company_invitations
  FOR UPDATE TO authenticated
  USING (user_belongs_to_company(auth.uid(), company_id));
