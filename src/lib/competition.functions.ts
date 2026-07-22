import { createHash, randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAccountAccessState } from "@/lib/account-access.functions";

export const CURRENT_COMPETITION_SLUG = "inaugural-digital-rights-essay";
export const ESSAY_BUCKET = "essay-submissions";
export const MAX_ESSAY_FILE_BYTES = 10 * 1024 * 1024;

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const allowedFileTypes = new Map([
  [PDF_MIME, "pdf"],
  [DOCX_MIME, "docx"],
]);

const SubmissionMetadataInput = z.object({
  competitionId: z.string().uuid(),
  participantName: z.string().trim().min(2).max(100),
  participantAge: z.number().int().min(1).max(120),
  country: z.string().trim().min(2).max(100),
  schoolName: z.string().trim().max(160).optional().default(""),
  essayTitle: z.string().trim().min(5).max(180),
  declaredWordCount: z.number().int().min(1).max(50_000),
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.enum([PDF_MIME, DOCX_MIME]),
  fileSize: z.number().int().positive().max(MAX_ESSAY_FILE_BYTES),
  fileSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  rulesAccepted: z.literal(true),
  originalityConfirmed: z.literal(true),
});

const FinalizeInput = z.object({
  submissionId: z.string().uuid(),
  filePath: z.string().trim().min(10).max(500),
});

const SubmissionIdInput = z.object({ submissionId: z.string().uuid() });

const CompetitionUpdateInput = z.object({
  competitionId: z.string().uuid(),
  title: z.string().trim().min(5).max(180),
  summary: z.string().trim().min(20).max(3000),
  status: z.enum(["draft", "open", "closed", "judging", "published"]),
  opensAt: z.string().trim().max(50).optional().default(""),
  closesAt: z.string().trim().max(50).optional().default(""),
  minimumAge: z.number().int().min(1).max(120),
  maximumAge: z.number().int().min(1).max(120),
  minimumWords: z.number().int().positive().max(50_000).nullable(),
  maximumWords: z.number().int().positive().max(50_000).nullable(),
  prizeText: z.string().trim().max(500).optional().default(""),
  rulesUrl: z.string().trim().max(500).optional().default(""),
});

const ReviewSubmissionInput = z.object({
  submissionId: z.string().uuid(),
  status: z.enum(["submitted", "under_review", "shortlisted", "winner", "not_selected", "disqualified"]),
  note: z.string().trim().max(2000).optional().default(""),
});

function asOptionalIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Enter a valid date and time.");
  return date.toISOString();
}

function asOptionalHttpsUrl(value: string): string | null {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Links must use HTTPS.");
  return url.toString();
}

function fileExtension(filename: string): string {
  return filename.toLowerCase().split(".").pop() ?? "";
}

function validateFileMetadata(filename: string, mimeType: string, size: number) {
  const expectedExtension = allowedFileTypes.get(mimeType);
  if (!expectedExtension || fileExtension(filename) !== expectedExtension) {
    throw new Error("Upload a PDF or DOCX file whose extension matches its file type.");
  }
  if (size <= 0 || size > MAX_ESSAY_FILE_BYTES) {
    throw new Error("The essay file must be larger than 0 bytes and no more than 10 MB.");
  }
}

function validateMagicBytes(bytes: Uint8Array, mimeType: string) {
  if (mimeType === PDF_MIME) {
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    if (header !== "%PDF-") throw new Error("The uploaded file does not contain a valid PDF header.");
    return;
  }

  const zipHeader = Array.from(bytes.slice(0, 4)).join(",");
  const validZipHeaders = new Set(["80,75,3,4", "80,75,5,6", "80,75,7,8"]);
  if (!validZipHeaders.has(zipHeader)) {
    throw new Error("The uploaded file does not contain a valid DOCX/ZIP header.");
  }
}

function competitionIsOpen(competition: { status: string; opens_at: string | null; closes_at: string | null }) {
  const now = Date.now();
  return competition.status === "open"
    && (!competition.opens_at || Date.parse(competition.opens_at) <= now)
    && (!competition.closes_at || Date.parse(competition.closes_at) > now);
}

async function roleState(userId: string) {
  const access = await loadAccountAccessState(userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return {
    supabaseAdmin,
    isAdmin: access.role === "administrator",
    isAdvisor: access.role === "advisor",
    isStudent: access.role === "member",
  };
}

async function requireStudent(userId: string) {
  const state = await roleState(userId);
  if (!state.isStudent) {
    throw new Error("Advisor and administrator accounts cannot enter the student essay competition.");
  }
  return state.supabaseAdmin;
}

async function requireAdmin(userId: string) {
  const state = await roleState(userId);
  if (!state.isAdmin) throw new Error("Administrator access is required.");
  return state.supabaseAdmin;
}

async function currentCompetition() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("competitions")
    .select("id, slug, title, summary, status, opens_at, closes_at, minimum_age, maximum_age, minimum_words, maximum_words, prize_text, rules_url, is_public, updated_at")
    .eq("slug", CURRENT_COMPETITION_SLUG)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("The essay competition has not been configured yet.");
  return data;
}

export const getPublicCompetition = createServerFn({ method: "GET" }).handler(async () => {
  const competition = await currentCompetition();
  return { ...competition, acceptingSubmissions: competitionIsOpen(competition) };
});

export const getEssayPortalState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ supabaseAdmin, isAdmin, isAdvisor, isStudent }, competition] = await Promise.all([
      roleState(context.userId),
      currentCompetition(),
    ]);

    const [{ data: profile }, { data: submission, error: submissionError }] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name").eq("id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("essay_submissions")
        .select("id, submission_code, participant_name, participant_age, country, school_name, essay_title, declared_word_count, status, revision_number, original_filename, mime_type, file_size, submitted_at, updated_at, admin_note")
        .eq("competition_id", competition.id)
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    if (submissionError) throw new Error(submissionError.message);

    return {
      competition: { ...competition, acceptingSubmissions: competitionIsOpen(competition) },
      submission,
      profileName: profile?.display_name ?? "",
      isAdmin,
      isAdvisor,
      isStudent,
      eligibilityReason: isStudent ? null : "Advisor and administrator accounts cannot submit student entries.",
    };
  });

export const prepareEssayUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => SubmissionMetadataInput.parse(value))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireStudent(context.userId);
    validateFileMetadata(data.originalFilename, data.mimeType, data.fileSize);

    const { data: competition, error: competitionError } = await supabaseAdmin
      .from("competitions")
      .select("id, status, opens_at, closes_at, minimum_age, maximum_age, minimum_words, maximum_words")
      .eq("id", data.competitionId)
      .maybeSingle();
    if (competitionError) throw new Error(competitionError.message);
    if (!competition) throw new Error("Competition not found.");
    if (!competitionIsOpen(competition)) throw new Error("Essay submissions are not currently open.");
    if (data.participantAge < competition.minimum_age || data.participantAge > competition.maximum_age) {
      throw new Error(`Entrants must be between ${competition.minimum_age} and ${competition.maximum_age} years old.`);
    }
    if (competition.minimum_words && data.declaredWordCount < competition.minimum_words) {
      throw new Error(`The essay must contain at least ${competition.minimum_words.toLocaleString()} words.`);
    }
    if (competition.maximum_words && data.declaredWordCount > competition.maximum_words) {
      throw new Error(`The essay must contain no more than ${competition.maximum_words.toLocaleString()} words.`);
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("essay_submissions")
      .select("id, submission_code, status, revision_number, file_path")
      .eq("competition_id", competition.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing && !["draft", "submitted", "withdrawn"].includes(existing.status)) {
      throw new Error("This submission can no longer be replaced because judging has started.");
    }

    const submissionId = existing?.id ?? randomUUID();
    const submissionCode = existing?.submission_code ?? `BT-${new Date().getUTCFullYear()}-${submissionId.slice(0, 8).toUpperCase()}`;
    const nextRevision = (existing?.revision_number ?? 0) + 1;
    const extension = allowedFileTypes.get(data.mimeType)!;
    const filePath = `${context.userId}/${submissionId}/revision-${nextRevision}.${extension}`;
    const now = new Date().toISOString();

    const payload = {
      id: submissionId,
      submission_code: submissionCode,
      competition_id: competition.id,
      user_id: context.userId,
      participant_name: data.participantName,
      participant_age: data.participantAge,
      country: data.country,
      school_name: data.schoolName || null,
      essay_title: data.essayTitle,
      declared_word_count: data.declaredWordCount,
      status: existing?.status === "submitted" ? "submitted" as const : "draft" as const,
      pending_file_path: filePath,
      pending_original_filename: data.originalFilename,
      pending_mime_type: data.mimeType,
      pending_file_size: data.fileSize,
      pending_file_sha256: data.fileSha256.toLowerCase(),
      rules_accepted_at: now,
      originality_confirmed_at: now,
    };

    const { error: saveError } = await supabaseAdmin
      .from("essay_submissions")
      .upsert(payload, { onConflict: "competition_id,user_id" });
    if (saveError) throw new Error(saveError.message);

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(ESSAY_BUCKET)
      .createSignedUploadUrl(filePath);
    if (signedError || !signed?.token) {
      throw new Error(signedError?.message || "A secure upload slot could not be created.");
    }

    return {
      submissionId,
      submissionCode,
      filePath,
      uploadToken: signed.token,
      revision: nextRevision,
    };
  });

export const finalizeEssayUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => FinalizeInput.parse(value))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireStudent(context.userId);
    const { data: submission, error: readError } = await supabaseAdmin
      .from("essay_submissions")
      .select("id, submission_code, user_id, status, revision_number, file_path, pending_file_path, pending_original_filename, pending_mime_type, pending_file_size, pending_file_sha256")
      .eq("id", data.submissionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!submission) throw new Error("Submission not found.");
    if (!submission.pending_file_path || submission.pending_file_path !== data.filePath) {
      throw new Error("This upload does not match the active submission slot.");
    }
    if (!submission.pending_mime_type || !submission.pending_original_filename || !submission.pending_file_sha256 || !submission.pending_file_size) {
      throw new Error("The pending upload metadata is incomplete.");
    }

    try {
      const { data: blob, error: downloadError } = await supabaseAdmin.storage
        .from(ESSAY_BUCKET)
        .download(data.filePath);
      if (downloadError || !blob) throw new Error(downloadError?.message || "The uploaded file could not be verified.");
      if (blob.size !== Number(submission.pending_file_size)) throw new Error("The uploaded file size does not match the selected file.");

      const bytes = new Uint8Array(await blob.arrayBuffer());
      validateMagicBytes(bytes, submission.pending_mime_type);
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (digest !== submission.pending_file_sha256) throw new Error("The uploaded file did not pass its integrity check.");

      const now = new Date().toISOString();
      const nextRevision = submission.revision_number + 1;
      const { error: finalizeError } = await supabaseAdmin
        .from("essay_submissions")
        .update({
          status: "submitted",
          revision_number: nextRevision,
          file_path: submission.pending_file_path,
          original_filename: submission.pending_original_filename,
          mime_type: submission.pending_mime_type,
          file_size: submission.pending_file_size,
          file_sha256: submission.pending_file_sha256,
          pending_file_path: null,
          pending_original_filename: null,
          pending_mime_type: null,
          pending_file_size: null,
          pending_file_sha256: null,
          submitted_at: now,
          reviewed_at: null,
          reviewed_by: null,
          admin_note: null,
        })
        .eq("id", submission.id)
        .eq("pending_file_path", data.filePath);
      if (finalizeError) throw new Error(finalizeError.message);

      if (submission.file_path && submission.file_path !== data.filePath) {
        await supabaseAdmin.storage.from(ESSAY_BUCKET).remove([submission.file_path]);
      }

      await supabaseAdmin.from("essay_submission_events").insert({
        submission_id: submission.id,
        actor_id: context.userId,
        action: submission.revision_number > 0 ? "resubmitted" : "submitted",
        note: `Revision ${nextRevision}`,
      });

      return {
        ok: true as const,
        submissionCode: submission.submission_code,
        revision: nextRevision,
        submittedAt: now,
      };
    } catch (error) {
      await supabaseAdmin.storage.from(ESSAY_BUCKET).remove([data.filePath]);
      await supabaseAdmin
        .from("essay_submissions")
        .update({
          pending_file_path: null,
          pending_original_filename: null,
          pending_mime_type: null,
          pending_file_size: null,
          pending_file_sha256: null,
        })
        .eq("id", submission.id)
        .eq("pending_file_path", data.filePath);
      throw error;
    }
  });

export const getEssaySubmissionDownload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => SubmissionIdInput.parse(value))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, isAdmin } = await roleState(context.userId);
    const { data: submission, error } = await supabaseAdmin
      .from("essay_submissions")
      .select("user_id, file_path, original_filename")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!submission || (!isAdmin && submission.user_id !== context.userId)) throw new Error("Submission not found.");
    if (!submission.file_path || !submission.original_filename) throw new Error("No verified essay file is attached.");

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(ESSAY_BUCKET)
      .createSignedUrl(submission.file_path, 300, { download: submission.original_filename });
    if (signedError || !signed?.signedUrl) throw new Error(signedError?.message || "The download link could not be created.");
    return { url: signed.signedUrl, filename: submission.original_filename };
  });

export const withdrawEssaySubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => SubmissionIdInput.parse(value))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireStudent(context.userId);
    const competition = await currentCompetition();
    if (!competitionIsOpen(competition)) throw new Error("Submissions can only be withdrawn while the competition is open.");

    const { data: submission, error } = await supabaseAdmin
      .from("essay_submissions")
      .update({ status: "withdrawn" })
      .eq("id", data.submissionId)
      .eq("user_id", context.userId)
      .in("status", ["draft", "submitted"])
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!submission) throw new Error("This submission cannot be withdrawn.");
    await supabaseAdmin.from("essay_submission_events").insert({ submission_id: submission.id, actor_id: context.userId, action: "withdrawn" });
    return { ok: true as const };
  });

export const getEssayAdminState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const competition = await currentCompetition();
    const { data: submissions, error } = await supabaseAdmin
      .from("essay_submissions")
      .select("id, submission_code, participant_name, participant_age, country, school_name, essay_title, declared_word_count, status, revision_number, original_filename, mime_type, file_size, submitted_at, reviewed_at, admin_note, created_at, updated_at")
      .eq("competition_id", competition.id)
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return { competition, submissions: submissions ?? [] };
  });

export const updateCompetition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => CompetitionUpdateInput.parse(value))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    if (data.maximumAge < data.minimumAge) throw new Error("The maximum age cannot be lower than the minimum age.");
    if (data.minimumWords && data.maximumWords && data.maximumWords < data.minimumWords) {
      throw new Error("The maximum word count cannot be lower than the minimum word count.");
    }
    const opensAt = asOptionalIso(data.opensAt);
    const closesAt = asOptionalIso(data.closesAt);
    if (opensAt && closesAt && Date.parse(closesAt) <= Date.parse(opensAt)) {
      throw new Error("The closing time must be after the opening time.");
    }

    const { error } = await supabaseAdmin
      .from("competitions")
      .update({
        title: data.title,
        summary: data.summary,
        status: data.status,
        opens_at: opensAt,
        closes_at: closesAt,
        minimum_age: data.minimumAge,
        maximum_age: data.maximumAge,
        minimum_words: data.minimumWords,
        maximum_words: data.maximumWords,
        prize_text: data.prizeText || null,
        rules_url: asOptionalHttpsUrl(data.rulesUrl),
      })
      .eq("id", data.competitionId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const reviewEssaySubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ReviewSubmissionInput.parse(value))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const now = new Date().toISOString();
    const { data: submission, error } = await supabaseAdmin
      .from("essay_submissions")
      .update({ status: data.status, admin_note: data.note || null, reviewed_at: now, reviewed_by: context.userId })
      .eq("id", data.submissionId)
      .neq("status", "draft")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!submission) throw new Error("Submission not found or not ready for review.");
    await supabaseAdmin.from("essay_submission_events").insert({
      submission_id: submission.id,
      actor_id: context.userId,
      action: data.status,
      note: data.note || null,
    });
    return { ok: true as const, status: data.status };
  });
