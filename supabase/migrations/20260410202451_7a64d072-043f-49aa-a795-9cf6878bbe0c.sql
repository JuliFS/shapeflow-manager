
CREATE TABLE public.pricing_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  markup_3d_print numeric NOT NULL DEFAULT 100,
  markup_letra_caixa numeric NOT NULL DEFAULT 200,
  markup_fachada_completa numeric NOT NULL DEFAULT 300,
  min_profit_percent numeric NOT NULL DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view pricing config"
ON public.pricing_config FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can insert pricing config"
ON public.pricing_config FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can update pricing config"
ON public.pricing_config FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE TRIGGER update_pricing_config_updated_at
BEFORE UPDATE ON public.pricing_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
