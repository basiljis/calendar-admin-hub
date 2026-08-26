CREATE POLICY "vacations_insert_self" ON public.vacations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "vacations_update_own_pending" ON public.vacations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "vacations_delete_own_pending" ON public.vacations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');