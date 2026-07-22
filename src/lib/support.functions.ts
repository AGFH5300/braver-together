import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  loadAccountAccessState,
  requireAccountRole,
} from "@/lib/account-access.functions";
import { consumeAiAllowance } from "./ai-rate-limit.server";
import { createAiProvider } from "./ai-provider.server";

const topics = ["privacy", "social-media", "contracts", "safety", "ai", "copyright", "general"] as const;

const CreateRequestInput = z.object({
  subject: z.string().trim().min(5).max(120),
  topic: z.enum(topics),
  message: z.string().trim().min(10).max(4000),
  advisorId: z.string().uuid().nullable().optional(),
  allowAiFallback: z.boolean().default(true),
});

const publicAdvisorFields =
  "id, display_name, headline, bio, focus_areas, calendly_url, accepting_messages, availability_status, last_seen_at";

async function approvedAdvisorIds(candidateIds: string[]): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [rolesResult, applicationsResult] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "advisor")
      .in("user_id", candidateIds),
    supabaseAdmin
      .from("advisor_applications")
      .select("user_id")
      .eq("status", "approved")
      .in("user_id", candidateIds),
  ]);
  if (rolesResult.error) throw new Error(rolesResult.error.message);
  if (applicationsResult.error) throw new Error(applicationsResult.error.message);
  const roleIds = new Set((rolesResult.data ?? []).map((row) => row.user_id));
  return new Set(
    (applicationsResult.data ?? [])
      .map((row) => row.user_id)
      .filter((userId) => roleIds.has(userId)),
  );
}

export const listPublicAdvisors = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(publicAdvisorFields)
      .eq("is_advisor", true)
      .eq("is_public", true)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const approvedIds = await approvedAdvisorIds(
      (data ?? []).map((profile) => profile.id),
    );
    return (data ?? []).filter((profile) => approvedIds.has(profile.id));
  },
);

export const createSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => CreateRequestInput.parse(value))
  .handler(async ({ data, context }) => {
    await requireAccountRole(context.userId, ["member"]);
    if (data.advisorId) {
      const advisorAccess = await loadAccountAccessState(data.advisorId);
      if (advisorAccess.role !== "advisor") {
        throw new Error("That advisor is not currently approved.");
      }
      const { data: advisor } = await context.supabase
        .from("profiles")
        .select("id")
        .eq("id", data.advisorId)
        .eq("is_advisor", true)
        .eq("is_public", true)
        .eq("accepting_messages", true)
        .maybeSingle();
      if (!advisor) throw new Error("That advisor is not currently accepting new conversations.");
    }

    const { data: conversation, error } = await context.supabase
      .from("conversations")
      .insert({
        teen_id: context.userId,
        advisor_id: data.advisorId ?? null,
        subject: data.subject,
        topic: data.topic,
        status: "open",
        ai_fallback_enabled: !data.advisorId && data.allowAiFallback,
        ai_handoff_required: !data.advisorId && data.allowAiFallback,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    const { error: messageError } = await context.supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: context.userId,
      sender_kind: "human",
      body: data.message,
    });

    if (messageError) throw new Error(messageError.message);
    return { id: conversation.id };
  });

const ConversationInput = z.object({ conversationId: z.string().uuid() });

export const claimConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ConversationInput.parse(value))
  .handler(async ({ data, context }) => {
    await requireAccountRole(context.userId, ["advisor"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: claimed, error } = await supabaseAdmin
      .from("conversations")
      .update({ advisor_id: context.userId, claimed_at: new Date().toISOString(), ai_handoff_required: false })
      .eq("id", data.conversationId)
      .is("advisor_id", null)
      .eq("status", "open")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claimed) throw new Error("This request has already been claimed or closed.");

    await supabaseAdmin.from("messages").insert({
      conversation_id: data.conversationId,
      sender_id: null,
      sender_kind: "system",
      body: "A human advisor has joined this conversation.",
    });
    return { ok: true as const };
  });

const AvailabilityInput = z.object({ status: z.enum(["available", "busy", "offline"]) });

export const setAdvisorAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => AvailabilityInput.parse(value))
  .handler(async ({ data, context }) => {
    await requireAccountRole(context.userId, ["advisor"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({
      availability_status: data.status,
      last_seen_at: new Date().toISOString(),
    }).eq("id", context.userId).eq("is_advisor", true);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const closeConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ConversationInput.parse(value))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conversation } = await supabaseAdmin.from("conversations")
      .select("teen_id, advisor_id").eq("id", data.conversationId).maybeSingle();
    if (!conversation || (conversation.teen_id !== context.userId && conversation.advisor_id !== context.userId)) {
      throw new Error("You do not have access to that conversation.");
    }
    const { error } = await supabaseAdmin.from("conversations").update({
      status: "closed", closed_at: new Date().toISOString(),
    }).eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const AiInput = z.object({
  conversationId: z.string().uuid(),
  message: z.string().trim().min(3).max(2000),
});

export const askSupportAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => AiInput.parse(value))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conversation } = await supabaseAdmin.from("conversations")
      .select("id, teen_id, advisor_id, status, ai_fallback_enabled, subject, topic")
      .eq("id", data.conversationId).maybeSingle();

    if (!conversation || conversation.teen_id !== context.userId) throw new Error("You do not have access to this request.");
    if (conversation.status !== "open") throw new Error("This conversation is closed.");
    if (conversation.advisor_id) throw new Error("A human advisor is now handling this conversation.");
    if (!conversation.ai_fallback_enabled) throw new Error("AI fallback is not enabled for this request.");

    const { data: availableProfiles, error: availableError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("is_advisor", true)
      .eq("is_public", true)
      .eq("accepting_messages", true)
      .eq("availability_status", "available");
    if (availableError) throw new Error(availableError.message);
    const availableApprovedIds = await approvedAdvisorIds(
      (availableProfiles ?? []).map((profile) => profile.id),
    );
    if (availableApprovedIds.size > 0) throw new Error("A human advisor is available. Your request is waiting in the advisor queue.");

    const apiKey = process.env.SUPPORT_AI_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const modelName = process.env.SUPPORT_AI_MODEL || process.env.AI_MODEL;
    if (!apiKey || !modelName) {
      return { configured: false as const, message: "The AI helper is temporarily unavailable. Your request remains in the advisor queue." };
    }

    const allowance = await consumeAiAllowance({ feature: "support", userId: context.userId, dailyLimit: 20 });
    const provider = createAiProvider({
      apiKey,
      baseUrl: process.env.SUPPORT_AI_BASE_URL || process.env.AI_BASE_URL,
    });

    const { data: history } = await supabaseAdmin.from("messages").select("sender_kind, body")
      .eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(12);

    const transcript = (history ?? []).map((entry) => `${entry.sender_kind === "human" ? "User" : "Assistant"}: ${entry.body}`).join("\n");
    const result = await generateText({
      model: provider(modelName),
      maxOutputTokens: 350,
      temperature: 0.2,
      system: `You are BraverTogether's LIMITED educational support helper for teenagers. You are not a lawyer and must not replace a human advisor.

You may: explain basic digital-law terms, suggest relevant BraverTogether topics, help the user phrase a question, remind them not to share private information, and give general online-safety guidance.

You must not: give jurisdiction-specific legal advice, tell the user what legal action to take, draft legal threats or notices, claim confidentiality, decide who is legally right, or handle emergencies. When the question needs judgment, facts, jurisdiction-specific analysis, safeguarding, or legal action, say a human advisor needs to review it. Keep answers brief, useful, and deliberately limited. End with one practical next step for preparing the human handoff.`,
      prompt: `Request subject: ${conversation.subject}\nTopic: ${conversation.topic}\nRecent conversation:\n${transcript}\n\nLatest question: ${data.message}`,
    });

    const answer = result.text.trim();
    if (!answer) throw new Error("The AI helper returned an empty response.");

    const { error: insertError } = await supabaseAdmin.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: null,
      sender_kind: "ai",
      body: answer,
      metadata: { disclaimer: "Educational AI helper — not a lawyer or human advisor." },
    });
    if (insertError) throw new Error(insertError.message);

    await supabaseAdmin.from("conversations").update({ ai_handoff_required: true }).eq("id", conversation.id);
    return { configured: true as const, message: answer, remaining: allowance.remaining };
  });
