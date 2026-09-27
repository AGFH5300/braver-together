-- Extend the Voice on Trial partner competition deadline to 15 October 2026.
-- closes_at is stored as an exclusive UTC boundary, so 16 October 00:00 UTC
-- renders as 15 October on the public competition page.

UPDATE public.competitions
SET closes_at = '2026-10-16 00:00:00+00'
WHERE slug = 'voice-on-trial-vidolo-bravertogether-2026';
