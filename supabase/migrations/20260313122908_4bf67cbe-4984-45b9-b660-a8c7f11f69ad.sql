
-- Add CPF to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cpf text;

-- Add frete to quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0;

-- Fixed expenses table
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  monthly_amount numeric NOT NULL DEFAULT 0,
  due_day integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own fixed_expenses" ON public.fixed_expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fixed_expenses" ON public.fixed_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fixed_expenses" ON public.fixed_expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own fixed_expenses" ON public.fixed_expenses FOR DELETE USING (auth.uid() = user_id);

-- Variable expenses table
CREATE TABLE IF NOT EXISTS public.variable_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.variable_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own variable_expenses" ON public.variable_expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own variable_expenses" ON public.variable_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own variable_expenses" ON public.variable_expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own variable_expenses" ON public.variable_expenses FOR DELETE USING (auth.uid() = user_id);

-- Pro-labore table
CREATE TABLE IF NOT EXISTS public.pro_labore (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pro_labore ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pro_labore" ON public.pro_labore FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pro_labore" ON public.pro_labore FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pro_labore" ON public.pro_labore FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pro_labore" ON public.pro_labore FOR DELETE USING (auth.uid() = user_id);

-- Profit distribution table
CREATE TABLE IF NOT EXISTS public.profit_distribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profit_distribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profit_distribution" ON public.profit_distribution FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profit_distribution" ON public.profit_distribution FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profit_distribution" ON public.profit_distribution FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profit_distribution" ON public.profit_distribution FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at triggers
CREATE TRIGGER update_fixed_expenses_updated_at BEFORE UPDATE ON public.fixed_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_variable_expenses_updated_at BEFORE UPDATE ON public.variable_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
