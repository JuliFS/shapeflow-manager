ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_company_unique
ON public.profiles (user_id, company_id)
WHERE company_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_without_company_unique
ON public.profiles (user_id)
WHERE company_id IS NULL;