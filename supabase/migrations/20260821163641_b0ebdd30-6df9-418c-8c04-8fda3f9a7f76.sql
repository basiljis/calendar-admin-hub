
-- Determine which function is still causing the linter warning
-- Note: 'handle_new_user' and 'has_role' were already present. 
-- The warning is likely on 'has_role' or 'handle_new_user' if I didn't touch them, 
-- but I should make sure my new function is fully secured.

ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
