-- Private advisor CV uploads and a durable applicant onboarding gate.

CREATE TABLE IF NOT EXISTS public.advisor_onboarding_intents (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.advisor_onboarding_intents ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.advisor_onboarding_intents TO authenticated;
GRANT ALL ON public.advisor_onboarding_intents TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.advisor_onboarding_intents FROM authenticated;

DROP POLICY IF EXISTS "applicants read own onboarding intent" ON public.advisor_onboarding_intents;
CREATE POLICY "applicants read own onboarding intent"
  ON public.advisor_onboarding_intents FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP TRIGGER IF EXISTS advisor_onboarding_intents_touch ON public.advisor_onboarding_intents;
CREATE TRIGGER advisor_onboarding_intents_touch
  BEFORE UPDATE ON public.advisor_onboarding_intents
  FOR EACH ROW EXECUTE FUNCTION public.touch_content_updated_at();

ALTER TABLE public.advisor_applications
  ADD COLUMN IF NOT EXISTS cv_file_path TEXT,
  ADD COLUMN IF NOT EXISTS cv_original_filename TEXT,
  ADD COLUMN IF NOT EXISTS cv_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS cv_file_size BIGINT,
  ADD COLUMN IF NOT EXISTS cv_file_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS pending_cv_file_path TEXT,
  ADD COLUMN IF NOT EXISTS pending_cv_original_filename TEXT,
  ADD COLUMN IF NOT EXISTS pending_cv_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS pending_cv_file_size BIGINT,
  ADD COLUMN IF NOT EXISTS pending_cv_file_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS pending_previous_status TEXT;

ALTER TABLE public.advisor_applications
  DROP CONSTRAINT IF EXISTS advisor_applications_status_check;
ALTER TABLE public.advisor_applications
  ADD CONSTRAINT advisor_applications_status_check
  CHECK (status IN ('draft', 'pending', 'more_info', 'approved', 'denied'));
ALTER TABLE public.advisor_applications ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.advisor_applications
  DROP CONSTRAINT IF EXISTS advisor_applications_cv_mime_check;
ALTER TABLE public.advisor_applications
  ADD CONSTRAINT advisor_applications_cv_mime_check
  CHECK (
    cv_mime_type IS NULL OR
    cv_mime_type IN (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'advisor-cvs',
  'advisor-cvs',
  false,
  5242880,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Preserve advisor intent for accounts already created through the dedicated signup route.
INSERT INTO public.advisor_onboarding_intents (user_id, started_at)
SELECT id, created_at
FROM auth.users
WHERE raw_user_meta_data ->> 'onboarding_intent' = 'advisor'
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.advisor_onboarding_intents intent
SET completed_at = COALESCE(intent.completed_at, application.submitted_at),
    updated_at = now()
FROM public.advisor_applications application
WHERE application.user_id = intent.user_id
  AND application.status <> 'draft';

CREATE INDEX IF NOT EXISTS advisor_onboarding_incomplete_idx
  ON public.advisor_onboarding_intents(user_id)
  WHERE completed_at IS NULL;
