-- Production database hardening after the advisor application and meeting rollout.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "clients cannot access advisor application events" ON public.advisor_application_events;
CREATE POLICY "clients cannot access advisor application events"
  ON public.advisor_application_events
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "clients cannot access ai usage" ON public.ai_usage_daily;
CREATE POLICY "clients cannot access ai usage"
  ON public.ai_usage_daily
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "users read own conversation read state" ON public.conversation_reads;
CREATE POLICY "users read own conversation read state"
  ON public.conversation_reads FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users create own conversation read state" ON public.conversation_reads;
CREATE POLICY "users create own conversation read state"
  ON public.conversation_reads FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          c.teen_id = (SELECT auth.uid())
          OR c.advisor_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "users update own conversation read state" ON public.conversation_reads;
CREATE POLICY "users update own conversation read state"
  ON public.conversation_reads FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "participants or advisors read conversations" ON public.conversations;
CREATE POLICY "participants or advisors read conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = teen_id
    OR (SELECT auth.uid()) = advisor_id
    OR (
      advisor_id IS NULL
      AND status = 'open'
      AND (SELECT private.has_role((SELECT auth.uid()), 'advisor'::public.app_role))
    )
  );

DROP POLICY IF EXISTS "teens create support requests" ON public.conversations;
CREATE POLICY "teens create support requests"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = teen_id
    AND (
      advisor_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = advisor_id
          AND p.is_advisor = true
          AND p.is_public = true
          AND p.accepting_messages = true
      )
    )
  );

DROP POLICY IF EXISTS "participants read messages" ON public.messages;
CREATE POLICY "participants read messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          c.teen_id = (SELECT auth.uid())
          OR c.advisor_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "participants send human messages" ON public.messages;
CREATE POLICY "participants send human messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_kind = 'human'
    AND sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.status = 'open'
        AND (
          c.teen_id = (SELECT auth.uid())
          OR c.advisor_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "applicants read own application" ON public.advisor_applications;
CREATE POLICY "applicants read own application"
  ON public.advisor_applications FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT private.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  );

DROP POLICY IF EXISTS "participants read meeting proposals" ON public.meeting_proposals;
CREATE POLICY "participants read meeting proposals"
  ON public.meeting_proposals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          c.teen_id = (SELECT auth.uid())
          OR c.advisor_id = (SELECT auth.uid())
        )
    )
  );

CREATE INDEX IF NOT EXISTS advisor_application_events_actor_idx
  ON public.advisor_application_events(actor_id);
CREATE INDEX IF NOT EXISTS advisor_applications_reviewer_idx
  ON public.advisor_applications(reviewed_by);
CREATE INDEX IF NOT EXISTS conversation_reads_user_idx
  ON public.conversation_reads(user_id);
CREATE INDEX IF NOT EXISTS meeting_proposals_responder_idx
  ON public.meeting_proposals(responded_by);
CREATE INDEX IF NOT EXISTS resource_videos_category_idx
  ON public.resource_videos(category_id);

DROP INDEX IF EXISTS public.messages_conversation_created_idx;
