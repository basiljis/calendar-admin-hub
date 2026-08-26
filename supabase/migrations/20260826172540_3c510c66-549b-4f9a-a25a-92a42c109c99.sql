CREATE TABLE public.monthly_norms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  norm_hours NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);
GRANT SELECT ON public.monthly_norms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_norms TO authenticated;
GRANT ALL ON public.monthly_norms TO service_role;
ALTER TABLE public.monthly_norms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monthly_norms_select_all" ON public.monthly_norms FOR SELECT TO authenticated USING (true);
CREATE POLICY "monthly_norms_admin_manager_write" ON public.monthly_norms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE OR REPLACE FUNCTION public.update_monthly_norms_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_monthly_norms_updated_at BEFORE UPDATE ON public.monthly_norms FOR EACH ROW EXECUTE FUNCTION public.update_monthly_norms_updated_at();