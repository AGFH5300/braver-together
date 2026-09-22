-- Correct support AI handoff state.
-- A request opting into AI should not be marked as having received AI help
-- until askSupportAi actually inserts an AI message.

CREATE OR REPLACE FUNCTION public.create_support_request(
  p_user_id uuid,
  p_subject text,
  p_topic text,
  p_body text,
  p_advisor_id uuid,
  p_allow_ai boolean
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  thread uuid;
BEGIN
  INSERT INTO public.conversations(
    teen_id,
    advisor_id,
    subject,
    topic,
    status,
    ai_fallback_enabled,
    ai_handoff_required
  )
  VALUES(
    p_user_id,
    p_advisor_id,
    p_subject,
    p_topic,
    'open',
    p_advisor_id IS NULL AND p_allow_ai,
    false
  )
  RETURNING id INTO thread;

  INSERT INTO public.messages(
    conversation_id,
    sender_id,
    sender_kind,
    body
  )
  VALUES(
    thread,
    p_user_id,
    'human',
    p_body
  );

  RETURN thread;
END;
$function$;
