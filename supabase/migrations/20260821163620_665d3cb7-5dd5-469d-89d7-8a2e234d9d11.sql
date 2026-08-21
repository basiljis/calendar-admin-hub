
-- Table to track last read message per user per room
CREATE TABLE public.chat_read_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE, -- NULL means global chat
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, room_id)
);

GRANT SELECT, INSERT, UPDATE ON public.chat_read_status TO authenticated;
GRANT ALL ON public.chat_read_status TO service_role;

ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own read status"
ON public.chat_read_status
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- Function to notify users of new chat messages
CREATE OR REPLACE FUNCTION public.handle_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
    participant_id UUID;
    sender_name TEXT;
BEGIN
    SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.user_id;

    IF NEW.room_id IS NOT NULL THEN
        FOR participant_id IN 
            SELECT user_id FROM public.chat_room_participants 
            WHERE room_id = NEW.room_id AND user_id != NEW.user_id
        LOOP
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                participant_id,
                'Новое сообщение',
                'У вас новое сообщение в чате от ' || COALESCE(sender_name, 'сотрудника'),
                'chat'
            );
        END LOOP;
    ELSE
        FOR participant_id IN 
            SELECT id FROM public.profiles WHERE id != NEW.user_id
        LOOP
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                participant_id,
                'Общий чат',
                'Новое сообщение от ' || COALESCE(sender_name, 'сотрудника'),
                'chat'
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_chat_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.handle_new_chat_message();
