import { createHash, randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  loadAccountAccessState,
  requireAccountRole,
} from "@/lib/account-access.functions";

export const ADVISOR_CV_BUCKET = "advisor-cvs";
export const MAX_ADVISOR_CV_BYTES = 5 * 1024 * 1024;

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const allowedCvTypes = new Map([
  [PDF_MIME, "pdf"],
  [DOCX_MIME, "docx"],
]);

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

const ApplicationFields = z.object({
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

const ApplicationInput = ApplicationFields;
const PrepareCvInput = ApplicationFields.extend({
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.enum([PDF_MIME, DOCX_MIME]),
  fileSize: z.number().int().positive().max(MAX_ADVISOR_CV_BYTES),
  fileSha256: z.string().regex(/^[a-f0-9]{64}$/i),
});
const FinalizeCvInput = z.object({
  applicationId: z.string().uuid(),
  filePath: z.string().trim().min(10).max(500),
});
const ApplicationIdInput = z.object({ applicationId: z.string().uuid() });
const ReviewInput = z.object({
  applicationId: z.string().uuid(),
  decision: z.enum(["approved", "denied", "more_info"]),
  note: z.string().trim().max(2000).optional().default(""),
});

function normalizeHttpsUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Enter a valid website address.");
  }

  if (url.protocol !== "https:") throw new Error("Profile links must use HTTPS.");
  if (!url.hostname || !url.hostname.includes(".")) throw new Error("Enter a valid website address.");
  return url.toString();
}

function fileExtension(filename: string): string {
  return filename.toLowerCase().split(".").pop() ?? "";
}

function validateCvMetadata(filename: string, mimeType: string, size: number) {
  const extension = allowedCvTypes.get(mimeType);
  if (!extension || fileExtension(filename) !== extension) {
    throw new Error("Upload a genuine PDF or DOCX CV whose extension matches its file type.");
  }
  if (size <= 0 || size > MAX_ADVISOR_CV_BYTES) {
    throw new Error("The CV must be larger than 0 bytes and no more than 5 MB.");
  }
}

function validateMagicBytes(bytes: Uint8Array, mimeType: string) {
  if (mimeType === PDF_MIME) {
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    if (header !== "%PDF-") throw new Error("The uploaded CV does not contain a valid PDF header.");
    return;
  }

  const zipHeader = Array.from(bytes.slice(0, 4)).join(",");
  const validZipHeaders = new Set(["80,75,3,4", "80,75,5,6", "80,75,7,8"]);
  if (!validZipHeaders.has(zipHeader)) {
    throw new Error("The uploaded CV does not contain a valid DOCX/ZIP header.");
  }
}

async function requireAdmin(userId: string) {
  await requireAccountRole(userId, ["administrator"]);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function ensureAdvisorIntent(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: application }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("advisor_applications").select("status").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("profiles").select("is_advisor").eq("id", userId).maybeSingle(),
  ]);
  const completed = Boolean(profile?.is_advisor || application?.status === "approved");
  const payload = {
    user_id: userId,
    completed_at: completed ? new Date().toISOString() : null,
  };
  const { error } = await supabaseAdmin
    .from("advisor_onboarding_intents")
    .upsert(payload, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  return { supabaseAdmin, completed };
}

export const beginAdvisorOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAccountRole(context.userId, ["member"]);
    const { completed } = await ensureAdvisorIntent(context.userId);
    return { required: !completed };
  });

export const getAdvisorOnboardingGate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await loadAccountAccessState(context.userId);
    return {
      ...access,
      required: access.role === "member" && access.isApplicant,
      isAdvisor: access.role === "advisor",
      isAdmin: access.role === "administrator",
    };
  });

export const getAdvisorPortalState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await loadAccountAccessState(context.userId);
    const { supabaseAdmin } =
      access.role === "member"
        ? await ensureAdvisorIntent(context.userId)
        : await import("@/integrations/supabase/client.server");
    const { data: application } = await supabaseAdmin
      .from("advisor_applications")
      .select("id, full_name, email, organization, role_title, location, experience, motivation, focus_areas, profile_url, availability_note, status, admin_note, submitted_at, updated_at, reviewed_at, cv_original_filename, cv_mime_type, cv_file_size")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      application,
      role: access.role,
      hasRoleConflict: access.hasRoleConflict,
      isAdmin: access.role === "administrator",
      isAdvisor: access.role === "advisor",
      applicationRequired:
        access.role === "member" && application?.status !== "approved",
    };
  });

export const submitAdvisorApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ApplicationInput.parse(value))
  .handler(async ({ data, context }) => {
    await requireAccountRole(context.userId, ["member"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("advisor_applications")
      .select("id, status, cv_file_path")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing?.status === "approved") {
      throw new Error("Your advisor application has already been approved.");
    }
    if (!existing?.cv_file_path) {
      throw new Error("Attach and verify your CV before submitting the application.");
    }

    const now = new Date().toISOString();
    const profileUrl = normalizeHttpsUrl(data.profileUrl);
    const { data: application, error } = await supabaseAdmin
      .from("advisor_applications")
      .update({
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
        status: "pending",
        admin_note: null,
        reviewed_by: null,
        reviewed_at: null,
        submitted_at: now,
      })
      .eq("id", existing.id)
      .eq("user_id", context.userId)
      .select("id, submitted_at")
      .single();
    if (error) throw new Error(error.message);

    await Promise.all([
      supabaseAdmin.from("advisor_application_events").insert({
        application_id: application.id,
        actor_id: context.userId,
        action: "resubmitted",
        note: null,
      }),
      supabaseAdmin
        .from("advisor_onboarding_intents")
        .upsert({ user_id: context.userId, completed_at: null }, { onConflict: "user_id" }),
    ]);

    return { id: application.id, status: "pending" as const, submitted_at: application.submitted_at };
  });

export const prepareAdvisorCvUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => PrepareCvInput.parse(value))
  .handler(async ({ data, context }) => {
    await requireAccountRole(context.userId, ["member"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    validateCvMetadata(data.originalFilename, data.mimeType, data.fileSize);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("advisor_applications")
      .select("id, status, cv_file_path, pending_cv_file_path")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing?.status === "approved") throw new Error("Your advisor application has already been approved.");

    const applicationId = existing?.id ?? randomUUID();
    const extension = allowedCvTypes.get(data.mimeType)!;
    const filePath = `${context.userId}/${applicationId}/${randomUUID()}.${extension}`;
    const previousStatus = existing && existing.status !== "draft" ? existing.status : null;
    const profileUrl = normalizeHttpsUrl(data.profileUrl);

    const { error: saveError } = await supabaseAdmin
      .from("advisor_applications")
      .upsert({
        id: applicationId,
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
        status: "draft",
        admin_note: null,
        reviewed_by: null,
        reviewed_at: null,
        pending_cv_file_path: filePath,
        pending_cv_original_filename: data.originalFilename,
        pending_cv_mime_type: data.mimeType,
        pending_cv_file_size: data.fileSize,
        pending_cv_file_sha256: data.fileSha256.toLowerCase(),
        pending_previous_status: previousStatus,
      }, { onConflict: "user_id" });
    if (saveError) throw new Error(saveError.message);

    if (existing?.pending_cv_file_path && existing.pending_cv_file_path !== filePath) {
      await supabaseAdmin.storage.from(ADVISOR_CV_BUCKET).remove([existing.pending_cv_file_path]);
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(ADVISOR_CV_BUCKET)
      .createSignedUploadUrl(filePath);
    if (signedError || !signed?.token) {
      await supabaseAdmin
        .from("advisor_applications")
        .update({
          status: previousStatus ?? "draft",
          pending_cv_file_path: null,
          pending_cv_original_filename: null,
          pending_cv_mime_type: null,
          pending_cv_file_size: null,
          pending_cv_file_sha256: null,
          pending_previous_status: null,
        })
        .eq("id", applicationId);
      throw new Error(signedError?.message || "The CV upload could not be started.");
    }

    return { applicationId, filePath, uploadToken: signed.token };
  });

export const finalizeAdvisorCvUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => FinalizeCvInput.parse(value))
  .handler(async ({ data, context }) => {
    await requireAccountRole(context.userId, ["member"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: application, error: readError } = await supabaseAdmin
      .from("advisor_applications")
      .select("id, user_id, cv_file_path, pending_cv_file_path, pending_cv_original_filename, pending_cv_mime_type, pending_cv_file_size, pending_cv_file_sha256, pending_previous_status")
      .eq("id", data.applicationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!application) throw new Error("Advisor application not found.");
    if (!application.pending_cv_file_path || application.pending_cv_file_path !== data.filePath) {
      throw new Error("This upload is no longer active. Select the file again.");
    }
    if (!application.pending_cv_original_filename || !application.pending_cv_mime_type || !application.pending_cv_file_size || !application.pending_cv_file_sha256) {
      throw new Error("The pending CV metadata is incomplete.");
    }

    try {
      const { data: blob, error: downloadError } = await supabaseAdmin.storage
        .from(ADVISOR_CV_BUCKET)
        .download(data.filePath);
      if (downloadError || !blob) throw new Error(downloadError?.message || "The uploaded CV could not be verified.");
      if (blob.size !== Number(application.pending_cv_file_size)) {
        throw new Error("The uploaded CV size does not match the selected file.");
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      validateMagicBytes(bytes, application.pending_cv_mime_type);
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (digest !== application.pending_cv_file_sha256) {
        throw new Error("The uploaded CV did not pass its integrity check.");
      }

      const now = new Date().toISOString();
      const { error: finalizeError } = await supabaseAdmin
        .from("advisor_applications")
        .update({
          status: "pending",
          cv_file_path: application.pending_cv_file_path,
          cv_original_filename: application.pending_cv_original_filename,
          cv_mime_type: application.pending_cv_mime_type,
          cv_file_size: application.pending_cv_file_size,
          cv_file_sha256: application.pending_cv_file_sha256,
          pending_cv_file_path: null,
          pending_cv_original_filename: null,
          pending_cv_mime_type: null,
          pending_cv_file_size: null,
          pending_cv_file_sha256: null,
          pending_previous_status: null,
          submitted_at: now,
          reviewed_at: null,
          reviewed_by: null,
          admin_note: null,
        })
        .eq("id", application.id)
        .eq("pending_cv_file_path", data.filePath);
      if (finalizeError) throw new Error(finalizeError.message);

      if (application.cv_file_path && application.cv_file_path !== data.filePath) {
        await supabaseAdmin.storage.from(ADVISOR_CV_BUCKET).remove([application.cv_file_path]);
      }

      await Promise.all([
        supabaseAdmin.from("advisor_application_events").insert({
          application_id: application.id,
          actor_id: context.userId,
          action: application.cv_file_path ? "resubmitted" : "submitted",
          note: `CV: ${application.pending_cv_original_filename}`,
        }),
        supabaseAdmin
          .from("advisor_onboarding_intents")
          .upsert({ user_id: context.userId, completed_at: null }, { onConflict: "user_id" }),
      ]);

      return {
        ok: true as const,
        status: "pending" as const,
        submittedAt: now,
        filename: application.pending_cv_original_filename,
      };
    } catch (error) {
      await supabaseAdmin.storage.from(ADVISOR_CV_BUCKET).remove([data.filePath]);
      await supabaseAdmin
        .from("advisor_applications")
        .update({
          status: application.pending_previous_status ?? "draft",
          pending_cv_file_path: null,
          pending_cv_original_filename: null,
          pending_cv_mime_type: null,
          pending_cv_file_size: null,
          pending_cv_file_sha256: null,
          pending_previous_status: null,
        })
        .eq("id", application.id)
        .eq("pending_cv_file_path", data.filePath);
      throw error;
    }
  });

export const getAdvisorCvDownload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ApplicationIdInput.parse(value))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: application }, { data: adminRole }] = await Promise.all([
      supabaseAdmin
        .from("advisor_applications")
        .select("user_id, cv_file_path, cv_original_filename")
        .eq("id", data.applicationId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);
    if (!application || (!adminRole && application.user_id !== context.userId)) {
      throw new Error("CV not found.");
    }
    if (!application.cv_file_path || !application.cv_original_filename) {
      throw new Error("No verified CV is attached to this application.");
    }

    const { data: signed, error } = await supabaseAdmin.storage
      .from(ADVISOR_CV_BUCKET)
      .createSignedUrl(application.cv_file_path, 300, { download: application.cv_original_filename });
    if (error || !signed?.signedUrl) throw new Error(error?.message || "The CV download link could not be created.");
    return { url: signed.signedUrl, filename: application.cv_original_filename };
  });

export const listAdvisorApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("advisor_applications")
      .select("id, user_id, full_name, email, organization, role_title, location, experience, motivation, focus_areas, profile_url, availability_note, status, admin_note, submitted_at, updated_at, reviewed_at, cv_original_filename, cv_mime_type, cv_file_size")
      .neq("status", "draft")
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
      .select("id, user_id, status, cv_file_path")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (!application) throw new Error("Application not found.");
    if (application.status === "approved" && data.decision !== "approved") {
      throw new Error("Approved advisor accounts must be managed separately.");
    }
    if (data.decision === "approved" && !application.cv_file_path) {
      throw new Error("A verified CV is required before this application can be approved.");
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

    const { error: onboardingError } = await supabaseAdmin
      .from("advisor_onboarding_intents")
      .upsert({
        user_id: application.user_id,
        completed_at: data.decision === "approved" ? now : null,
      }, { onConflict: "user_id" });
    if (onboardingError) throw new Error(onboardingError.message);

    await supabaseAdmin.from("advisor_application_events").insert({
      application_id: application.id,
      actor_id: context.userId,
      action: data.decision,
      note: data.note || null,
    });

    return { ok: true as const, status: data.decision };
  });
