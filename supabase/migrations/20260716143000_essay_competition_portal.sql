-- Essay competition configuration, private submissions, audit history and storage.

CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  minimum_age INTEGER NOT NULL DEFAULT 12,
  maximum_age INTEGER NOT NULL DEFAULT 18,
  minimum_words INTEGER,
  maximum_words INTEGER,
  prize_text TEXT,
  rules_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT competitions_status_check CHECK (status IN ('draft', 'open', 'closed', 'judging', 'published')),
  CONSTRAINT competitions_age_check CHECK (minimum_age BETWEEN 1 AND 120 AND maximum_age BETWEEN minimum_age AND 120),
  CONSTRAINT competitions_words_check CHECK (
    (minimum_words IS NULL OR minimum_words > 0)
    AND (maximum_words IS NULL OR maximum_words > 0)
    AND (minimum_words IS NULL OR maximum_words IS NULL OR maximum_words >= minimum_words)
  ),
  CONSTRAINT competitions_window_check CHECK (opens_at IS NULL OR closes_at IS NULL OR closes_at > opens_at)
);

CREATE TABLE IF NOT EXISTS public.essay_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_code TEXT NOT NULL UNIQUE,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  participant_age INTEGER NOT NULL,
  country TEXT NOT NULL,
  school_name TEXT,
  essay_title TEXT NOT NULL,
  declared_word_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  revision_number INTEGER NOT NULL DEFAULT 0,
  file_path TEXT,
  original_filename TEXT,
  mime_type TEXT,
  file_size BIGINT,
  file_sha256 TEXT,
  pending_file_path TEXT,
  pending_original_filename TEXT,
  pending_mime_type TEXT,
  pending_file_size BIGINT,
  pending_file_sha256 TEXT,
  rules_accepted_at TIMESTAMPTZ,
  originality_confirmed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT essay_submissions_one_per_user UNIQUE (competition_id, user_id),
  CONSTRAINT essay_submissions_age_check CHECK (participant_age BETWEEN 1 AND 120),
  CONSTRAINT essay_submissions_word_count_check CHECK (declared_word_count BETWEEN 1 AND 50000),
  CONSTRAINT essay_submissions_revision_check CHECK (revision_number >= 0),
  CONSTRAINT essay_submissions_status_check CHECK (
    status IN ('draft', 'submitted', 'under_review', 'shortlisted', 'winner', 'not_selected', 'disqualified', 'withdrawn')
  )
);

CREATE TABLE IF NOT EXISTS public.essay_submission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.essay_submissions(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competitions_public_status_idx
  ON public.competitions(is_public, status, closes_at);
CREATE INDEX IF NOT EXISTS essay_submissions_competition_status_idx
  ON public.essay_submissions(competition_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS essay_submissions_user_idx
  ON public.essay_submissions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS essay_submissions_reviewer_idx
  ON public.essay_submissions(reviewed_by);
CREATE INDEX IF NOT EXISTS essay_submission_events_submission_idx
  ON public.essay_submission_events(submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS essay_submission_events_actor_idx
  ON public.essay_submission_events(actor_id);

CREATE OR REPLACE FUNCTION private.touch_competition_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS competitions_touch ON public.competitions;
CREATE TRIGGER competitions_touch
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION private.touch_competition_updated_at();

DROP TRIGGER IF EXISTS essay_submissions_touch ON public.essay_submissions;
CREATE TRIGGER essay_submissions_touch
  BEFORE UPDATE ON public.essay_submissions
  FOR EACH ROW EXECUTE FUNCTION private.touch_competition_updated_at();

INSERT INTO public.competitions (
  slug,
  title,
  summary,
  status,
  minimum_age,
  maximum_age,
  prize_text,
  is_public
) VALUES (
  'inaugural-digital-rights-essay',
  'Inaugural Digital Rights Essay Competition',
  'Write a teen-perspective essay about a digital-rights issue that matters to you. Full dates, rules, judging criteria and prize details will be published before submissions open.',
  'draft',
  12,
  18,
  'To be announced',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  minimum_age = EXCLUDED.minimum_age,
  maximum_age = EXCLUDED.maximum_age,
  is_public = EXCLUDED.is_public;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'essay-submissions',
  'essay-submissions',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essay_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essay_submission_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read announced competitions" ON public.competitions;
CREATE POLICY "public read announced competitions"
  ON public.competitions
  FOR SELECT
  USING (is_public = true AND status <> 'draft');

DROP POLICY IF EXISTS "service only essay submissions" ON public.essay_submissions;
CREATE POLICY "service only essay submissions"
  ON public.essay_submissions
  FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "service only essay submission events" ON public.essay_submission_events;
CREATE POLICY "service only essay submission events"
  ON public.essay_submission_events
  FOR ALL
  USING (false)
  WITH CHECK (false);

GRANT SELECT ON public.competitions TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.competitions FROM anon, authenticated;
REVOKE ALL ON public.essay_submissions, public.essay_submission_events FROM anon, authenticated;
GRANT ALL ON public.competitions, public.essay_submissions, public.essay_submission_events TO service_role;
REVOKE ALL ON FUNCTION private.touch_competition_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.touch_competition_updated_at() TO service_role;
