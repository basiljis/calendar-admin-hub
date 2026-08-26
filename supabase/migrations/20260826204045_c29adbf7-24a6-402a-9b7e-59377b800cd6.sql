ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

-- Существующие пользователи считаются подтверждёнными
UPDATE public.profiles SET is_approved = true;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first boolean;
BEGIN
  SELECT (count(*) = 0) INTO v_first FROM public.user_roles;

  INSERT INTO public.profiles (id, full_name, email, phone, is_approved)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, NEW.raw_user_meta_data->>'phone', v_first)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN v_first THEN 'admin'::public.app_role ELSE 'employee'::public.app_role END)
  ON CONFLICT DO NOTHING;

  IF NOT v_first THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT ur.user_id,
           'Новый пользователь',
           'Зарегистрирован новый пользователь: ' || COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), NEW.email) || '. Требуется подтверждение.',
           'system'
    FROM public.user_roles ur
    WHERE ur.role IN ('admin'::public.app_role, 'manager'::public.app_role);
  END IF;

  RETURN NEW;
END;
$function$;