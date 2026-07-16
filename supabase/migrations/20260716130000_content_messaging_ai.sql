-- Content, messaging, advisor availability, and AI usage infrastructure.

CREATE TABLE IF NOT EXISTS public.resource_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.resource_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES public.resource_categories(id) ON DELETE SET NULL,
  duration_text TEXT,
  thumbnail_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  comments_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  link TEXT NOT NULL UNIQUE,
  pub_date TIMESTAMPTZ,
  excerpt TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  author TEXT NOT NULL DEFAULT 'BraverTogether',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_active_conversations INTEGER NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_availability_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_availability_status_check
      CHECK (availability_status IN ('available', 'busy', 'offline'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_max_active_conversations_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_max_active_conversations_check
      CHECK (max_active_conversations BETWEEN 1 AND 50);
  END IF;
END $$;

ALTER TABLE public.conversations
  ALTER COLUMN advisor_id DROP NOT NULL;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'Digital law question',
  ADD COLUMN IF NOT EXISTS topic TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS ai_fallback_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_handoff_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_kind TEXT NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_kind_check'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_sender_kind_check
      CHECK (sender_kind IN ('human', 'ai', 'system'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_identity_check'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_sender_identity_check
      CHECK (
        (sender_kind = 'human' AND sender_id IS NOT NULL)
        OR (sender_kind IN ('ai', 'system') AND sender_id IS NULL)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.conversation_reads (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  feature TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (feature, actor_key, usage_date)
);

CREATE INDEX IF NOT EXISTS resource_videos_public_idx
  ON public.resource_videos(is_published, sort_order, created_at);
CREATE INDEX IF NOT EXISTS news_posts_pub_date_idx
  ON public.news_posts(pub_date DESC);
CREATE INDEX IF NOT EXISTS profiles_advisor_availability_idx
  ON public.profiles(is_advisor, is_public, accepting_messages, availability_status);
CREATE INDEX IF NOT EXISTS conversations_queue_idx
  ON public.conversations(status, advisor_id, created_at);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages(conversation_id, created_at);

INSERT INTO public.resource_categories (id, label, description, sort_order)
VALUES
  ('privacy', 'Privacy & Data', 'Personal data, tracking, permissions, and privacy rights.', 10),
  ('social', 'Social Media Law', 'Platform rules, moderation, expression, and school policies.', 20),
  ('contracts', 'Digital Contracts', 'Terms, privacy policies, subscriptions, and online consent.', 30),
  ('safety', 'Online Safety', 'Scams, cyberbullying, account security, and reporting.', 40),
  ('ai', 'AI & Emerging Tech', 'AI systems, deepfakes, algorithms, and emerging regulation.', 50),
  ('rights', 'Digital Rights', 'Access, expression, privacy, and responsible digital citizenship.', 60)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.touch_content_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resource_videos_touch ON public.resource_videos;
CREATE TRIGGER resource_videos_touch
  BEFORE UPDATE ON public.resource_videos
  FOR EACH ROW EXECUTE FUNCTION public.touch_content_updated_at();

DROP TRIGGER IF EXISTS conversations_touch ON public.conversations;
CREATE TRIGGER conversations_touch
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_content_updated_at();

GRANT SELECT ON public.resource_categories, public.resource_videos, public.news_posts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversation_reads TO authenticated;
GRANT ALL ON public.resource_categories, public.resource_videos, public.news_posts, public.conversation_reads, public.ai_usage_daily TO service_role;

ALTER TABLE public.resource_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read resource categories" ON public.resource_categories;
CREATE POLICY "public read resource categories"
  ON public.resource_categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "public read published videos" ON public.resource_videos;
CREATE POLICY "public read published videos"
  ON public.resource_videos FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "public read cached news" ON public.news_posts;
CREATE POLICY "public read cached news"
  ON public.news_posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "users read own conversation read state" ON public.conversation_reads;
CREATE POLICY "users read own conversation read state"
  ON public.conversation_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users create own conversation read state" ON public.conversation_reads;
CREATE POLICY "users create own conversation read state"
  ON public.conversation_reads FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.teen_id = auth.uid() OR c.advisor_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "users update own conversation read state" ON public.conversation_reads;
CREATE POLICY "users update own conversation read state"
  ON public.conversation_reads FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "participants read conversation" ON public.conversations;
DROP POLICY IF EXISTS "teen starts conversation" ON public.conversations;
DROP POLICY IF EXISTS "participants update conversation" ON public.conversations;
DROP POLICY IF EXISTS "participants or advisors read conversations" ON public.conversations;
DROP POLICY IF EXISTS "teens create support requests" ON public.conversations;

CREATE POLICY "participants or advisors read conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    auth.uid() = teen_id
    OR auth.uid() = advisor_id
    OR (
      advisor_id IS NULL
      AND status = 'open'
      AND public.has_role(auth.uid(), 'advisor')
    )
  );

CREATE POLICY "teens create support requests"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = teen_id
    AND (
      advisor_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = advisor_id
          AND p.is_advisor = true
          AND p.is_public = true
          AND p.accepting_messages = true
      )
    )
  );

REVOKE UPDATE ON public.conversations FROM authenticated;

DROP POLICY IF EXISTS "participants read messages" ON public.messages;
DROP POLICY IF EXISTS "participants send messages" ON public.messages;

CREATE POLICY "participants read messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.teen_id = auth.uid() OR c.advisor_id = auth.uid())
    )
  );

CREATE POLICY "participants send human messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_kind = 'human'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.status = 'open'
        AND (c.teen_id = auth.uid() OR c.advisor_id = auth.uid())
    )
  );

REVOKE EXECUTE ON FUNCTION public.touch_content_updated_at() FROM PUBLIC, anon, authenticated;
