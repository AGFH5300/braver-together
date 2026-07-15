CREATE OR REPLACE FUNCTION public.guard_conversation_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  jwt_role text := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
BEGIN
  IF jwt_role <> 'service_role' AND pg_trigger_depth() = 1 THEN
    IF NEW.teen_id IS DISTINCT FROM OLD.teen_id
      OR NEW.advisor_id IS DISTINCT FROM OLD.advisor_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.last_message_at IS DISTINCT FROM OLD.last_message_at THEN
      RAISE EXCEPTION 'Conversation participants and timestamps cannot be changed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_guard_update ON public.conversations;
CREATE TRIGGER conversations_guard_update
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_conversation_update();

REVOKE EXECUTE ON FUNCTION public.guard_conversation_update() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "teen starts conversation" ON public.conversations;
CREATE POLICY "teen starts conversation"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = teen_id
    AND teen_id <> advisor_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles advisor
      WHERE advisor.id = advisor_id
        AND advisor.is_advisor = true
        AND advisor.is_public = true
        AND advisor.accepting_messages = true
    )
  );

DROP POLICY IF EXISTS "participants update conversation" ON public.conversations;
CREATE POLICY "participants update conversation"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = teen_id OR auth.uid() = advisor_id)
  WITH CHECK (auth.uid() = teen_id OR auth.uid() = advisor_id);
