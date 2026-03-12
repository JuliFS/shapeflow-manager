
-- =============================================
-- 3D PRINT MANAGER - FULL DATABASE SCHEMA
-- =============================================

-- 1. PROFILES (business info for PDFs)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  company_logo_url TEXT,
  company_address TEXT,
  company_phone TEXT,
  company_email TEXT,
  owner_name TEXT,
  hourly_rate NUMERIC DEFAULT 50,
  modeling_hourly_rate NUMERIC DEFAULT 80,
  default_margin NUMERIC DEFAULT 0.3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- 2. CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own clients" ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON public.clients FOR DELETE USING (auth.uid() = user_id);

-- 3. PRINTERS
CREATE TABLE public.printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purchase_cost NUMERIC NOT NULL DEFAULT 0,
  lifespan_hours NUMERIC NOT NULL DEFAULT 1000,
  power_consumption_watts NUMERIC NOT NULL DEFAULT 200,
  energy_cost_per_kwh NUMERIC NOT NULL DEFAULT 0.80,
  maintenance_cost_per_hour NUMERIC NOT NULL DEFAULT 0.50,
  cost_per_hour NUMERIC GENERATED ALWAYS AS (
    (purchase_cost / NULLIF(lifespan_hours, 0)) + ((power_consumption_watts / 1000.0) * energy_cost_per_kwh) + maintenance_cost_per_hour
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own printers" ON public.printers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own printers" ON public.printers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own printers" ON public.printers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own printers" ON public.printers FOR DELETE USING (auth.uid() = user_id);

-- 4. MATERIALS
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  brand TEXT,
  cost_per_kg NUMERIC NOT NULL DEFAULT 0,
  density NUMERIC DEFAULT 1.24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own materials" ON public.materials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own materials" ON public.materials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own materials" ON public.materials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own materials" ON public.materials FOR DELETE USING (auth.uid() = user_id);

-- 5. FILAMENT STOCK
CREATE TABLE public.filament_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  material_name TEXT NOT NULL,
  initial_weight_g NUMERIC NOT NULL DEFAULT 1000,
  remaining_weight_g NUMERIC NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.filament_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own stock" ON public.filament_stock FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stock" ON public.filament_stock FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stock" ON public.filament_stock FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stock" ON public.filament_stock FOR DELETE USING (auth.uid() = user_id);

-- 6. SOFTWARE
CREATE TABLE public.software (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  monthly_cost NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.software ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own software" ON public.software FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own software" ON public.software FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own software" ON public.software FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own software" ON public.software FOR DELETE USING (auth.uid() = user_id);

-- 7. QUOTES
CREATE TYPE public.quote_status AS ENUM ('draft', 'sent', 'approved', 'rejected');

CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  piece_name TEXT NOT NULL,
  printer_id UUID REFERENCES public.printers(id) ON DELETE SET NULL,
  printer_name TEXT,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  material_name TEXT,
  weight_grams NUMERIC NOT NULL DEFAULT 0,
  print_time_hours NUMERIC NOT NULL DEFAULT 0,
  finishing TEXT,
  post_processing_hours NUMERIC NOT NULL DEFAULT 0,
  has_modeling BOOLEAN DEFAULT false,
  modeling_hours NUMERIC DEFAULT 0,
  material_cost NUMERIC DEFAULT 0,
  machine_cost NUMERIC DEFAULT 0,
  labor_cost NUMERIC DEFAULT 0,
  modeling_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  margin NUMERIC DEFAULT 0.3,
  final_price NUMERIC DEFAULT 0,
  delivery_days INTEGER,
  payment_method TEXT,
  status public.quote_status NOT NULL DEFAULT 'draft',
  stl_file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quotes" ON public.quotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quotes" ON public.quotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quotes" ON public.quotes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own quotes" ON public.quotes FOR DELETE USING (auth.uid() = user_id);

-- 8. ORDERS
CREATE TYPE public.order_status AS ENUM ('queue', 'printing', 'post_processing', 'finished', 'delivered');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  quote_number TEXT,
  client_name TEXT,
  piece_name TEXT,
  final_price NUMERIC DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'queue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own orders" ON public.orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own orders" ON public.orders FOR DELETE USING (auth.uid() = user_id);

-- 9. FINANCIAL RECORDS
CREATE TABLE public.financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT,
  description TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own records" ON public.financial_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own records" ON public.financial_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own records" ON public.financial_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own records" ON public.financial_records FOR DELETE USING (auth.uid() = user_id);

-- 10. UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_printers_updated_at BEFORE UPDATE ON public.printers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_filament_stock_updated_at BEFORE UPDATE ON public.filament_stock FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_software_updated_at BEFORE UPDATE ON public.software FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, owner_name, company_email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. STORAGE BUCKET for STL files
INSERT INTO storage.buckets (id, name, public) VALUES ('stl-files', 'stl-files', false);

CREATE POLICY "Users can upload STL files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stl-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own STL files" ON storage.objects FOR SELECT USING (bucket_id = 'stl-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own STL files" ON storage.objects FOR DELETE USING (bucket_id = 'stl-files' AND auth.uid()::text = (storage.foldername(name))[1]);
