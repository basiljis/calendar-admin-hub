CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_first boolean;
  v_admin_created boolean;
BEGIN
  SELECT (count(*) = 0) INTO v_first FROM public.user_roles;
  v_admin_created := COALESCE(NEW.raw_user_meta_data->>'approved_by_admin', 'false') = 'true';

  INSERT INTO public.profiles (id, full_name, email, phone, position, shift_group, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'position', 'Психолог'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'shift_group', '')::smallint, 1),
    v_first OR v_admin_created
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN v_first THEN 'admin'::public.app_role
      WHEN v_admin_created AND NEW.raw_user_meta_data->>'role' IN ('admin', 'manager') THEN NEW.raw_user_meta_data->>'role'::public.app_role
      ELSE 'employee'::public.app_role
    END
  )
  ON CONFLICT DO NOTHING;

  IF NOT v_first AND NOT v_admin_created THEN
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