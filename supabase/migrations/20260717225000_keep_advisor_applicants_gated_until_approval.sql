-- Advisor applicants remain gated until an administrator approves the application.

UPDATE public.advisor_onboarding_intents AS intent
SET completed_at = CASE
      WHEN application.status = 'approved'
        THEN COALESCE(intent.completed_at, application.reviewed_at, application.updated_at, now())
      ELSE NULL
    END,
    updated_at = now()
FROM public.advisor_applications AS application
WHERE application.user_id = intent.user_id;

UPDATE public.advisor_onboarding_intents AS intent
SET completed_at = COALESCE(intent.completed_at, now()),
    updated_at = now()
FROM public.profiles AS profile
WHERE profile.id = intent.user_id
  AND profile.is_advisor = true;
