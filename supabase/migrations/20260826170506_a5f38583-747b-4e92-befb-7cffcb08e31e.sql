CREATE TABLE public.chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.chat_message_reactions TO authenticated;
GRANT ALL ON public.chat_message_reactions TO service_role;

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select_visible_messages" ON public.chat_message_reactions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.chat_messages m
  WHERE m.id = message_id
    AND (
      m.room_id IS NULL
      OR EXISTS (SELECT 1 FROM public.chat_room_participants p WHERE p.room_id = m.room_id AND p.user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
));

CREATE POLICY "reactions_insert_self" ON public.chat_message_reactions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_delete_self" ON public.chat_message_reactions
FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_chat_message_reactions_message ON public.chat_message_reactions(message_id);