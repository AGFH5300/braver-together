
CREATE OR REPLACE FUNCTION public.guard_advisor_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only service_role (used by the server-side passcode verifier) can set is_advisor = true.
  -- Regular authenticated users can still turn it back off, edit bio, etc.
  IF NEW.is_advisor = true AND (OLD.is_advisor IS DISTINCT FROM true) THEN
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' <> 'service_role' THEN
      NEW.is_advisor := false;
      NEW.is_public := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_advisor_flag ON public.profiles;
CREATE TRIGGER profiles_guard_advisor_flag
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_advisor_flag();
