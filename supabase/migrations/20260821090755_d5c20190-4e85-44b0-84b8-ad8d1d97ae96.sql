-- Create chat_rooms table
CREATE TABLE public.chat_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    is_group boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Create chat_room_participants table
CREATE TABLE public.chat_room_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(room_id, user_id)
);

-- Modify chat_messages to support rooms
ALTER TABLE public.chat_messages ADD COLUMN room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_rooms TO authenticated;
GRANT ALL ON public.chat_rooms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_room_participants TO authenticated;
GRANT ALL ON public.chat_room_participants TO service_role;

-- Enable RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY "rooms_select" ON public.chat_rooms FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.chat_room_participants
        WHERE room_id = public.chat_rooms.id AND user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for participants
CREATE POLICY "participants_select" ON public.chat_room_participants FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.chat_room_participants p
        WHERE p.room_id = public.chat_room_participants.room_id AND p.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "participants_insert" ON public.chat_room_participants FOR INSERT TO authenticated
WITH CHECK (true);

-- Update chat_messages policy
DROP POLICY IF EXISTS "chat_select_all" ON public.chat_messages;
CREATE POLICY "chat_select_member" ON public.chat_messages FOR SELECT TO authenticated
USING (
    room_id IS NULL OR
    EXISTS (
        SELECT 1 FROM public.chat_room_participants
        WHERE room_id = public.chat_messages.room_id AND user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_participants;
