-- Advisor onboarding, admin review, and conversation meeting scheduling.

CREATE TABLE IF NOT EXISTS public.advisor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  organization TEXT,
  role_title TEXT,
  location TEXT,
  experience TEXT NOT NULL,
  motivation TEXT NOT NULL,
  focus_areas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  profile_url TEXT,
  availability_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT advisor_applications_status_check
    CHECK (status IN ('pending', 'more_info', 'approved', 'denied'))
);

CREATE TABLE IF NOT EXISTS public.advisor_application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.advisor_applications(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_start TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  timezone TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'BraverTogether advisor meeting',
  note TEXT,
  meeting_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meeting_proposals_duration_check CHECK (duration_minutes BETWEEN 15 AND 120),
  CONSTRAINT meeting_proposals_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS advisor_applications_status_submitted_idx
  ON public.advisor_applications(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS advisor_application_events_application_idx
  ON public.advisor_application_events(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meeting_proposals_conversation_created_idx
  ON public.meeting_proposals(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meeting_proposals_participant_status_idx
  ON public.meeting_proposals(proposer_id, status, proposed_start);

DROP TRIGGER IF EXISTS advisor_applications_touch ON public.advisor_applications;
CREATE TRIGGER advisor_applications_touch
  BEFORE UPDATE ON public.advisor_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_content_updated_at();

DROP TRIGGER IF EXISTS meeting_proposals_touch ON public.meeting_proposals;
CREATE TRIGGER meeting_proposals_touch
  BEFORE UPDATE ON public.meeting_proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_content_updated_at();

GRANT SELECT ON public.advisor_applications, public.meeting_proposals TO authenticated;
GRANT ALL ON public.advisor_applications, public.advisor_application_events, public.meeting_proposals TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.advisor_applications, public.meeting_proposals FROM authenticated;

ALTER TABLE public.advisor_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applicants read own application" ON public.advisor_applications;
CREATE POLICY "applicants read own application"
  ON public.advisor_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "participants read meeting proposals" ON public.meeting_proposals;
CREATE POLICY "participants read meeting proposals"
  ON public.meeting_proposals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.teen_id = auth.uid() OR c.advisor_id = auth.uid())
    )
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_proposals;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
