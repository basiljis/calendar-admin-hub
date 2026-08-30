CREATE POLICY "rooms_insert_authenticated" ON public.chat_rooms FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "rooms_update_owner_admin" ON public.chat_rooms FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "rooms_delete_owner_admin" ON public.chat_rooms FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_room_participants TO authenticated;