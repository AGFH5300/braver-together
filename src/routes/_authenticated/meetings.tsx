import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CalendarPlus, Check, ExternalLink, Loader2, Video, X } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { roleHome, type EffectiveAccountRole } from "@/lib/account-access";
import { getAccountAccessState } from "@/lib/account-access.functions";
import { createMeetingProposal, listMeetingProposals, respondMeetingProposal } from "@/lib/meeting.functions";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  subject: string;
  teen_id: string;
  advisor_id: string | null;
  status: string;
};

type Proposal = {
  id: string;
  conversation_id: string;
  proposer_id: string;
  proposed_start: string;
  duration_minutes: number;
  timezone: string;
  title: string;
  note: string | null;
  meeting_url: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

export const Route = createFileRoute("/_authenticated/meetings")({
  component: MeetingsPage,
});

function MeetingsPage() {
  const navigate = useNavigate();
  const getAccess = useServerFn(getAccountAccessState);
  const createProposal = useServerFn(createMeetingProposal);
  const listProposals = useServerFn(listMeetingProposals);
  const respond = useServerFn(respondMeetingProposal);
  const [me, setMe] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [accountRole, setAccountRole] = useState<EffectiveAccountRole>("member");
  const [dateTime, setDateTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [title, setTitle] = useState("BraverTogether advisor meeting");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [note, setNote] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  useEffect(() => { void initialize(); }, []);

  useEffect(() => {
    if (!selectedId) {
      setProposals([]);
      return;
    }
    void loadProposals(selectedId);
    const channel = supabase.channel(`meetings-${selectedId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_proposals", filter: `conversation_id=eq.${selectedId}` }, () => void loadProposals(selectedId))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selectedId]);

  async function initialize() {
    setLoading(true);
    try {
      const [{ data: auth, error: authError }, access] = await Promise.all([
        supabase.auth.getUser(),
        getAccess(),
      ]);
      if (authError) throw authError;
      if (!auth.user) throw new Error("Please sign in again.");
      if (access.role !== "member" && access.role !== "advisor") {
        await navigate({ to: roleHome(access.role), replace: true });
        return;
      }
      setAccountRole(access.role);
      setMe(auth.user.id);

      const { data, error } = await supabase
        .from("conversations")
        .select("id, subject, teen_id, advisor_id, status")
        .not("advisor_id", "is", null)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Conversation[];
      setConversations(rows);
      setSelectedId((current) => current || rows[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Meetings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProposals(conversationId: string) {
    setLoadingProposals(true);
    try {
      const data = await listProposals({ data: { conversationId } });
      setProposals(data as Proposal[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Meeting proposals could not be loaded.");
    } finally {
      setLoadingProposals(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !dateTime) return;
    setSubmitting(true);
    try {
      await createProposal({ data: {
        conversationId: selectedId,
        proposedStart: new Date(dateTime).toISOString(),
        durationMinutes: duration,
        timezone,
        title,
        note,
        meetingUrl,
      } });
      toast.success("Meeting proposed");
      setFormOpen(false);
      setDateTime("");
      setMeetingUrl("");
      setNote("");
      await loadProposals(selectedId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The meeting could not be proposed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function answer(proposal: Proposal, action: "accepted" | "declined" | "cancelled") {
    setResponding(`${proposal.id}:${action}`);
    try {
      await respond({ data: { proposalId: proposal.id, action } });
      toast.success(action === "accepted" ? "Meeting accepted" : action === "declined" ? "Meeting declined" : "Meeting cancelled");
      await loadProposals(selectedId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The meeting could not be updated.");
    } finally {
      setResponding(null);
    }
  }

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const upcoming = useMemo(() => proposals.filter((proposal) => proposal.status === "accepted" && Date.parse(proposal.proposed_start) >= Date.now()).sort((a, b) => Date.parse(a.proposed_start) - Date.parse(b.proposed_start)), [proposals]);
  const history = useMemo(() => proposals.filter((proposal) => !upcoming.some((item) => item.id === proposal.id)), [proposals, upcoming]);

  return (
    <SiteLayout>
      <div className="bg-hero"><Section className="py-14"><Eyebrow><CalendarCheck2 className="h-3.5 w-3.5" /> {accountRole === "advisor" ? "Advisor meetings" : "My meetings"}</Eyebrow><h1 className="mt-3 text-4xl font-bold text-navy-deep">{accountRole === "advisor" ? "Meetings with assigned members" : "Meetings with your advisor"}</h1><p className="mt-2 max-w-2xl text-navy-deep/70">Propose a time and secure meeting link, wait for the other person to accept, then add the confirmed meeting to your calendar.</p></Section></div>

      <Section className="py-10">
        {loading ? <div className="py-20 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-teal" /></div> : conversations.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-border bg-card p-10 text-center"><CalendarPlus className="mx-auto h-10 w-10 text-muted-foreground/40" /><h2 className="mt-4 text-2xl font-bold">No advisor conversations are ready for meetings.</h2><p className="mt-2 text-sm text-muted-foreground">A meeting can be proposed after a human advisor joins one of your conversations.</p></div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <aside className="rounded-2xl border border-border bg-card p-3">
              <div className="px-3 pb-3 pt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Conversation</div>
              {conversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={cn("w-full rounded-xl px-4 py-3 text-left text-sm transition", selectedId === conversation.id ? "bg-navy text-white" : "hover:bg-secondary")}><div className="font-semibold">{conversation.subject}</div><div className={cn("mt-1 text-xs", selectedId === conversation.id ? "text-white/65" : "text-muted-foreground")}>{conversation.status === "open" ? "Active conversation" : "Closed conversation"}</div></button>)}
            </aside>

            <main className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5"><div><div className="text-xs font-bold uppercase tracking-widest text-teal">Selected conversation</div><h2 className="mt-1 text-xl font-bold">{selected?.subject}</h2></div><button onClick={() => setFormOpen(true)} disabled={selected?.status !== "open"} className="inline-flex items-center gap-2 rounded-full bg-mesh px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><CalendarPlus className="h-4 w-4" /> Propose a meeting</button></div>

              {loadingProposals ? <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-teal" /></div> : (
                <>
                  <MeetingSection title="Confirmed upcoming meetings" empty="No confirmed meetings yet." proposals={upcoming} me={me} responding={responding} onAnswer={answer} />
                  <MeetingSection title="Proposals and history" empty="No meeting proposals yet." proposals={history} me={me} responding={responding} onAnswer={answer} />
                </>
              )}
            </main>
          </div>
        )}
      </Section>

      {formOpen && selected && (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-navy-deep/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setFormOpen(false); }}>
          <form onSubmit={submit} className="mx-auto my-8 max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-widest text-teal">Meeting proposal</div><h2 className="mt-2 text-2xl font-bold">Choose a time and link</h2></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-full border border-border px-3 py-1.5 text-sm">Close</button></div>
            <label className="mt-6 block text-sm font-semibold">Date and time<input type="datetime-local" value={dateTime} onChange={(event) => setDateTime(event.target.value)} required className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-teal/35" /></label>
            <div className="mt-2 text-xs text-muted-foreground">Time zone: {timezone}</div>
            <label className="mt-5 block text-sm font-semibold">Duration<select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal"><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select></label>
            <label className="mt-5 block text-sm font-semibold">Meeting title<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-teal/35" /></label>
            <label className="mt-5 block text-sm font-semibold">Meeting link<input type="url" value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} placeholder="https://meet.google.com/… or another secure HTTPS link" maxLength={500} required className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-teal/35" /></label>
            <label className="mt-5 block text-sm font-semibold">Optional note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={1000} placeholder="Add an agenda or anything the other person should prepare." className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-teal/35" /></label>
            <p className="mt-4 rounded-xl bg-secondary/50 p-4 text-xs leading-relaxed text-muted-foreground">The other participant must accept before the meeting is treated as confirmed. Do not place passwords or confidential information in the meeting link or note.</p>
            <button type="submit" disabled={submitting || !dateTime || !meetingUrl.trim()} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-mesh px-6 py-3 font-semibold text-white disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}{submitting ? "Sending…" : "Send proposal"}</button>
          </form>
        </div>
      )}
    </SiteLayout>
  );
}

function MeetingSection({ title, empty, proposals, me, responding, onAnswer }: { title: string; empty: string; proposals: Proposal[]; me: string | null; responding: string | null; onAnswer: (proposal: Proposal, action: "accepted" | "declined" | "cancelled") => Promise<void> }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="font-display text-xl font-bold">{title}</h2>{proposals.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{empty}</p> : <div className="mt-4 space-y-4">{proposals.map((proposal) => <MeetingCard key={proposal.id} proposal={proposal} me={me} responding={responding} onAnswer={onAnswer} />)}</div>}</section>
  );
}

function MeetingCard({ proposal, me, responding, onAnswer }: { proposal: Proposal; me: string | null; responding: string | null; onAnswer: (proposal: Proposal, action: "accepted" | "declined" | "cancelled") => Promise<void> }) {
  const start = new Date(proposal.proposed_start);
  const end = new Date(start.getTime() + proposal.duration_minutes * 60_000);
  const mine = proposal.proposer_id === me;
  return (
    <article className="rounded-2xl border border-border bg-secondary/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-semibold">{proposal.title}</h3><StatusBadge status={proposal.status} /></div><div className="mt-2 text-sm text-muted-foreground">{start.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · {proposal.duration_minutes} minutes</div><div className="mt-1 text-xs text-muted-foreground">Proposed in {proposal.timezone}</div></div>{proposal.status === "accepted" && <a href={proposal.meeting_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white"><Video className="h-4 w-4" /> Join meeting</a>}</div>
      {proposal.note && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{proposal.note}</p>}

      {proposal.status === "pending" && <div className="mt-4 flex flex-wrap gap-2">{mine ? <button onClick={() => onAnswer(proposal, "cancelled")} disabled={Boolean(responding)} className="inline-flex items-center gap-2 rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-50">{responding === `${proposal.id}:cancelled` ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}Cancel proposal</button> : <><button onClick={() => onAnswer(proposal, "accepted")} disabled={Boolean(responding)} className="inline-flex items-center gap-2 rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{responding === `${proposal.id}:accepted` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Accept</button><button onClick={() => onAnswer(proposal, "declined")} disabled={Boolean(responding)} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">Decline</button></>}</div>}

      {proposal.status === "accepted" && <div className="mt-4 flex flex-wrap gap-2"><a href={googleCalendarUrl(proposal, start, end)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold">Google Calendar <ExternalLink className="h-3.5 w-3.5" /></a><a href={outlookCalendarUrl(proposal, start, end)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold">Outlook <ExternalLink className="h-3.5 w-3.5" /></a><button onClick={() => downloadIcs(proposal, start, end)} className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold">Download calendar file</button></div>}
    </article>
  );
}

function StatusBadge({ status }: { status: Proposal["status"] }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", status === "accepted" ? "bg-teal/10 text-teal" : status === "declined" || status === "cancelled" ? "bg-secondary text-muted-foreground" : "bg-warn/10 text-warn")}>{status}</span>;
}

function calendarDescription(proposal: Proposal) {
  return [proposal.note, `Meeting link: ${proposal.meeting_url}`, "BraverTogether educational advisor meeting"].filter(Boolean).join("\n\n");
}

function compactUtc(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function googleCalendarUrl(proposal: Proposal, start: Date, end: Date) {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", proposal.title);
  url.searchParams.set("dates", `${compactUtc(start)}/${compactUtc(end)}`);
  url.searchParams.set("details", calendarDescription(proposal));
  url.searchParams.set("location", proposal.meeting_url);
  return url.toString();
}

function outlookCalendarUrl(proposal: Proposal, start: Date, end: Date) {
  const url = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
  url.searchParams.set("path", "/calendar/action/compose");
  url.searchParams.set("rru", "addevent");
  url.searchParams.set("subject", proposal.title);
  url.searchParams.set("startdt", start.toISOString());
  url.searchParams.set("enddt", end.toISOString());
  url.searchParams.set("body", calendarDescription(proposal));
  url.searchParams.set("location", proposal.meeting_url);
  return url.toString();
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function downloadIcs(proposal: Proposal, start: Date, end: Date) {
  const content = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BraverTogether//Meeting//EN", "BEGIN:VEVENT", `UID:${proposal.id}@bravertogether`, `DTSTAMP:${compactUtc(new Date())}`, `DTSTART:${compactUtc(start)}`, `DTEND:${compactUtc(end)}`, `SUMMARY:${escapeIcs(proposal.title)}`, `DESCRIPTION:${escapeIcs(calendarDescription(proposal))}`, `LOCATION:${escapeIcs(proposal.meeting_url)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "bravertogether-meeting.ics";
  anchor.click();
  URL.revokeObjectURL(url);
}
