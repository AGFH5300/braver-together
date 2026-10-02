-- Add Sathvika Kancharla to the public Digital Legal Advisor directory.

INSERT INTO public.public_advisors (
  id,
  linked_user_id,
  display_name,
  headline,
  bio,
  photo_url,
  is_public,
  sort_order
)
VALUES (
  '8458f4c0-299d-4968-9787-d7c0c2d55a29',
  NULL,
  'Sathvika Kancharla',
  '17 · BA LLB (Hons) Undergraduate, GITAM School of Law, Visakhapatnam',
  'I’m curious about how digital law and AI affect teenagers. With the rapid growth of AI-generated tools and increasing misuse, I want to help young people understand these technologies and their risks. As a young woman, I’m especially motivated to raise awareness and help current and future generations use technology more safely and responsibly.',
  '/advisors/sathvika.svg',
  true,
  6
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  headline = EXCLUDED.headline,
  bio = EXCLUDED.bio,
  photo_url = EXCLUDED.photo_url,
  is_public = EXCLUDED.is_public,
  sort_order = EXCLUDED.sort_order;
