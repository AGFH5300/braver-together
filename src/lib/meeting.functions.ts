import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ConversationInput = z.object({ conversationId: z.string().uuid() });

const MeetingInput = z.object({
  conversationId: z.string().uuid(),
  proposedStart: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(120),
  timezone: z.string().trim().min(1).max(100),
  title: z.string().trim().min(3).max(120),
  note: z.string().trim().max(1000).optional().default(""),
  meetingUrl: z.string().trim().url().max(500),
});

const ResponseInput = z.object({
  proposalId: z.string().uuid(),
  action: z.enum(["accepted", "declined", "cancelled"]),
});

function validateMeetingUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Meeting links must use HTTPS.");
  return url.toString();
}

async function getConversationForParticipant(conversationId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("conversations")
    .select("id, teen_id, advisor_id, status, subject")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data || (data.teen_id !== userId && data.advisor_id !== userId)) {
    throw new Error("You do not have access to that conversation.");
  }
  return { supabaseAdmin, conversation: data };
}

export const listMeetingProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ConversationInput.parse(value))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await getConversationForParticipant(data.conversationId, context.userId);
    const { data: proposals, error } = await supabaseAdmin
      .from("meeting_proposals")
      .select("id, conversation_id, proposer_id, proposed_start, duration_minutes, timezone, title, note, meeting_url, status, responded_by, responded_at, created_at, updated_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return proposals ?? [];
  });

export const createMeetingProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => MeetingInput.parse(value))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, conversation } = await getConversationForParticipant(data.conversationId, context.userId);
    if (conversation.status !== "open") throw new Error("Meetings cannot be proposed in a closed conversation.");
    if (!conversation.advisor_id) throw new Error("A human advisor must join before a meeting can be proposed.");

    const start = new Date(data.proposedStart);
    const minimum = Date.now() + 5 * 60_000;
    const maximum = Date.now() + 180 * 24 * 60 * 60_000;
    if (start.getTime() < minimum) throw new Error("Choose a time at least five minutes from now.");
    if (start.getTime() > maximum) throw new Error("Meetings can be proposed up to six months ahead.");

    const meetingUrl = validateMeetingUrl(data.meetingUrl);
    const { data: proposal, error } = await supabaseAdmin
      .from("meeting_proposals")
      .insert({
        conversation_id: conversation.id,
        proposer_id: context.userId,
        proposed_start: start.toISOString(),
        duration_minutes: data.durationMinutes,
        timezone: data.timezone,
        title: data.title,
        note: data.note || null,
        meeting_url: meetingUrl,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: null,
      sender_kind: "system",
      body: `A meeting was proposed for ${start.toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: data.timezone })}. Open Meetings to review it.`,
      metadata: { meeting_proposal_id: proposal.id },
    });

    return { id: proposal.id };
  });

export const respondMeetingProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ResponseInput.parse(value))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: proposal } = await supabaseAdmin
      .from("meeting_proposals")
      .select("id, conversation_id, proposer_id, status, proposed_start")
      .eq("id", data.proposalId)
      .maybeSingle();
    if (!proposal) throw new Error("Meeting proposal not found.");

    const { conversation } = await getConversationForParticipant(proposal.conversation_id, context.userId);
    if (proposal.status !== "pending") throw new Error("This meeting proposal has already been answered.");
    if (data.action === "cancelled" && proposal.proposer_id !== context.userId) {
      throw new Error("Only the person who proposed the meeting can cancel it.");
    }
    if (data.action !== "cancelled" && proposal.proposer_id === context.userId) {
      throw new Error("The other participant must accept or decline this proposal.");
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("meeting_proposals")
      .update({
        status: data.action,
        responded_by: context.userId,
        responded_at: now,
      })
      .eq("id", proposal.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);

    const verb = data.action === "accepted" ? "accepted" : data.action === "declined" ? "declined" : "cancelled";
    await supabaseAdmin.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: null,
      sender_kind: "system",
      body: `The meeting proposal was ${verb}.`,
      metadata: { meeting_proposal_id: proposal.id, meeting_status: data.action },
    });

    return { ok: true as const, status: data.action };
  });
