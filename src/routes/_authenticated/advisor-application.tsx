import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { getAdvisorPortalState, submitAdvisorApplication } from "@/lib/advisor-application.functions";
import { cn } from "@/lib/utils";

type ApplicationStatus = "pending" | "more_info" | "approved" | "denied";

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

export const Route = createFileRoute("/_authenticated/advisor-application")({
  component: AdvisorApplicationPage,
});

function AdvisorApplicationPage() {
  const getPortalState = useServerFn(getAdvisorPortalState);
  const submitApplication = useServerFn(submitAdvisorApplication);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<ExistingApplication | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdvisor, setIsAdvisor] = useState(false);
  const [editing, setEditing] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [{ data: auth }, state] = await Promise.all([supabase.auth.getUser(), getPortalState()]);
      const existing = state.application as ExistingApplication | null;
      setApplication(existing);
      setIsAdmin(state.isAdmin);
      setIsAdvisor(state.isAdvisor);
      setEditing(!existing || existing.status === "more_info" || existing.status === "denied");
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const focusAreas = Array.from(new Set(form.focusAreas.split(",").map((area) => area.trim()).filter(Boolean)));
      const result = await submitApplication({ data: {
        fullName: form.fullName,
        email: form.email,
        organization: form.organization,
        roleTitle: form.roleTitle,
        location: form.location,
        experience: form.experience,
        motivation: form.motivation,
        focusAreas,
        profileUrl: form.profileUrl,
        availabilityNote: form.availabilityNote,
      } });
      toast.success("Application submitted for review");
      setEditing(false);
      setApplication((current) => current ? { ...current, status: result.status, submitted_at: result.submitted_at, admin_note: null } : null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your application could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <SiteLayout><Section className="py-24 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-teal" /></Section></SiteLayout>;
  }

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
        ) : application && !editing ? (
          <div className="mx-auto max-w-3xl space-y-5">
            <StatusPanel status={application.status} note={application.admin_note} />
            {(application.status === "more_info" || application.status === "denied") && (
              <button onClick={() => setEditing(true)} className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white">Update and resubmit</button>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
            {application && <StatusPanel status={application.status} note={application.admin_note} compact />}

            <div className="grid gap-5 rounded-3xl border border-border bg-card p-6 shadow-card sm:grid-cols-2 sm:p-8">
              <Field label="Full name" value={form.fullName} onChange={(value) => setForm((current) => ({ ...current, fullName: value }))} required maxLength={100} />
              <Field label="Email address" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} required maxLength={200} />
              <Field label="Organisation or institution" value={form.organization} onChange={(value) => setForm((current) => ({ ...current, organization: value }))} maxLength={160} />
              <Field label="Current role or course" value={form.roleTitle} onChange={(value) => setForm((current) => ({ ...current, roleTitle: value }))} maxLength={120} />
              <Field label="Location and time zone" value={form.location} onChange={(value) => setForm((current) => ({ ...current, location: value }))} maxLength={120} />
              <Field label="Professional or university profile" type="url" placeholder="https://…" value={form.profileUrl} onChange={(value) => setForm((current) => ({ ...current, profileUrl: value }))} maxLength={500} />
              <div className="sm:col-span-2"><Field label="Focus areas (comma-separated)" value={form.focusAreas} onChange={(value) => setForm((current) => ({ ...current, focusAreas: value }))} placeholder="Privacy, online safety, copyright" required maxLength={600} /></div>
              <div className="sm:col-span-2"><Field label="Relevant education and experience" textarea value={form.experience} onChange={(value) => setForm((current) => ({ ...current, experience: value }))} placeholder="Describe the experience that would help you answer educational questions responsibly." required minLength={40} maxLength={3000} /></div>
              <div className="sm:col-span-2"><Field label="Why would you like to volunteer?" textarea value={form.motivation} onChange={(value) => setForm((current) => ({ ...current, motivation: value }))} required minLength={40} maxLength={3000} /></div>
              <div className="sm:col-span-2"><Field label="Typical availability" textarea value={form.availabilityNote} onChange={(value) => setForm((current) => ({ ...current, availabilityNote: value }))} placeholder="For example: weekday evenings, Gulf Standard Time" maxLength={500} /></div>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/50 p-5 text-sm leading-relaxed text-muted-foreground">
              By applying, you confirm that the information is accurate and that you understand BraverTogether provides educational information rather than legal representation. Approval may require a follow-up conversation or identity and background checks appropriate to the role.
            </div>

            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-mesh px-7 py-3 font-semibold text-white shadow-glow disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{application ? "Resubmit application" : "Submit application"}
            </button>
          </form>
        )}
      </Section>
    </SiteLayout>
  );
}

function StatusPanel({ status, note, compact = false }: { status: ApplicationStatus; note?: string | null; compact?: boolean }) {
  const details = {
    pending: { icon: Clock3, title: "Application under review", description: "Your application has been received. You can continue using BraverTogether while the team reviews it.", className: "border-warn/30 bg-warn/5 text-warn" },
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

function Field({ label, value, onChange, type = "text", placeholder, required, textarea, minLength, maxLength }: {
  label: string; value: string; onChange: (value: string) => void; type?: React.HTMLInputTypeAttribute; placeholder?: string; required?: boolean; textarea?: boolean; minLength?: number; maxLength?: number;
}) {
  const className = "mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-teal/35";
  return <label className="block text-sm font-semibold">{label}{textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} minLength={minLength} maxLength={maxLength} rows={6} className={className} /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} minLength={minLength} maxLength={maxLength} className={className} />}</label>;
}
