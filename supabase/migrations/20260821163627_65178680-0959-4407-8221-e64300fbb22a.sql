
-- Fix security issues for handle_new_chat_message
ALTER FUNCTION public.handle_new_chat_message() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_chat_message() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_chat_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_chat_message() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_chat_message() TO service_role;
