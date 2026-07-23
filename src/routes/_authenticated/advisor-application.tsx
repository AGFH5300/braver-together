import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  Loader2,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { roleHome } from "@/lib/account-access";
import {
  ADVISOR_CV_BUCKET,
  MAX_ADVISOR_CV_BYTES,
  finalizeAdvisorCvUpload,
  getAdvisorCvDownload,
  getAdvisorPortalState,
  prepareAdvisorCvUpload,
  submitAdvisorApplication,
} from "@/lib/advisor-application.functions";
import { cn } from "@/lib/utils";

type ApplicationStatus = "draft" | "pending" | "more_info" | "approved" | "denied";

type ExistingApplication = {
  id: string;
  full_name: string;
  email: string;
  organization: string | null;
  role_title: string | null;
  location: string | null;
  experience: string;
  motivation: string;
  focus_areas: string[];
  profile_url: string | null;
  availability_note: string | null;
  status: ApplicationStatus;
  admin_note: string | null;
  submitted_at: string;
  updated_at: string;
  reviewed_at: string | null;
  cv_original_filename: string | null;
  cv_mime_type: string | null;
  cv_file_size: number | null;
};

type FormState = {
  fullName: string;
  email: string;
  organization: string;
  roleTitle: string;
  location: string;
  experience: string;
  motivation: string;
  focusAreas: string;
  profileUrl: string;
  availabilityNote: string;
};

const EMPTY_FORM: FormState = {
  fullName: "",
  email: "",
  organization: "",
  roleTitle: "",
  location: "",
  experience: "",
  motivation: "",
  focusAreas: "",
  profileUrl: "",
  availabilityNote: "",
};

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type UploadStage = "idle" | "hashing" | "preparing" | "uploading" | "verifying" | "submitting";

export const Route = createFileRoute("/_authenticated/advisor-application")({
  component: AdvisorApplicationPage,
});

function normalizedFileType(file: File): string | null {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "pdf" && (!file.type || file.type === PDF_MIME)) return PDF_MIME;
  if (extension === "docx" && (!file.type || file.type === DOCX_MIME)) return DOCX_MIME;
  return null;
}

function validateSelectedFile(file: File): string | null {
  if (!normalizedFileType(file)) return "Choose a genuine PDF or DOCX CV.";
  if (file.size <= 0) return "The selected CV is empty.";
  if (file.size > MAX_ADVISOR_CV_BYTES) return "The CV cannot exceed 5 MB.";
  return null;
}

async function sha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AdvisorApplicationPage() {
  const navigate = useNavigate();
  const getPortalState = useServerFn(getAdvisorPortalState);
  const submitApplication = useServerFn(submitAdvisorApplication);
  const prepareCv = useServerFn(prepareAdvisorCvUpload);
  const finalizeCv = useServerFn(finalizeAdvisorCvUpload);
  const getCvDownload = useServerFn(getAdvisorCvDownload);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [application, setApplication] = useState<ExistingApplication | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdvisor, setIsAdvisor] = useState(false);
  const [editing, setEditing] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [{ data: auth }, state] = await Promise.all([supabase.auth.getUser(), getPortalState()]);
      if (state.role !== "member") {
        await navigate({ to: roleHome(state.role), replace: true });
        return;
      }
      const existing = state.application as ExistingApplication | null;
      setApplication(existing);
      setIsAdmin(state.isAdmin);
      setIsAdvisor(state.isAdvisor);
      setEditing(!existing || existing.status === "draft" || existing.status === "more_info" || existing.status === "denied");
      setForm(existing ? {
        fullName: existing.full_name,
        email: existing.email,
        organization: existing.organization ?? "",
        roleTitle: existing.role_title ?? "",
        location: existing.location ?? "",
        experience: existing.experience,
        motivation: existing.motivation,
        focusAreas: existing.focus_areas.join(", "),
        profileUrl: existing.profile_url ?? "",
        availabilityNote: existing.availability_note ?? "",
      } : { ...EMPTY_FORM, email: auth.user?.email ?? "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The advisor portal could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function applicationData() {
    return {
      fullName: form.fullName,
      email: form.email,
      organization: form.organization,
      roleTitle: form.roleTitle,
      location: form.location,
      experience: form.experience,
      motivation: form.motivation,
      focusAreas: Array.from(new Set(form.focusAreas.split(",").map((area) => area.trim()).filter(Boolean))),
      profileUrl: form.profileUrl,
      availabilityNote: form.availabilityNote,
    };
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

  function removeFile() {
    setFile(null);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file && !application?.cv_original_filename) {
      setFileError("Attach your CV before submitting the application.");
      return;
    }

    try {
      const data = applicationData();
      if (file) {
        const mimeType = normalizedFileType(file);
        if (!mimeType) {
          setFileError("Choose a genuine PDF or DOCX CV.");
          return;
        }

        setStage("hashing");
        const fileSha256 = await sha256(file);
        setStage("preparing");
        const prepared = await prepareCv({ data: {
          ...data,
          originalFilename: file.name,
          mimeType,
          fileSize: file.size,
          fileSha256,
        } });

        setStage("uploading");
        const { error: uploadError } = await supabase.storage
          .from(ADVISOR_CV_BUCKET)
          .uploadToSignedUrl(prepared.filePath, prepared.uploadToken, file, { contentType: mimeType });
        if (uploadError) throw uploadError;

        setStage("verifying");
        await finalizeCv({ data: { applicationId: prepared.applicationId, filePath: prepared.filePath } });
      } else {
        setStage("submitting");
        await submitApplication({ data });
      }

      window.dispatchEvent(new Event("advisor-onboarding-changed"));
      toast.success("Application submitted for review");
      setEditing(false);
      removeFile();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your application could not be submitted.");
    } finally {
      setStage("idle");
    }
  }

  async function downloadCv() {
    if (!application) return;
    setDownloading(true);
    try {
      const result = await getCvDownload({ data: { applicationId: application.id } });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The CV could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <SiteLayout><Section className="py-24 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-teal" /></Section></SiteLayout>;
  }

  const busy = stage !== "idle";

  return (
    <SiteLayout>
      <div className="bg-hero">
        <Section className="py-16">
          <Eyebrow><ShieldCheck className="h-3.5 w-3.5" /> Advisor applications</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold text-navy-deep sm:text-5xl">Help young people understand the digital world.</h1>
          <p className="mt-4 max-w-2xl text-lg text-navy-deep/70">Apply to volunteer as a BraverTogether advisor. Applications are reviewed before an account can respond to students.</p>
          {isAdmin && <Link to="/admin-advisors" className="mt-6 inline-flex rounded-full border border-navy/20 bg-white/80 px-5 py-2.5 text-sm font-semibold text-navy-deep">Open admin review queue</Link>}
        </Section>
      </div>

      <Section className="py-12">
        {isAdvisor || application?.status === "approved" ? (
          <StatusPanel status="approved" note={application?.admin_note} />
        ) : application && application.status !== "draft" && !editing ? (
          <div className="mx-auto max-w-3xl space-y-5">
            <StatusPanel status={application.status} note={application.admin_note} />
            {(application.status === "more_info" || application.status === "denied") && (
              <button onClick={() => setEditing(true)} className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white">Update and resubmit</button>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
            {application && application.status !== "draft" && <StatusPanel status={application.status} note={application.admin_note} compact />}

            <div className="grid gap-5 rounded-3xl border border-border bg-card p-6 shadow-card sm:grid-cols-2 sm:p-8">
              <Field label="Full name" value={form.fullName} onChange={(value) => setForm((current) => ({ ...current, fullName: value }))} required maxLength={100} />
              <Field label="Email address" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} required maxLength={200} />
              <Field label="Organisation or institution" value={form.organization} onChange={(value) => setForm((current) => ({ ...current, organization: value }))} maxLength={160} />
              <Field label="Current role or course" value={form.roleTitle} onChange={(value) => setForm((current) => ({ ...current, roleTitle: value }))} maxLength={120} />
              <Field label="Location and time zone" value={form.location} onChange={(value) => setForm((current) => ({ ...current, location: value }))} maxLength={120} />
              <Field label="Professional or university profile" placeholder="example.com or https://example.com" value={form.profileUrl} onChange={(value) => setForm((current) => ({ ...current, profileUrl: value }))} maxLength={500} />
              <div className="sm:col-span-2"><Field label="Focus areas (comma-separated)" value={form.focusAreas} onChange={(value) => setForm((current) => ({ ...current, focusAreas: value }))} placeholder="Privacy, online safety, copyright" required maxLength={600} /></div>
              <div className="sm:col-span-2"><Field label="Relevant education and experience" textarea value={form.experience} onChange={(value) => setForm((current) => ({ ...current, experience: value }))} placeholder="Describe the experience that would help you answer educational questions responsibly." required minLength={40} maxLength={3000} minHeight="min-h-40" /></div>
              <div className="sm:col-span-2"><Field label="Why would you like to volunteer?" textarea value={form.motivation} onChange={(value) => setForm((current) => ({ ...current, motivation: value }))} required minLength={40} maxLength={3000} minHeight="min-h-40" /></div>
              <div className="sm:col-span-2"><Field label="Typical availability" textarea value={form.availabilityNote} onChange={(value) => setForm((current) => ({ ...current, availabilityNote: value }))} placeholder="For example: weekday evenings, Gulf Standard Time" maxLength={500} minHeight="min-h-28" /></div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">CV or résumé <span className="text-danger" aria-hidden="true">*</span><span className="sr-only"> required</span></div>
                  <div className="mt-1 text-xs text-muted-foreground">PDF or DOCX · maximum 5 MB</div>
                </div>
                {application?.cv_original_filename && (
                  <button type="button" onClick={downloadCv} disabled={downloading} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50">
                    {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download current CV
                  </button>
                )}
              </div>

              <div
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
                className={cn(
                  "relative min-h-56 overflow-hidden rounded-2xl border-2 border-dashed transition",
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
                  id="advisor-cv-file"
                />

                {dragActive && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-teal/95 p-6 text-center text-white">
                    <UploadCloud className="h-14 w-14" />
                    <div className="mt-4 text-2xl font-bold">Drop your CV here</div>
                    <div className="mt-2 text-sm text-white/80">Release the file to attach it to your application.</div>
                  </div>
                )}

                <div className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
                  {file ? (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10 text-teal"><FileCheck2 className="h-7 w-7" /></div>
                      <div className="mt-4 max-w-full truncate font-semibold">{file.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{formatBytes(file.size)} · Ready to upload</div>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <label htmlFor="advisor-cv-file" className="cursor-pointer rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-teal/50">Choose a different file</label>
                        <button type="button" onClick={removeFile} className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mesh text-white shadow-glow"><UploadCloud className="h-8 w-8" /></div>
                      <div className="mt-5 text-xl font-bold">{application?.cv_original_filename ? "Replace your current CV" : "Drag and drop your CV"}</div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {application?.cv_original_filename ? `${application.cv_original_filename} is currently attached` : "PDF or DOCX · maximum 5 MB"}
                      </div>
                      <label htmlFor="advisor-cv-file" className="mt-5 cursor-pointer rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">Select file</label>
                    </>
                  )}
                </div>
              </div>
              {fileError && <div className="mt-2 flex items-center gap-2 text-sm text-danger"><AlertCircle className="h-4 w-4" /> {fileError}</div>}
            </div>

            <div className="rounded-2xl border border-border bg-secondary/50 p-5 text-sm leading-relaxed text-muted-foreground">
              By applying, you confirm that the information is accurate and that you understand BraverTogether provides educational information rather than legal representation. Approval may require a follow-up conversation or identity, qualification and safeguarding checks appropriate to the role.
            </div>

            <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mesh px-7 py-3.5 font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{stageLabel(stage, Boolean(application))}
            </button>
          </form>
        )}
      </Section>
    </SiteLayout>
  );
}

function stageLabel(stage: UploadStage, existing: boolean): string {
  if (stage === "hashing") return "Preparing file…";
  if (stage === "preparing") return "Starting upload…";
  if (stage === "uploading") return "Uploading CV…";
  if (stage === "verifying") return "Checking file…";
  if (stage === "submitting") return "Submitting application…";
  return existing ? "Resubmit application" : "Submit application";
}

function StatusPanel({ status, note, compact = false }: { status: Exclude<ApplicationStatus, "draft">; note?: string | null; compact?: boolean }) {
  const details = {
    pending: { icon: Clock3, title: "Application under review", description: "Your application and CV have been received. We will update this page after the review.", className: "border-warn/30 bg-warn/5 text-warn" },
    more_info: { icon: AlertCircle, title: "More information requested", description: "Please review the note below, update your application and resubmit it.", className: "border-warn/30 bg-warn/5 text-warn" },
    approved: { icon: CheckCircle2, title: "Advisor account approved", description: "Your advisor access is active. Complete your profile, choose your availability and publish it when you are ready.", className: "border-teal/30 bg-teal/5 text-teal" },
    denied: { icon: AlertCircle, title: "Application not approved", description: "The current application was not approved. You may update it and resubmit when appropriate.", className: "border-danger/30 bg-danger/5 text-danger" },
  }[status];
  const Icon = details.icon;
  return (
    <div className={cn("rounded-2xl border p-5", details.className, !compact && "p-7")}>
      <div className="flex items-start gap-3"><Icon className="mt-0.5 h-6 w-6 shrink-0" /><div><h2 className="font-display text-xl font-bold text-foreground">{details.title}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{details.description}</p>{note && <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm text-foreground"><div className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Review note</div>{note}</div>}{status === "approved" && <Link to="/profile" className="mt-5 inline-flex rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white">Complete advisor profile</Link>}</div></div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required, textarea, minLength, maxLength, minHeight = "min-h-32" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  required?: boolean;
  textarea?: boolean;
  minLength?: number;
  maxLength?: number;
  minHeight?: string;
}) {
  const className = "mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-teal/35";
  return (
    <label className="block text-sm font-semibold">
      <span>{label}{required && <><span className="ml-1 text-danger" aria-hidden="true">*</span><span className="sr-only"> required</span></>}</span>
      {textarea
        ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} minLength={minLength} maxLength={maxLength} className={cn(className, minHeight, "resize-y leading-relaxed")} />
        : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} minLength={minLength} maxLength={maxLength} autoCapitalize="none" spellCheck={false} className={className} />}
    </label>
  );
}
