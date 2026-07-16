import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  ESSAY_BUCKET,
  MAX_ESSAY_FILE_BYTES,
  finalizeEssayUpload,
  getEssayPortalState,
  getEssaySubmissionDownload,
  prepareEssayUpload,
  withdrawEssaySubmission,
} from "@/lib/competition.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/essay-submission")({
  component: EssaySubmissionPage,
});

type Competition = {
  id: string;
  title: string;
  summary: string;
  status: string;
  opens_at: string | null;
  closes_at: string | null;
  minimum_age: number;
  maximum_age: number;
  minimum_words: number | null;
  maximum_words: number | null;
  prize_text: string | null;
  rules_url: string | null;
  acceptingSubmissions: boolean;
};

type ExistingSubmission = {
  id: string;
  submission_code: string;
  participant_name: string;
  participant_age: number;
  country: string;
  school_name: string | null;
  essay_title: string;
  declared_word_count: number;
  status: string;
  revision_number: number;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  submitted_at: string | null;
  updated_at: string;
  admin_note: string | null;
};

type PortalState = {
  competition: Competition;
  submission: ExistingSubmission | null;
  profileName: string;
  isAdmin: boolean;
  isAdvisor: boolean;
  isStudent: boolean;
  eligibilityReason: string | null;
};

type FormState = {
  participantName: string;
  participantAge: string;
  country: string;
  schoolName: string;
  essayTitle: string;
  declaredWordCount: string;
  rulesAccepted: boolean;
  originalityConfirmed: boolean;
};

const EMPTY_FORM: FormState = {
  participantName: "",
  participantAge: "",
  country: "",
  schoolName: "",
  essayTitle: "",
  declaredWordCount: "",
  rulesAccepted: false,
  originalityConfirmed: false,
};

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function normalizedFileType(file: File): string | null {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "pdf" && (!file.type || file.type === PDF_MIME)) return PDF_MIME;
  if (extension === "docx" && (!file.type || file.type === DOCX_MIME)) return DOCX_MIME;
  return null;
}

function validateSelectedFile(file: File): string | null {
  if (!normalizedFileType(file)) return "Choose a genuine PDF or DOCX file.";
  if (file.size <= 0) return "The selected file is empty.";
  if (file.size > MAX_ESSAY_FILE_BYTES) return "The essay file cannot exceed 10 MB.";
  return null;
}

async function sha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toForm(state: PortalState): FormState {
  const submission = state.submission;
  return {
    participantName: submission?.participant_name || state.profileName,
    participantAge: submission ? String(submission.participant_age) : "",
    country: submission?.country || "",
    schoolName: submission?.school_name || "",
    essayTitle: submission?.essay_title || "",
    declaredWordCount: submission ? String(submission.declared_word_count) : "",
    rulesAccepted: false,
    originalityConfirmed: false,
  };
}

function EssaySubmissionPage() {
  const getState = useServerFn(getEssayPortalState);
  const prepareUpload = useServerFn(prepareEssayUpload);
  const finalizeUpload = useServerFn(finalizeEssayUpload);
  const getDownload = useServerFn(getEssaySubmissionDownload);
  const withdraw = useServerFn(withdrawEssaySubmission);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const [state, setState] = useState<PortalState | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<"idle" | "hashing" | "preparing" | "uploading" | "verifying">("idle");
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const result = await getState();
      const next = result as PortalState;
      setState(next);
      setForm(toForm(next));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The submission portal could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function chooseFile(nextFile: File | null) {
    if (!nextFile) return;
    const error = validateSelectedFile(nextFile);
    if (error) {
      setFile(null);
      setFileError(error);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(nextFile);
    setFileError(null);
  }

  function onDragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    if (event.dataTransfer.types.includes("Files")) setDragActive(true);
  }

  function onDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  }

  function onDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragActive(false);
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  }

  function removeFile() {
    setFile(null);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!state || !file) {
      setFileError("Attach your essay before submitting.");
      return;
    }

    const mimeType = normalizedFileType(file);
    if (!mimeType) {
      setFileError("Choose a genuine PDF or DOCX file.");
      return;
    }

    try {
      setStage("hashing");
      const fileSha256 = await sha256(file);

      setStage("preparing");
      const prepared = await prepareUpload({
        data: {
          competitionId: state.competition.id,
          participantName: form.participantName,
          participantAge: Number(form.participantAge),
          country: form.country,
          schoolName: form.schoolName,
          essayTitle: form.essayTitle,
          declaredWordCount: Number(form.declaredWordCount),
          originalFilename: file.name,
          mimeType,
          fileSize: file.size,
          fileSha256,
          rulesAccepted: form.rulesAccepted as true,
          originalityConfirmed: form.originalityConfirmed as true,
        },
      });

      setStage("uploading");
      const { error: uploadError } = await supabase.storage
        .from(ESSAY_BUCKET)
        .uploadToSignedUrl(prepared.filePath, prepared.uploadToken, file, { contentType: mimeType });
      if (uploadError) throw uploadError;

      setStage("verifying");
      const receipt = await finalizeUpload({
        data: { submissionId: prepared.submissionId, filePath: prepared.filePath },
      });

      toast.success(`Essay submitted successfully · ${receipt.submissionCode}`);
      removeFile();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The essay could not be submitted.");
    } finally {
      setStage("idle");
    }
  }

  async function downloadCurrent() {
    if (!state?.submission) return;
    try {
      const result = await getDownload({ data: { submissionId: state.submission.id } });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The essay could not be downloaded.");
    }
  }

  async function withdrawCurrent() {
    if (!state?.submission || !window.confirm("Withdraw this entry? You can submit it again only while the portal remains open.")) return;
    setWithdrawing(true);
    try {
      await withdraw({ data: { submissionId: state.submission.id } });
      toast.success("Submission withdrawn");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The submission could not be withdrawn.");
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading) {
    return <SiteLayout><Section className="py-24 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-teal" /></Section></SiteLayout>;
  }

  if (!state) {
    return <SiteLayout><Section className="py-24 text-center"><AlertCircle className="mx-auto h-10 w-10 text-warn" /><h1 className="mt-4 text-2xl font-bold">The submission portal is unavailable.</h1></Section></SiteLayout>;
  }

  const busy = stage !== "idle";
  const canSubmit = state.isStudent && state.competition.acceptingSubmissions;

  return (
    <SiteLayout>
      <div className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="relative py-16 sm:py-20">
          <Eyebrow>Essay competition</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold text-navy-deep sm:text-5xl">Submit your essay securely.</h1>
          <p className="mt-4 max-w-2xl text-navy-deep/70">Upload a PDF or DOCX entry, receive a permanent submission reference and replace your file before the deadline when necessary.</p>
        </Section>
      </div>

      <Section className="py-10 sm:py-14">
        <CompetitionStatus competition={state.competition} />

        {!state.isStudent && (
          <div className="mt-6 rounded-2xl border border-warn/30 bg-warn/5 p-6">
            <ShieldCheck className="h-7 w-7 text-warn" />
            <h2 className="mt-3 text-xl font-bold">Student account required</h2>
            <p className="mt-2 text-sm text-muted-foreground">{state.eligibilityReason}</p>
          </div>
        )}

        {state.submission && (
          <SubmissionReceipt
            submission={state.submission}
            canReplace={canSubmit}
            onDownload={downloadCurrent}
            onWithdraw={withdrawCurrent}
            withdrawing={withdrawing}
          />
        )}

        {canSubmit ? (
          <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-teal">Entrant details</div>
                <h2 className="mt-2 text-2xl font-bold">{state.submission ? "Replace or update your entry" : "Create your entry"}</h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Participant name" value={form.participantName} onChange={(value) => setForm((current) => ({ ...current, participantName: value }))} required maxLength={100} />
                <Field label="Age" type="number" min={state.competition.minimum_age} max={state.competition.maximum_age} value={form.participantAge} onChange={(value) => setForm((current) => ({ ...current, participantAge: value }))} required />
                <Field label="Country or territory" value={form.country} onChange={(value) => setForm((current) => ({ ...current, country: value }))} required maxLength={100} />
                <Field label="School (optional)" value={form.schoolName} onChange={(value) => setForm((current) => ({ ...current, schoolName: value }))} maxLength={160} />
              </div>

              <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
                <Field label="Essay title" value={form.essayTitle} onChange={(value) => setForm((current) => ({ ...current, essayTitle: value }))} required maxLength={180} />
                <Field label="Word count" type="number" min={state.competition.minimum_words ?? 1} max={state.competition.maximum_words ?? 50_000} value={form.declaredWordCount} onChange={(value) => setForm((current) => ({ ...current, declaredWordCount: value }))} required />
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold">Essay file</div>
                <div
                  onDragEnter={onDragEnter}
                  onDragLeave={onDragLeave}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  className={cn(
                    "relative min-h-64 overflow-hidden rounded-2xl border-2 border-dashed transition",
                    dragActive ? "border-teal bg-teal/10 shadow-glow" : "border-border bg-secondary/30 hover:border-teal/50",
                    fileError && "border-danger/60 bg-danger/5",
                  )}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                    className="sr-only"
                    id="essay-file"
                  />

                  {dragActive && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-teal/95 p-6 text-center text-white">
                      <UploadCloud className="h-14 w-14" />
                      <div className="mt-4 text-2xl font-bold">Drop your essay here</div>
                      <div className="mt-2 text-sm text-white/80">Release the file to attach it to this submission.</div>
                    </div>
                  )}

                  <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
                    {file ? (
                      <>
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10 text-teal"><FileCheck2 className="h-7 w-7" /></div>
                        <div className="mt-4 max-w-full truncate font-semibold">{file.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{formatBytes(file.size)} · Ready for validation</div>
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                          <label htmlFor="essay-file" className="cursor-pointer rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-teal/50">Choose a different file</label>
                          <button type="button" onClick={removeFile} className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mesh text-white shadow-glow"><UploadCloud className="h-8 w-8" /></div>
                        <div className="mt-5 text-xl font-bold">Drag and drop your essay</div>
                        <div className="mt-2 text-sm text-muted-foreground">PDF or DOCX · maximum 10 MB</div>
                        <label htmlFor="essay-file" className="mt-5 cursor-pointer rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">Select file</label>
                      </>
                    )}
                  </div>
                </div>
                {fileError && <div className="mt-2 flex items-center gap-2 text-sm text-danger"><AlertCircle className="h-4 w-4" /> {fileError}</div>}
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-secondary/40 p-5">
                <Checkbox checked={form.originalityConfirmed} onChange={(value) => setForm((current) => ({ ...current, originalityConfirmed: value }))} label="I confirm that this essay is my own original work and that all sources are acknowledged." />
                <Checkbox checked={form.rulesAccepted} onChange={(value) => setForm((current) => ({ ...current, rulesAccepted: value }))} label="I agree to the competition rules and understand that incomplete or ineligible entries may be rejected." />
              </div>

              <button
                type="submit"
                disabled={busy || !file || !form.rulesAccepted || !form.originalityConfirmed}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mesh px-6 py-3.5 font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {stageLabel(stage, Boolean(state.submission))}
              </button>
            </div>

            <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <LockKeyhole className="h-7 w-7 text-teal" />
                <h2 className="mt-4 text-xl font-bold">How your upload is checked</h2>
                <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li><strong className="text-foreground">1.</strong> Your browser calculates a SHA-256 fingerprint.</li>
                  <li><strong className="text-foreground">2.</strong> The file uploads through a temporary signed token to private storage.</li>
                  <li><strong className="text-foreground">3.</strong> The server verifies its size, type, header and fingerprint.</li>
                  <li><strong className="text-foreground">4.</strong> Only then is a submission receipt issued.</li>
                </ol>
              </div>
              <div className="rounded-2xl border border-warn/30 bg-warn/5 p-5 text-sm leading-relaxed text-muted-foreground">
                Remove comments, tracked changes and personal information that you do not want judges to see. Do not upload identity documents or unrelated files.
              </div>
            </aside>
          </form>
        ) : state.isStudent ? (
          <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-teal" />
            <h2 className="mt-4 text-2xl font-bold">Submissions are not open right now.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">Your account is eligible. Return after the opening date shown above; the form and secure upload area will appear automatically.</p>
            <Link to="/competitions" className="mt-5 inline-flex rounded-full border border-border px-5 py-2.5 text-sm font-semibold">Back to competition details</Link>
          </div>
        ) : null}
      </Section>
    </SiteLayout>
  );
}

function CompetitionStatus({ competition }: { competition: Competition }) {
  const statusText = competition.acceptingSubmissions
    ? "Open for submissions"
    : competition.status === "draft" ? "Details being finalised" : competition.status === "judging" ? "Judging in progress" : "Submissions closed";
  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-teal">Current competition</div>
          <h2 className="mt-2 text-2xl font-bold">{competition.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{competition.summary}</p>
        </div>
        <span className={cn("rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide", competition.acceptingSubmissions ? "bg-teal/10 text-teal" : "bg-secondary text-muted-foreground")}>{statusText}</span>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Age" value={`${competition.minimum_age}–${competition.maximum_age}`} />
        <Stat label="Word count" value={wordRange(competition.minimum_words, competition.maximum_words)} />
        <Stat label="Opens" value={competition.opens_at ? new Date(competition.opens_at).toLocaleString() : "To be announced"} />
        <Stat label="Closes" value={competition.closes_at ? new Date(competition.closes_at).toLocaleString() : "To be announced"} />
      </div>
      {competition.rules_url && <a href={competition.rules_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex text-sm font-semibold text-teal hover:underline">Read the full competition rules</a>}
    </div>
  );
}

function SubmissionReceipt({ submission, canReplace, onDownload, onWithdraw, withdrawing }: {
  submission: ExistingSubmission;
  canReplace: boolean;
  onDownload: () => void;
  onWithdraw: () => void;
  withdrawing: boolean;
}) {
  return (
    <div className="mt-6 rounded-3xl border border-teal/25 bg-teal/5 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-1 h-7 w-7 shrink-0 text-teal" />
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-teal">Submission record</div>
            <h2 className="mt-1 text-2xl font-bold">{submission.essay_title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Reference <strong className="text-foreground">{submission.submission_code}</strong> · Revision {submission.revision_number} · Status: {submission.status.replaceAll("_", " ")}</p>
            {submission.original_filename && <p className="mt-1 text-sm text-muted-foreground">{submission.original_filename} {submission.file_size ? `· ${formatBytes(submission.file_size)}` : ""}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {submission.original_filename && <button onClick={onDownload} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"><Download className="h-4 w-4" /> Download</button>}
          {canReplace && submission.status !== "withdrawn" && <button onClick={onWithdraw} disabled={withdrawing} className="inline-flex items-center gap-2 rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-50">{withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Withdraw</button>}
        </div>
      </div>
      {submission.admin_note && <div className="mt-5 rounded-xl border border-border bg-card p-4 text-sm"><strong>Review note:</strong> {submission.admin_note}</div>}
      {canReplace && <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="h-3.5 w-3.5" /> Submitting another verified file below replaces this revision while retaining the same reference.</div>}
    </div>
  );
}

function stageLabel(stage: string, replacing: boolean) {
  if (stage === "hashing") return "Checking file integrity…";
  if (stage === "preparing") return "Creating secure upload…";
  if (stage === "uploading") return "Uploading essay…";
  if (stage === "verifying") return "Verifying on the server…";
  return replacing ? "Submit replacement revision" : "Submit essay";
}

function wordRange(minimum: number | null, maximum: number | null) {
  if (minimum && maximum) return `${minimum.toLocaleString()}–${maximum.toLocaleString()}`;
  if (minimum) return `At least ${minimum.toLocaleString()}`;
  if (maximum) return `Up to ${maximum.toLocaleString()}`;
  return "To be announced";
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-secondary/30 p-4"><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></div>;
}

function Field({ label, value, onChange, type = "text", required, maxLength, min, max }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
}) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} maxLength={maxLength} min={min} max={max} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal/40" /></label>;
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1" /><span className="text-sm leading-relaxed text-muted-foreground">{label}</span></label>;
}
