-- Keep advisor status server-controlled and profile visibility internally consistent.
CREATE OR REPLACE FUNCTION public.guard_advisor_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  request_role text := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
BEGIN
  IF request_role <> 'service_role'
     AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    NEW.is_advisor := OLD.is_advisor;
  END IF;

  IF NEW.is_advisor = false THEN
    NEW.is_public := false;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_advisor_flag() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_public_requires_advisor
  CHECK (is_public = false OR is_advisor = true);

-- Replace exposed SECURITY DEFINER role helper with a direct, RLS-safe policy.
DROP POLICY IF EXISTS "admins read reports" ON public.reports;
CREATE POLICY "admins read reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles role_row
      WHERE role_row.user_id = (SELECT auth.uid())
        AND role_row.role = 'admin'
    )
  );

DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role);

-- Optimize auth lookups and avoid overlapping authenticated SELECT policies.
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "public advisor profiles" ON public.profiles;
DROP POLICY IF EXISTS "users read own profile" ON public.profiles;
CREATE POLICY "anon reads public advisor profiles"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (is_advisor = true AND is_public = true);
CREATE POLICY "authenticated reads profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (is_advisor = true AND is_public = true)
  );

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;
CREATE POLICY "users insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "participants read conversation" ON public.conversations;
CREATE POLICY "participants read conversation"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = teen_id OR (SELECT auth.uid()) = advisor_id);

DROP POLICY IF EXISTS "teen starts conversation" ON public.conversations;
CREATE POLICY "teen starts conversation"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = teen_id
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
  USING ((SELECT auth.uid()) = teen_id OR (SELECT auth.uid()) = advisor_id)
  WITH CHECK ((SELECT auth.uid()) = teen_id OR (SELECT auth.uid()) = advisor_id);

DROP POLICY IF EXISTS "participants read messages" ON public.messages;
CREATE POLICY "participants read messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations conversation
      WHERE conversation.id = conversation_id
        AND (
          conversation.teen_id = (SELECT auth.uid())
          OR conversation.advisor_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "participants send messages" ON public.messages;
CREATE POLICY "participants send messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.conversations conversation
      WHERE conversation.id = conversation_id
        AND (
          conversation.teen_id = (SELECT auth.uid())
          OR conversation.advisor_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "participants file report" ON public.reports;
CREATE POLICY "participants file report"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.conversations conversation
      WHERE conversation.id = conversation_id
        AND (
          conversation.teen_id = (SELECT auth.uid())
          OR conversation.advisor_id = (SELECT auth.uid())
        )
    )
  );

-- Cover foreign keys and the application's common ordering/filter patterns.
CREATE INDEX IF NOT EXISTS conversations_teen_last_message_idx
  ON public.conversations (teen_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_advisor_last_message_idx
  ON public.conversations (advisor_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_idx
  ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS reports_conversation_idx
  ON public.reports (conversation_id);
CREATE INDEX IF NOT EXISTS reports_reporter_idx
  ON public.reports (reporter_id);
CREATE INDEX IF NOT EXISTS profiles_public_advisors_idx
  ON public.profiles (created_at)
  WHERE is_advisor = true AND is_public = true;
