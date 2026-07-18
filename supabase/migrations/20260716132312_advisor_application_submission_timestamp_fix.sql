ALTER TABLE public.advisor_applications
  ALTER COLUMN submitted_at SET DEFAULT now();
