CREATE TABLE public.attendance_marks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  marked_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_marks TO authenticated;
GRANT ALL ON public.attendance_marks TO service_role;

ALTER TABLE public.attendance_marks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select_all" ON public.attendance_marks
FOR SELECT TO authenticated USING (true);

CREATE POLICY "attendance_insert_self" ON public.attendance_marks
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "attendance_update_privileged" ON public.attendance_marks
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "attendance_delete_privileged" ON public.attendance_marks
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));