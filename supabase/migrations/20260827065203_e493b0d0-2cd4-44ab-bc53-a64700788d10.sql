CREATE OR REPLACE FUNCTION public.is_room_participant(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_participants
    WHERE room_id = _room_id AND user_id = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_room_participant(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS participants_select ON public.chat_room_participants;
CREATE POLICY participants_select ON public.chat_room_participants
FOR SELECT TO authenticated
USING (public.is_room_participant(room_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS rooms_select ON public.chat_rooms;
CREATE POLICY rooms_select ON public.chat_rooms
FOR SELECT TO authenticated
USING (public.is_room_participant(id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS chat_select_member ON public.chat_messages;
CREATE POLICY chat_select_member ON public.chat_messages
FOR SELECT TO authenticated
USING (room_id IS NULL OR public.is_room_participant(room_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));