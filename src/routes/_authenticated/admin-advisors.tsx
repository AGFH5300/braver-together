import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Mail, ShieldX, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { listAdvisorApplications, reviewAdvisorApplication } from "@/lib/advisor-application.functions";
import { cn } from "@/lib/utils";

type Status = "pending" | "more_info" | "approved" | "denied";
type Application = {
  id: string;
  user_id: string;
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
  status: Status;
  admin_note: string | null;
  submitted_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

export const Route = createFileRoute("/_authenticated/admin-advisors")({
  component: AdminAdvisorsPage,
});

const filters: Array<["all" | Status, string]> = [["all", "All"], ["pending", "Pending"], ["more_info", "More information"], ["approved", "Approved"], ["denied", "Denied"]];

function AdminAdvisorsPage() {
  const listApplications = useServerFn(listAdvisorApplications);
  const reviewApplication = useServerFn(reviewAdvisorApplication);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("pending");
  const [selected, setSelected] = useState<Application | null>(null);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState<Status | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await listApplications();
      setApplications(data as Application[]);
      if (selected) setSelected((data as Application[]).find((item) => item.id === selected.id) ?? null);
      setAccessError(null);
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "This page could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  const visible = useMemo(() => filter === "all" ? applications : applications.filter((application) => application.status === filter), [applications, filter]);
  const counts = useMemo(() => Object.fromEntries(filters.map(([value]) => [value, value === "all" ? applications.length : applications.filter((application) => application.status === value).length])), [applications]);

  async function review(decision: "approved" | "denied" | "more_info") {
    if (!selected) return;
    if ((decision === "denied" || decision === "more_info") && note.trim().length < 5) {
      toast.error("Add a clear review note before continuing.");
      return;
    }
    setReviewing(decision);
    try {
      await reviewApplication({ data: { applicationId: selected.id, decision, note } });
      toast.success(decision === "approved" ? "Advisor account approved" : decision === "more_info" ? "Information requested" : "Application denied");
      setNote("");
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The review could not be saved.");
    } finally {
      setReviewing(null);
    }
  }

  if (loading) return <SiteLayout><Section className="py-24 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-teal" /></Section></SiteLayout>;

  if (accessError) {
    return <SiteLayout><Section className="py-24"><div className="mx-auto max-w-xl rounded-3xl border border-danger/25 bg-danger/5 p-8 text-center"><ShieldX className="mx-auto h-10 w-10 text-danger" /><h1 className="mt-4 text-2xl font-bold">Administrator access required</h1><p className="mt-2 text-sm text-muted-foreground">{accessError}</p></div></Section></SiteLayout>;
  }

  return (
    <SiteLayout>
      <div className="bg-hero"><Section className="py-14"><Eyebrow><UserRoundSearch className="h-3.5 w-3.5" /> Admin review</Eyebrow><h1 className="mt-3 text-4xl font-bold text-navy-deep">Advisor applications</h1><p className="mt-2 max-w-2xl text-navy-deep/70">Review applications, contact candidates and record each decision.</p></Section></div>
      <Section className="py-10">
        <div className="flex flex-wrap gap-2">
          {filters.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={cn("rounded-full border px-4 py-2 text-sm font-semibold", filter === value ? "border-navy bg-navy text-white" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{label} <span className="ml-1 opacity-70">{counts[value]}</span></button>)}
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="overflow-hidden rounded-2xl border border-border bg-card">
            {visible.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No applications in this category.</div> : visible.map((application) => (
              <button key={application.id} onClick={() => { setSelected(application); setNote(application.admin_note ?? ""); }} className={cn("w-full border-b border-border p-4 text-left transition hover:bg-secondary/60", selected?.id === application.id && "bg-secondary")}> 
                <div className="flex items-start justify-between gap-2"><div className="font-semibold">{application.full_name}</div><StatusBadge status={application.status} /></div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{application.role_title || application.organization || application.email}</div>
                <div className="mt-2 text-[10px] text-muted-foreground">Submitted {new Date(application.submitted_at).toLocaleDateString()}</div>
              </button>
            ))}
          </aside>

          <main className="min-h-[520px] rounded-2xl border border-border bg-card p-6 sm:p-8">
            {!selected ? <div className="flex min-h-[430px] flex-col items-center justify-center text-center text-muted-foreground"><UserRoundSearch className="h-11 w-11 opacity-35" /><div className="mt-3 font-semibold text-foreground">Choose an application</div><div className="mt-1 text-sm">Full details and review actions will appear here.</div></div> : (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="font-display text-3xl font-bold">{selected.full_name}</h2><StatusBadge status={selected.status} /></div><p className="mt-1 text-sm text-muted-foreground">{[selected.role_title, selected.organization, selected.location].filter(Boolean).join(" · ")}</p></div><div className="flex gap-2"><a href={`mailto:${selected.email}?subject=BraverTogether%20Advisor%20Application`} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold"><Mail className="h-4 w-4" /> Contact</a>{selected.profile_url && <a href={selected.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold">Profile <ExternalLink className="h-4 w-4" /></a>}</div></div>

                <div className="mt-7 grid gap-5 md:grid-cols-2"><Detail title="Email" value={selected.email} /><Detail title="Focus areas" value={selected.focus_areas.join(", ")} /><div className="md:col-span-2"><Detail title="Education and experience" value={selected.experience} /></div><div className="md:col-span-2"><Detail title="Motivation" value={selected.motivation} /></div>{selected.availability_note && <div className="md:col-span-2"><Detail title="Availability" value={selected.availability_note} /></div>}</div>

                <label className="mt-7 block text-sm font-semibold">Review note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} maxLength={2000} placeholder="Explain the decision or ask a specific follow-up question." className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-teal/35" /></label>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button onClick={() => review("approved")} disabled={Boolean(reviewing)} className="inline-flex items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{reviewing === "approved" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Approve</button>
                  <button onClick={() => review("more_info")} disabled={Boolean(reviewing)} className="rounded-full border border-warn/40 bg-warn/5 px-5 py-2.5 text-sm font-semibold text-warn disabled:opacity-50">Request more information</button>
                  <button onClick={() => review("denied")} disabled={Boolean(reviewing)} className="rounded-full border border-danger/40 bg-danger/5 px-5 py-2.5 text-sm font-semibold text-danger disabled:opacity-50">Deny</button>
                </div>
              </div>
            )}
          </main>
        </div>
      </Section>
    </SiteLayout>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const label = status === "more_info" ? "More info" : status[0].toUpperCase() + status.slice(1);
  return <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", status === "approved" ? "bg-teal/10 text-teal" : status === "denied" ? "bg-danger/10 text-danger" : status === "more_info" ? "bg-warn/10 text-warn" : "bg-secondary text-muted-foreground")}>{label}</span>;
}

function Detail({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border border-border bg-secondary/35 p-4"><div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</div><div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{value || "—"}</div></div>;
}
