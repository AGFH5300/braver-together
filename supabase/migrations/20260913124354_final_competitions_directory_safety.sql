-- Founder-approved September 4 content; preserve existing competition and entry IDs.
ALTER TABLE public.competitions ALTER COLUMN minimum_age DROP NOT NULL;
ALTER TABLE public.competitions ALTER COLUMN minimum_age DROP DEFAULT;
ALTER TABLE public.competitions DROP CONSTRAINT competitions_age_check;
ALTER TABLE public.competitions ADD CONSTRAINT competitions_age_check CHECK (maximum_age BETWEEN 0 AND 120 AND (minimum_age IS NULL OR minimum_age BETWEEN 0 AND maximum_age));
ALTER TABLE public.competitions ADD COLUMN category text NOT NULL DEFAULT 'essay' CHECK (category IN ('essay','public-speaking'));
ALTER TABLE public.competitions ADD COLUMN prompts text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.competitions ADD COLUMN public_rules text NOT NULL DEFAULT '';
ALTER TABLE public.competitions ADD COLUMN results_at timestamptz;
ALTER TABLE public.essay_submissions DROP CONSTRAINT essay_submissions_age_check;
ALTER TABLE public.essay_submissions ADD CONSTRAINT essay_submissions_age_check CHECK (participant_age BETWEEN 0 AND 120);
ALTER TABLE public.essay_submissions DROP CONSTRAINT essay_submissions_word_count_check;
ALTER TABLE public.essay_submissions ADD CONSTRAINT essay_submissions_word_count_check CHECK (declared_word_count BETWEEN 0 AND 50000);
UPDATE public.competitions SET
slug='digital-legal-rights-essay-2026', title='Digital Legal Rights Essay Competition',
summary='Explore digital legal rights through one of four prompts about social media, teen privacy, human rights and artificial intelligence.',
status='open', is_public=true, minimum_age=NULL, maximum_age=18, minimum_words=NULL, maximum_words=1500,
opens_at='2026-08-07T00:00:00Z', closes_at='2026-10-11T00:00:00Z', results_at='2026-10-25T00:00:00Z',
prize_text='First Prize: $250 USD. Runner-up and honourable recognition may include publication on the BraverTogether website.',
rules_url=NULL, public_rules='Choose one prompt. Submit your original essay as a PDF or DOCX (maximum 10 MB). Include an essay title and acknowledge the sources you use. Maximum 1,500 words. One entry per participant; you may replace or withdraw your entry while submissions remain open.',
prompts=ARRAY['Every kidfluencer law so far pays a child for their labor but doesn’t regulate their exposure. Should the law try to protect a child’s psychological privacy the same way it protects their earnings — and if so, what would that law even look like?','Social media algorithms track teens to build the addictive, personalized feeds parents want restricted, but that same tracking is also what flags self-harm content and connects teens to peer support. Where should the law draw the line between algorithmic tracking that protects a teen and algorithmic tracking that exploits one, when it’s often the exact same data doing both jobs?','Since 2012, the UN Human Rights Council’s guiding principle on digital rights has been that existing human rights apply online just as they do offline, rather than requiring a new framework specific to digital life. Does this principle remain adequate to the challenges of the digital age, or does it warrant reconsideration?','In 2018, Amazon scrapped an AI hiring tool after discovering it had taught itself to penalize resumes containing the word ‘women’s,’ having been trained on a decade of resumes submitted mostly by men. Under existing employment discrimination law, should liability for that outcome fall on Amazon for deploying the tool, on the engineers who built it without catching the bias, or on no one — on the theory that the algorithm only automated a pattern that already existed in who got hired?']::text[]
WHERE slug='inaugural-digital-rights-essay';

-- Serialize AI delivery with advisor assignment/closing, and reject stale AI responses.
CREATE OR REPLACE FUNCTION private.guard_ai_message_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE c public.conversations%ROWTYPE;
BEGIN
 IF NEW.sender_kind = 'ai' THEN
  SELECT * INTO c FROM public.conversations WHERE id=NEW.conversation_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'open' OR c.advisor_id IS NOT NULL OR NOT c.ai_fallback_enabled THEN
   RAISE EXCEPTION 'A human advisor is handling this request or AI is unavailable.';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_ai_message_delivery() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.guard_ai_message_delivery() TO service_role;
CREATE TRIGGER guard_ai_message_delivery BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION private.guard_ai_message_delivery();

CREATE TABLE public.public_advisors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 linked_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
 display_name text NOT NULL,
 headline text,
 bio text,
 photo_url text CHECK (photo_url IS NULL OR photo_url LIKE '/advisors/%'),
 sort_order integer NOT NULL DEFAULT 0,
 is_public boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.public_advisors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published advisor directory" ON public.public_advisors FOR SELECT TO anon,authenticated USING(is_public);
GRANT SELECT (id,display_name,headline,bio,photo_url,sort_order,is_public) ON public.public_advisors TO anon,authenticated;
GRANT ALL ON public.public_advisors TO service_role;
CREATE INDEX public_advisors_public_order_idx ON public.public_advisors(is_public,sort_order);
CREATE TRIGGER public_advisors_touch BEFORE UPDATE ON public.public_advisors FOR EACH ROW EXECUTE FUNCTION private.touch_competition_updated_at();

ALTER TABLE public.reports ADD COLUMN status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved'));
ALTER TABLE public.reports ADD COLUMN resolution_note text;
ALTER TABLE public.reports ADD COLUMN reviewed_at timestamptz;
ALTER TABLE public.reports ADD COLUMN reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX reports_status_created_idx ON public.reports(status,created_at DESC);
CREATE INDEX reports_reviewed_by_idx ON public.reports(reviewed_by);

-- Founder-supplied directory only: no auth users or privileged roles are created.
INSERT INTO public.public_advisors(display_name,headline,bio,sort_order,is_public) VALUES
('Qurratulain Azza Kazmi','18 · Gap year · LLB','Hi everyone! I’m an aspiring lawyer who wants to create an impact in my community.',0,true),
('Ritishaa Senthilkumar','17 · Year 13, Cambridge International School Dubai','Hey, I’m Ritishaa! I’m a Year 13 student at CIS Dubai with a real interest in digital literacy, youth advocacy and especially, how the law applies to our everyday lives online without us ever actually noticing. Outside of school, I enjoy independently researching and analysing key judgments and legal principles that set precedent, alongside my involvement in debate, public speaking, MUN and teaching. I’m looking forward to being a Digital Legal Advisor because I want to take the opportunity to make the law feel less intimidating and more accessible to young people.',1,true),
('Orion Fernandes','18 · LLB Honours, Middlesex University','I’m a first year law student with experience in firms that handle internet related cases. I would be well suited for the role due to aforementioned experience, as well as my ongoing commitment towards my community. Since high school, ive been highly involved in volunteering activities, and even being appointed the head of such volunteering organisation in my school, with over a 100 members.',2,true),
('Maliha Khan','18 · Incoming LLB (Hons), Middlesex University Dubai','Hi, I’m Maliha, and I’m an incoming LLB (Hons) Law student at Middlesex University Dubai. I’ve always been interested in law, particularly in areas where it can be used to support and empower people. I’m especially interested in human rights, women’s rights, and how legal knowledge can make a real difference in people’s lives.

I’m interested in this opportunity because I’d love to gain practical experience, learn from others, and use what I’m learning about law in a meaningful way. I’m also excited to develop my communication and legal skills while contributing to something that has a positive impact.',3,true),
('Rory Sundar','BA English, King’s College London','As someone who has had to manage their Mental health by themselves all their life i would love to help others and spread awareness about mental health :)',4,true),
('Aneeksha','Starting Law, King’s College London','heyy, i’m aneeksha :) i’m about to start uni at King’s College London to study Law, and honestly, i know what it’s like to be confused about the law.

There’s so much legal stuff we deal with online without ever really being taught what our rights are or what we’re actually supposed to do when something goes wrong. As I’m starting my own legal journey, I’m excited to be learning too while being part of BraverTogether and helping make digital law a little less intimidating and a lot easier to understand. So please feel free to reach out!!',5,true);

-- Service-only atomic allowance: parallel requests cannot overwrite each other's count.
CREATE FUNCTION public.consume_ai_allowance(p_feature text,p_actor_key text,p_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE used integer;
BEGIN
 IF p_feature NOT IN ('decoder','support') OR p_limit < 1 OR p_limit > 20 THEN RAISE EXCEPTION 'Invalid allowance'; END IF;
 INSERT INTO public.ai_usage_daily(feature,actor_key,usage_date,request_count,updated_at)
 VALUES(p_feature,p_actor_key,(now() AT TIME ZONE 'UTC')::date,1,now())
 ON CONFLICT(feature,actor_key,usage_date) DO UPDATE SET request_count=public.ai_usage_daily.request_count+1,updated_at=now()
 WHERE public.ai_usage_daily.request_count < p_limit
 RETURNING request_count INTO used;
 IF used IS NULL THEN RAISE EXCEPTION 'Daily AI limit reached'; END IF;
 RETURN p_limit-used;
END; $$;
REVOKE ALL ON FUNCTION public.consume_ai_allowance(text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_allowance(text,text,integer) TO service_role;

UPDATE public.public_advisors SET photo_url='/advisors/ritishaa-320.webp' WHERE display_name='Ritishaa Senthilkumar';
UPDATE public.public_advisors SET photo_url='/advisors/orion-320.webp' WHERE display_name='Orion Fernandes';
UPDATE public.public_advisors SET photo_url='/advisors/maliha-320.webp' WHERE display_name='Maliha Khan';
UPDATE public.public_advisors SET photo_url='/advisors/rory-320.webp' WHERE display_name='Rory Sundar';
UPDATE public.public_advisors SET photo_url='/advisors/aneeksha-320.webp' WHERE display_name='Aneeksha';

-- RLS must enforce the same fail-closed role resolution as the server functions.
CREATE FUNCTION private.current_account_role() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := auth.uid(); a boolean; p boolean; approved boolean; member boolean;
BEGIN
 IF u IS NULL THEN RETURN 'restricted'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role='admin') THEN RETURN 'administrator'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role='advisor'),
 EXISTS(SELECT 1 FROM public.profiles WHERE id=u AND is_advisor),
 EXISTS(SELECT 1 FROM public.advisor_applications WHERE user_id=u AND status='approved'),
 EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role='teen') INTO a,p,approved,member;
 IF a AND p AND approved THEN RETURN 'advisor'; END IF;
 IF a OR p OR approved OR NOT member THEN RETURN 'restricted'; END IF;
 RETURN 'member';
END; $$;
REVOKE ALL ON FUNCTION private.current_account_role() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.current_account_role() TO authenticated,service_role;
CREATE FUNCTION private.is_message_advisor(u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=u AND p.is_advisor AND p.is_public AND p.accepting_messages)
 AND EXISTS(SELECT 1 FROM public.advisor_applications WHERE user_id=u AND status='approved')
 AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role='advisor')
 AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role='admin');
$$;
REVOKE ALL ON FUNCTION private.is_message_advisor(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.is_message_advisor(uuid) TO authenticated,service_role;
DROP POLICY "participants or advisors read conversations" ON public.conversations;
CREATE POLICY "participants or advisors read conversations" ON public.conversations FOR SELECT TO authenticated USING (
 (teen_id=(SELECT auth.uid()) AND (SELECT private.current_account_role())='member') OR
 (advisor_id=(SELECT auth.uid()) AND (SELECT private.current_account_role())='advisor') OR
 (advisor_id IS NULL AND status='open' AND (SELECT private.current_account_role())='advisor')
);
DROP POLICY "teens create support requests" ON public.conversations;
CREATE POLICY "teens create support requests" ON public.conversations FOR INSERT TO authenticated WITH CHECK(
 teen_id=(SELECT auth.uid()) AND (SELECT private.current_account_role())='member' AND (advisor_id IS NULL OR private.is_message_advisor(advisor_id))
);
-- Existing message policies also require a visible participant conversation, so
-- the role restriction above protects direct reads and writes through the Data API.

CREATE FUNCTION private.guard_essay_finalization() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.competitions%ROWTYPE;
BEGIN
 IF NEW.status='submitted' AND (NEW.revision_number IS DISTINCT FROM OLD.revision_number OR NEW.file_path IS DISTINCT FROM OLD.file_path) THEN
  SELECT * INTO c FROM public.competitions WHERE id=NEW.competition_id FOR SHARE;
  IF c.status<>'open' OR NOT c.is_public OR c.category<>'essay' OR (c.opens_at IS NOT NULL AND c.opens_at>now()) OR (c.closes_at IS NOT NULL AND c.closes_at<=now()) THEN RAISE EXCEPTION 'Competition submissions are closed'; END IF;
  IF NEW.participant_age>c.maximum_age OR (c.minimum_age IS NOT NULL AND NEW.participant_age<c.minimum_age) OR (c.maximum_words IS NOT NULL AND NEW.declared_word_count>c.maximum_words) OR (c.minimum_words IS NOT NULL AND NEW.declared_word_count<c.minimum_words) THEN RAISE EXCEPTION 'Entry does not meet competition rules'; END IF;
  IF OLD.status NOT IN ('draft','submitted','withdrawn') THEN RAISE EXCEPTION 'This entry is under review'; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_essay_finalization() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.guard_essay_finalization() TO service_role;
CREATE TRIGGER guard_essay_finalization BEFORE UPDATE ON public.essay_submissions FOR EACH ROW EXECUTE FUNCTION private.guard_essay_finalization();

-- Create the conversation and its first message in one transaction.
CREATE FUNCTION public.create_support_request(p_user_id uuid,p_subject text,p_topic text,p_body text,p_advisor_id uuid,p_allow_ai boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE thread uuid;
BEGIN
 INSERT INTO public.conversations(teen_id,advisor_id,subject,topic,status,ai_fallback_enabled,ai_handoff_required)
 VALUES(p_user_id,p_advisor_id,p_subject,p_topic,'open',p_advisor_id IS NULL AND p_allow_ai,p_advisor_id IS NULL AND p_allow_ai) RETURNING id INTO thread;
 INSERT INTO public.messages(conversation_id,sender_id,sender_kind,body) VALUES(thread,p_user_id,'human',p_body);
 RETURN thread;
END; $$;
REVOKE ALL ON FUNCTION public.create_support_request(uuid,text,text,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_request(uuid,text,text,text,uuid,boolean) TO service_role;
