import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Download,
  FileText,
  Loader2,
  Save,
  Settings2,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import {
  getEssayAdminState,
  getEssaySubmissionDownload,
  reviewEssaySubmission,
  updateCompetition,
} from "@/lib/competition.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin-competitions")({
  component: AdminCompetitionsPage,
});

type Competition = {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "open" | "closed" | "judging" | "published";
  opens_at: string | null;
  closes_at: string | null;
  minimum_age: number;
  maximum_age: number;
  minimum_words: number | null;
  maximum_words: number | null;
  prize_text: string | null;
  rules_url: string | null;
};

type Submission = {
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
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

type AdminState = { competition: Competition; submissions: Submission[] };

type CompetitionForm = {
  title: string;
  summary: string;
  status: Competition["status"];
  opensAt: string;
  closesAt: string;
  minimumAge: string;
  maximumAge: string;
  minimumWords: string;
  maximumWords: string;
  prizeText: string;
  rulesUrl: string;
};

const REVIEW_STATUSES = [
  ["submitted", "Submitted"],
  ["under_review", "Under review"],
  ["shortlisted", "Shortlisted"],
  ["winner", "Winner"],
  ["not_selected", "Not selected"],
  ["disqualified", "Disqualified"],
] as const;

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toForm(competition: Competition): CompetitionForm {
  return {
    title: competition.title,
    summary: competition.summary,
    status: competition.status,
    opensAt: localDateTime(competition.opens_at),
    closesAt: localDateTime(competition.closes_at),
    minimumAge: String(competition.minimum_age),
    maximumAge: String(competition.maximum_age),
    minimumWords: competition.minimum_words ? String(competition.minimum_words) : "",
    maximumWords: competition.maximum_words ? String(competition.maximum_words) : "",
    prizeText: competition.prize_text || "",
    rulesUrl: competition.rules_url || "",
  };
}

function AdminCompetitionsPage() {
  const getState = useServerFn(getEssayAdminState);
  const saveCompetition = useServerFn(updateCompetition);
  const [state, setState] = useState<AdminState | null>(null);
  const [form, setForm] = useState<CompetitionForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const result = await getState();
      const next = result as AdminState;
      setState(next);
      setForm(toForm(next.competition));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Competition administration could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!state || !form) return;
    setSaving(true);
    try {
      await saveCompetition({
        data: {
          competitionId: state.competition.id,
          title: form.title,
          summary: form.summary,
          status: form.status,
          opensAt: form.opensAt ? new Date(form.opensAt).toISOString() : "",
          closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : "",
          minimumAge: Number(form.minimumAge),
          maximumAge: Number(form.maximumAge),
          minimumWords: form.minimumWords ? Number(form.minimumWords) : null,
          maximumWords: form.maximumWords ? Number(form.maximumWords) : null,
          prizeText: form.prizeText,
          rulesUrl: form.rulesUrl,
        },
      });
      toast.success("Competition settings saved");
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Competition settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const submissions = state?.submissions ?? [];
    return {
      total: submissions.filter((item) => item.status !== "draft" && item.status !== "withdrawn").length,
      review: submissions.filter((item) => item.status === "submitted" || item.status === "under_review").length,
      shortlisted: submissions.filter((item) => item.status === "shortlisted").length,
      winners: submissions.filter((item) => item.status === "winner").length,
    };
  }, [state]);

  if (loading) return <SiteLayout><Section className="py-24 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-teal" /></Section></SiteLayout>;
  if (error || !state || !form) return <SiteLayout><Section className="py-24 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-warn" /><h1 className="mt-4 text-2xl font-bold">Administrator access required</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></Section></SiteLayout>;

  return (
    <SiteLayout>
      <div className="bg-hero">
        <Section className="py-14">
          <Eyebrow>Competition administration</Eyebrow>
          <h1 className="mt-3 text-4xl font-bold text-navy-deep">Essay competition control room</h1>
          <p className="mt-2 max-w-2xl text-navy-deep/70">Publish the final entry requirements, open or close submissions and review every verified file from one private workspace.</p>
        </Section>
      </div>

      <Section className="py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Users} label="Valid entries" value={counts.total} />
          <Metric icon={FileText} label="Awaiting review" value={counts.review} />
          <Metric icon={ShieldCheck} label="Shortlisted" value={counts.shortlisted} />
          <Metric icon={Trophy} label="Winners" value={counts.winners} />
        </div>

        <form onSubmit={save} className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="flex items-center gap-3"><Settings2 className="h-6 w-6 text-teal" /><div><div className="text-xs font-bold uppercase tracking-widest text-teal">Public settings</div><h2 className="mt-1 text-2xl font-bold">Competition details and submission window</h2></div></div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Field label="Competition title" value={form.title} onChange={(value) => setForm((current) => current ? { ...current, title: value } : current)} required maxLength={180} />
            <label className="block"><span className="mb-1.5 block text-sm font-semibold">Portal status</span><select value={form.status} onChange={(event) => setForm((current) => current ? { ...current, status: event.target.value as Competition["status"] } : current)} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal/40"><option value="draft">Draft — hidden from public listing</option><option value="open">Open — accept verified uploads</option><option value="closed">Closed</option><option value="judging">Judging</option><option value="published">Results published</option></select></label>
            <label className="block lg:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Public summary</span><textarea value={form.summary} onChange={(event) => setForm((current) => current ? { ...current, summary: event.target.value } : current)} required minLength={20} maxLength={3000} rows={4} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal/40" /></label>
            <Field label="Opening date and time" type="datetime-local" value={form.opensAt} onChange={(value) => setForm((current) => current ? { ...current, opensAt: value } : current)} icon={CalendarClock} />
            <Field label="Closing date and time" type="datetime-local" value={form.closesAt} onChange={(value) => setForm((current) => current ? { ...current, closesAt: value } : current)} icon={CalendarClock} />
            <Field label="Minimum age" type="number" min={1} max={120} value={form.minimumAge} onChange={(value) => setForm((current) => current ? { ...current, minimumAge: value } : current)} required />
            <Field label="Maximum age" type="number" min={1} max={120} value={form.maximumAge} onChange={(value) => setForm((current) => current ? { ...current, maximumAge: value } : current)} required />
            <Field label="Minimum words (optional)" type="number" min={1} max={50000} value={form.minimumWords} onChange={(value) => setForm((current) => current ? { ...current, minimumWords: value } : current)} />
            <Field label="Maximum words (optional)" type="number" min={1} max={50000} value={form.maximumWords} onChange={(value) => setForm((current) => current ? { ...current, maximumWords: value } : current)} />
            <Field label="Prize description" value={form.prizeText} onChange={(value) => setForm((current) => current ? { ...current, prizeText: value } : current)} maxLength={500} />
            <Field label="Rules link" type="url" value={form.rulesUrl} onChange={(value) => setForm((current) => current ? { ...current, rulesUrl: value } : current)} placeholder="https://…" maxLength={500} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-mesh px-6 py-3 font-semibold text-white shadow-glow disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings</button>
            {form.status === "open" && <div className="rounded-full bg-teal/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-teal">The portal will accept submissions within the configured time window</div>}
          </div>
        </form>

        <div className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-widest text-teal">Verified entries</div><h2 className="mt-2 text-3xl font-bold">Submission review</h2></div><button onClick={load} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Refresh</button></div>

          {state.submissions.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-border bg-card p-12 text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground/50" /><h3 className="mt-4 text-xl font-bold">No entries have been created.</h3><p className="mt-2 text-sm text-muted-foreground">Open the portal and submit a test entry from a student account to verify the full workflow.</p></div>
          ) : (
            <div className="mt-6 space-y-5">{state.submissions.map((submission) => <SubmissionReview key={submission.id} submission={submission} onChanged={load} />)}</div>
          )}
        </div>
      </Section>
    </SiteLayout>
  );
}

function SubmissionReview({ submission, onChanged }: { submission: Submission; onChanged: () => Promise<void> }) {
  const download = useServerFn(getEssaySubmissionDownload);
  const review = useServerFn(reviewEssaySubmission);
  const [status, setStatus] = useState(submission.status === "draft" || submission.status === "withdrawn" ? "submitted" : submission.status);
  const [note, setNote] = useState(submission.admin_note || "");
  const [saving, setSaving] = useState(false);

  async function downloadFile() {
    try {
      const result = await download({ data: { submissionId: submission.id } });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The essay could not be downloaded.");
    }
  }

  async function saveReview() {
    setSaving(true);
    try {
      await review({ data: { submissionId: submission.id, status: status as (typeof REVIEW_STATUSES)[number][0], note } });
      toast.success(`Submission marked ${status.replaceAll("_", " ")}`);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The review could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const inactive = submission.status === "draft" || submission.status === "withdrawn";
  return (
    <article className={cn("rounded-3xl border border-border bg-card p-6 shadow-card", inactive && "opacity-65")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-wide">{submission.status.replaceAll("_", " ")}</span><span className="text-xs text-muted-foreground">{submission.submission_code} · Revision {submission.revision_number}</span></div>
          <h3 className="mt-3 text-xl font-bold">{submission.essay_title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{submission.participant_name}, age {submission.participant_age} · {submission.country}{submission.school_name ? ` · ${submission.school_name}` : ""}</p>
          <p className="mt-1 text-sm text-muted-foreground">Declared word count: {submission.declared_word_count.toLocaleString()} · {submission.original_filename || "No verified file"}</p>
        </div>
        <button onClick={downloadFile} disabled={!submission.original_filename} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-40"><Download className="h-4 w-4" /> Download verified file</button>
      </div>

      {!inactive && (
        <div className="mt-5 grid gap-4 lg:grid-cols-[240px_1fr_auto] lg:items-end">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Review status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal/40">{REVIEW_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <Field label="Private review note" value={note} onChange={setNote} maxLength={2000} />
          <button onClick={saveReview} disabled={saving} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save review</button>
        </div>
      )}
    </article>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><Icon className="h-5 w-5 text-teal" /><div className="mt-3 text-3xl font-bold">{value}</div><div className="text-sm text-muted-foreground">{label}</div></div>;
}

function Field({ label, value, onChange, type = "text", required, maxLength, min, max, placeholder, icon: Icon }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  icon?: React.ElementType;
}) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><div className="relative">{Icon && <Icon className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} maxLength={maxLength} min={min} max={max} placeholder={placeholder} className={cn("w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal/40", Icon && "pl-10")} /></div></label>;
}
