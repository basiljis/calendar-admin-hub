CREATE TABLE public.shift_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number smallint NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_groups TO authenticated;
GRANT ALL ON public.shift_groups TO service_role;

ALTER TABLE public.shift_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_groups_select_all" ON public.shift_groups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "shift_groups_admin_manager_write" ON public.shift_groups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE TRIGGER update_shift_groups_updated_at BEFORE UPDATE ON public.shift_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_monthly_norms_updated_at();

CREATE TABLE public.positions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "positions_select_all" ON public.positions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "positions_admin_manager_write" ON public.positions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_monthly_norms_updated_at();

INSERT INTO public.shift_groups (number, name) VALUES (1, 'Группа 1'), (2, 'Группа 2');

INSERT INTO public.positions (name) VALUES ('Психолог'), ('Старший психолог'), ('Руководитель'), ('Администратор');