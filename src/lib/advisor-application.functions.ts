import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

const ApplicationInput = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  organization: optionalText(160),
  roleTitle: optionalText(120),
  location: optionalText(120),
  experience: z.string().trim().min(40).max(3000),
  motivation: z.string().trim().min(40).max(3000),
  focusAreas: z.array(z.string().trim().min(2).max(80)).min(1).max(12),
  profileUrl: z.string().trim().max(500).optional().default(""),
  availabilityNote: optionalText(500),
});

const ReviewInput = z.object({
  applicationId: z.string().uuid(),
  decision: z.enum(["approved", "denied", "more_info"]),
  note: z.string().trim().max(2000).optional().default(""),
});

function normalizeHttpsUrl(value: string): string | null {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Profile links must use HTTPS.");
  return url.toString();
}

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Administrator access is required.");
  return supabaseAdmin;
}

export const getAdvisorPortalState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: application }, { data: adminRole }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("advisor_applications")
        .select("id, full_name, email, organization, role_title, location, experience, motivation, focus_areas, profile_url, availability_note, status, admin_note, submitted_at, updated_at, reviewed_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("is_advisor").eq("id", context.userId).maybeSingle(),
    ]);

    return {
      application,
      isAdmin: Boolean(adminRole),
      isAdvisor: Boolean(profile?.is_advisor),
    };
  });

export const submitAdvisorApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ApplicationInput.parse(value))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("advisor_applications")
      .select("id, status")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing?.status === "approved") {
      throw new Error("Your advisor application has already been approved.");
    }

    const profileUrl = normalizeHttpsUrl(data.profileUrl);
    const payload = {
      user_id: context.userId,
      full_name: data.fullName,
      email: data.email.toLowerCase(),
      organization: data.organization || null,
      role_title: data.roleTitle || null,
      location: data.location || null,
      experience: data.experience,
      motivation: data.motivation,
      focus_areas: Array.from(new Set(data.focusAreas)),
      profile_url: profileUrl,
      availability_note: data.availabilityNote || null,
      status: "pending" as const,
      admin_note: null,
      reviewed_by: null,
      reviewed_at: null,
      submitted_at: existing ? undefined : new Date().toISOString(),
    };

    const { data: application, error } = await supabaseAdmin
      .from("advisor_applications")
      .upsert(payload, { onConflict: "user_id" })
      .select("id, status, submitted_at")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("advisor_application_events").insert({
      application_id: application.id,
      actor_id: context.userId,
      action: existing ? "resubmitted" : "submitted",
      note: null,
    });

    return application;
  });

export const listAdvisorApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("advisor_applications")
      .select("id, user_id, full_name, email, organization, role_title, location, experience, motivation, focus_areas, profile_url, availability_note, status, admin_note, submitted_at, updated_at, reviewed_at")
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const reviewAdvisorApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ReviewInput.parse(value))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data: application } = await supabaseAdmin
      .from("advisor_applications")
      .select("id, user_id, status")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (!application) throw new Error("Application not found.");
    if (application.status === "approved" && data.decision !== "approved") {
      throw new Error("Approved advisor accounts must be managed separately.");
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("advisor_applications")
      .update({
        status: data.decision,
        admin_note: data.note || null,
        reviewed_by: context.userId,
        reviewed_at: now,
      })
      .eq("id", application.id);
    if (error) throw new Error(error.message);

    if (data.decision === "approved") {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          is_advisor: true,
          is_public: false,
          accepting_messages: true,
          availability_status: "offline",
        })
        .eq("id", application.user_id);
      if (profileError) throw new Error(profileError.message);

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: application.user_id, role: "advisor" }, { onConflict: "user_id,role" });
      if (roleError) throw new Error(roleError.message);
    }

    await supabaseAdmin.from("advisor_application_events").insert({
      application_id: application.id,
      actor_id: context.userId,
      action: data.decision,
      note: data.note || null,
    });

    return { ok: true as const, status: data.decision };
  });
