
-- 1. Create companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Minha Empresa',
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Create user_companies junction table
CREATE TABLE public.user_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- 3. Create parts table
CREATE TABLE public.parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  default_material_id uuid REFERENCES public.materials(id),
  default_material_name text,
  avg_weight_grams numeric DEFAULT 0,
  avg_print_time_hours numeric DEFAULT 0,
  stl_file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

-- 4. Security definer function
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

-- 5. Add company_id to all existing tables
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.filament_stock ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.fixed_expenses ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.variable_expenses ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.pro_labore ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.profit_distribution ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.software ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- 6. Migrate existing data: create companies for existing users
DO $$
DECLARE
  r RECORD;
  new_company_id uuid;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.profiles LOOP
    INSERT INTO public.companies (name) VALUES ('Minha Empresa') RETURNING id INTO new_company_id;
    INSERT INTO public.user_companies (user_id, company_id, role) VALUES (r.user_id, new_company_id, 'owner');
    UPDATE public.clients SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.quotes SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.orders SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.materials SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.printers SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.filament_stock SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.financial_records SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.fixed_expenses SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.variable_expenses SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.pro_labore SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.profit_distribution SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.software SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
    UPDATE public.profiles SET company_id = new_company_id WHERE user_id = r.user_id AND company_id IS NULL;
  END LOOP;
END $$;

-- 7. RLS for companies
CREATE POLICY "Users can view own companies" ON public.companies
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_companies WHERE company_id = companies.id AND user_id = auth.uid()));
CREATE POLICY "Users can update own companies" ON public.companies
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_companies WHERE company_id = companies.id AND user_id = auth.uid()));
CREATE POLICY "Authenticated users can create companies" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (true);

-- 8. RLS for user_companies
CREATE POLICY "Users can view own memberships" ON public.user_companies
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert memberships" ON public.user_companies
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own memberships" ON public.user_companies
  FOR DELETE USING (user_id = auth.uid());

-- 9. RLS for parts
CREATE POLICY "Users can view company parts" ON public.parts
  FOR SELECT USING (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "Users can insert company parts" ON public.parts
  FOR INSERT WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "Users can update company parts" ON public.parts
  FOR UPDATE USING (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "Users can delete company parts" ON public.parts
  FOR DELETE USING (public.user_belongs_to_company(auth.uid(), company_id));

-- 10. Update RLS for existing tables to support both company_id and user_id fallback
-- CLIENTS
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;
CREATE POLICY "Company members can view clients" ON public.clients FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert clients" ON public.clients FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update clients" ON public.clients FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete clients" ON public.clients FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- QUOTES
DROP POLICY IF EXISTS "Users can view own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON public.quotes;
CREATE POLICY "Company members can view quotes" ON public.quotes FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert quotes" ON public.quotes FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update quotes" ON public.quotes FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete quotes" ON public.quotes FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- ORDERS
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete own orders" ON public.orders;
CREATE POLICY "Company members can view orders" ON public.orders FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert orders" ON public.orders FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update orders" ON public.orders FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete orders" ON public.orders FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- MATERIALS
DROP POLICY IF EXISTS "Users can view own materials" ON public.materials;
DROP POLICY IF EXISTS "Users can insert own materials" ON public.materials;
DROP POLICY IF EXISTS "Users can update own materials" ON public.materials;
DROP POLICY IF EXISTS "Users can delete own materials" ON public.materials;
CREATE POLICY "Company members can view materials" ON public.materials FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert materials" ON public.materials FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update materials" ON public.materials FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete materials" ON public.materials FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- PRINTERS
DROP POLICY IF EXISTS "Users can view own printers" ON public.printers;
DROP POLICY IF EXISTS "Users can insert own printers" ON public.printers;
DROP POLICY IF EXISTS "Users can update own printers" ON public.printers;
DROP POLICY IF EXISTS "Users can delete own printers" ON public.printers;
CREATE POLICY "Company members can view printers" ON public.printers FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert printers" ON public.printers FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update printers" ON public.printers FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete printers" ON public.printers FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- FILAMENT_STOCK
DROP POLICY IF EXISTS "Users can view own stock" ON public.filament_stock;
DROP POLICY IF EXISTS "Users can insert own stock" ON public.filament_stock;
DROP POLICY IF EXISTS "Users can update own stock" ON public.filament_stock;
DROP POLICY IF EXISTS "Users can delete own stock" ON public.filament_stock;
CREATE POLICY "Company members can view stock" ON public.filament_stock FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert stock" ON public.filament_stock FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update stock" ON public.filament_stock FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete stock" ON public.filament_stock FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- FINANCIAL_RECORDS
DROP POLICY IF EXISTS "Users can view own records" ON public.financial_records;
DROP POLICY IF EXISTS "Users can insert own records" ON public.financial_records;
DROP POLICY IF EXISTS "Users can update own records" ON public.financial_records;
DROP POLICY IF EXISTS "Users can delete own records" ON public.financial_records;
CREATE POLICY "Company members can view records" ON public.financial_records FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert records" ON public.financial_records FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update records" ON public.financial_records FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete records" ON public.financial_records FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- FIXED_EXPENSES
DROP POLICY IF EXISTS "Users can view own fixed_expenses" ON public.fixed_expenses;
DROP POLICY IF EXISTS "Users can insert own fixed_expenses" ON public.fixed_expenses;
DROP POLICY IF EXISTS "Users can update own fixed_expenses" ON public.fixed_expenses;
DROP POLICY IF EXISTS "Users can delete own fixed_expenses" ON public.fixed_expenses;
CREATE POLICY "Company members can view fixed_expenses" ON public.fixed_expenses FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert fixed_expenses" ON public.fixed_expenses FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update fixed_expenses" ON public.fixed_expenses FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete fixed_expenses" ON public.fixed_expenses FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- VARIABLE_EXPENSES
DROP POLICY IF EXISTS "Users can view own variable_expenses" ON public.variable_expenses;
DROP POLICY IF EXISTS "Users can insert own variable_expenses" ON public.variable_expenses;
DROP POLICY IF EXISTS "Users can update own variable_expenses" ON public.variable_expenses;
DROP POLICY IF EXISTS "Users can delete own variable_expenses" ON public.variable_expenses;
CREATE POLICY "Company members can view variable_expenses" ON public.variable_expenses FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert variable_expenses" ON public.variable_expenses FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update variable_expenses" ON public.variable_expenses FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete variable_expenses" ON public.variable_expenses FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- PRO_LABORE
DROP POLICY IF EXISTS "Users can view own pro_labore" ON public.pro_labore;
DROP POLICY IF EXISTS "Users can insert own pro_labore" ON public.pro_labore;
DROP POLICY IF EXISTS "Users can update own pro_labore" ON public.pro_labore;
DROP POLICY IF EXISTS "Users can delete own pro_labore" ON public.pro_labore;
CREATE POLICY "Company members can view pro_labore" ON public.pro_labore FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert pro_labore" ON public.pro_labore FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update pro_labore" ON public.pro_labore FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete pro_labore" ON public.pro_labore FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- PROFIT_DISTRIBUTION
DROP POLICY IF EXISTS "Users can view own profit_distribution" ON public.profit_distribution;
DROP POLICY IF EXISTS "Users can insert own profit_distribution" ON public.profit_distribution;
DROP POLICY IF EXISTS "Users can update own profit_distribution" ON public.profit_distribution;
DROP POLICY IF EXISTS "Users can delete own profit_distribution" ON public.profit_distribution;
CREATE POLICY "Company members can view profit_distribution" ON public.profit_distribution FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert profit_distribution" ON public.profit_distribution FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update profit_distribution" ON public.profit_distribution FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete profit_distribution" ON public.profit_distribution FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- SOFTWARE
DROP POLICY IF EXISTS "Users can view own software" ON public.software;
DROP POLICY IF EXISTS "Users can insert own software" ON public.software;
DROP POLICY IF EXISTS "Users can update own software" ON public.software;
DROP POLICY IF EXISTS "Users can delete own software" ON public.software;
CREATE POLICY "Company members can view software" ON public.software FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert software" ON public.software FOR INSERT WITH CHECK (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can update software" ON public.software FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can delete software" ON public.software FOR DELETE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Company members can view profiles" ON public.profiles FOR SELECT USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);
CREATE POLICY "Company members can insert profiles" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Company members can update profiles" ON public.profiles FOR UPDATE USING (
  CASE WHEN company_id IS NOT NULL THEN public.user_belongs_to_company(auth.uid(), company_id) ELSE auth.uid() = user_id END
);

-- 11. Update handle_new_user to auto-create company
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_company_id uuid;
BEGIN
  INSERT INTO public.companies (name) VALUES ('Minha Empresa') RETURNING id INTO new_company_id;
  INSERT INTO public.user_companies (user_id, company_id, role) VALUES (NEW.id, new_company_id, 'owner');
  INSERT INTO public.profiles (user_id, owner_name, company_email, company_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, new_company_id);
  RETURN NEW;
END;
$$;
