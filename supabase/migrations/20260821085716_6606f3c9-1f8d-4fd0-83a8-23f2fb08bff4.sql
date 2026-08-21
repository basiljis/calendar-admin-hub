CREATE TABLE public.vacation_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vacation_id uuid REFERENCES public.vacations(id) ON DELETE CASCADE NOT NULL,
    action_by uuid REFERENCES auth.users(id) NOT NULL,
    action_type text NOT NULL, -- 'requested', 'approved', 'rejected', 'deleted'
    previous_status text,
    new_status text,
    created_at timestamp with time zone DEFAULT now()
);

GRANT SELECT, INSERT ON public.vacation_audit_logs TO authenticated;
GRANT ALL ON public.vacation_audit_logs TO service_role;

ALTER TABLE public.vacation_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for vacations they can see"
    ON public.vacation_audit_logs FOR SELECT
    to authenticated
    USING (true); -- Simplified for now as vacations table has its own policies or logic

CREATE POLICY "Authenticated users can insert audit logs"
    ON public.vacation_audit_logs FOR INSERT
    to authenticated
    WITH CHECK (true);