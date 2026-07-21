import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, BriefcaseBusiness, Calendar, CheckCircle2, Loader2, MessageCircle, Send, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { AdvisorIntentTrigger } from "@/components/AdvisorIntentDialog";
import { supabase } from "@/integrations/supabase/client";
import { createSupportRequest } from "@/lib/support.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/advisors")({
  head: () => ({
    meta: [
      { title: "Ask an Advisor — BraverTogether" },
      { name: "description", content: "Send a digital-law question to a volunteer advisor and follow the conversation in your private inbox." },
      { property: "og:title", content: "Ask an Advisor — BraverTogether" },
      { property: "og:description", content: "Human-first educational guidance about digital law and online rights." },
    ],
  }),
  component: Advisors,
});

type AdvisorProfile = {
  id: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  focus_areas: string[];
  calendly_url: string | null;
  accepting_messages: boolean;
  availability_status: "available" | "busy" | "offline";
  last_seen_at: string | null;
};

const topics = [
  ["privacy", "Privacy & personal data"],
  ["social-media", "Social media and platform rules"],
  ["contracts", "Terms, subscriptions and online contracts"],
  ["safety", "Online safety, scams or cyberbullying"],
  ["ai", "AI, deepfakes or algorithms"],
  ["copyright", "Copyright and creator rights"],
  ["general", "Something else"],
] as const;

function Advisors() {
  const navigate = useNavigate();
  const createRequest = useServerFn(createSupportRequest);
  const [advisors, setAdvisors] = useState<AdvisorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdvisor, setSelectedAdvisor] = useState<AdvisorProfile | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState<(typeof topics)[number][0]>("general");
  const [message, setMessage] = useState("");
  const [allowAi, setAllowAi] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void supabase.from("profiles")
      .select("id, display_name, headline, bio, focus_areas, calendly_url, accepting_messages, availability_status, last_seen_at")
      .eq("is_advisor", true)
      .eq("is_public", true)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error("Advisor profiles could not be loaded.");
        setAdvisors((data ?? []) as AdvisorProfile[]);
        setLoading(false);
      });
  }, []);

  const availableCount = useMemo(
    () => advisors.filter((advisor) => advisor.accepting_messages && advisor.availability_status === "available").length,
    [advisors],
  );

  function openRequest(advisor: AdvisorProfile | null) {
    setSelectedAdvisor(advisor);
    setFormOpen(true);
    setSubject(advisor ? `Question for ${advisor.display_name}` : "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        await navigate({ to: "/auth" });
        return;
      }
      const result = await createRequest({ data: {
        subject,
        topic,
        message,
        advisorId: selectedAdvisor?.id ?? null,
        allowAiFallback: !selectedAdvisor && allowAi,
      } });
      toast.success(selectedAdvisor ? "Conversation started" : "Your question was sent to the advisor team");
      await navigate({ to: "/messages", search: { c: result.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your question could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SiteLayout>
      <div className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="relative py-24">
          <Eyebrow><MessageCircle className="h-3.5 w-3.5" /> Ask an Advisor</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-5xl font-bold text-navy-deep sm:text-6xl">Get help understanding your digital rights.</h1>
          <p className="mt-6 max-w-2xl text-lg text-navy-deep/70">
            Send a question to a volunteer advisor, receive replies in your private inbox and arrange a meeting when a conversation needs more time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => openRequest(null)} className="inline-flex items-center gap-2 rounded-full bg-mesh px-6 py-3 font-semibold text-white shadow-glow">
              <Send className="h-4 w-4" /> Ask the advisor team
            </button>
            <button onClick={() => navigate({ to: "/messages", search: { c: undefined } })} className="inline-flex items-center gap-2 rounded-full border border-navy/20 bg-white/80 px-6 py-3 font-semibold text-navy-deep">
              <MessageCircle className="h-4 w-4" /> Open my inbox
            </button>
            <AdvisorIntentTrigger className="inline-flex items-center gap-2 rounded-full border border-teal/35 bg-teal/10 px-6 py-3 font-semibold text-teal transition hover:bg-teal/15">
              <UserRoundCheck className="h-4 w-4" /> Become an Advisor
            </AdvisorIntentTrigger>
          </div>
        </Section>
      </div>

      <Section className="py-10">
        <div className="rounded-2xl border-2 border-warn/35 bg-warn/5 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-warn" />
            <div>
              <h2 className="font-display text-2xl font-bold">Educational support, not legal advice.</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Do not share passwords, financial details, addresses, school records, names of other minors or confidential documents. For emergencies, immediate danger or urgent legal deadlines, contact a trusted adult and an appropriate qualified professional.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section className="py-10">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <Eyebrow>Human advisors</Eyebrow>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold sm:text-4xl">Choose an advisor or send your question to the team.</h2>
                <p className="mt-2 text-sm text-muted-foreground">Availability shows whether an advisor is currently able to take new conversations.</p>
              </div>
              <div className={cn("rounded-full px-4 py-2 text-sm font-semibold", availableCount ? "bg-teal/10 text-teal" : "bg-secondary text-muted-foreground")}>
                {availableCount ? `${availableCount} available now` : "The team will reply when available"}
              </div>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {loading ? (
                <div className="col-span-full py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-teal" /></div>
              ) : advisors.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                  <UserRoundCheck className="mx-auto h-9 w-9 text-muted-foreground/50" />
                  <h3 className="mt-4 text-xl font-bold">Questions are still welcome.</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Send your question to the team and it will remain in the queue until an approved advisor responds.</p>
                  <button onClick={() => openRequest(null)} className="mt-5 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white">Submit a question</button>
                </div>
              ) : advisors.map((advisor) => (
                <AdvisorCard key={advisor.id} advisor={advisor} onMessage={() => openRequest(advisor)} />
              ))}
            </div>
          </div>

          <div className="space-y-5 lg:sticky lg:top-24">
            <aside className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/10 text-teal"><BrainCircuit className="h-6 w-6" /></div>
              <h2 className="mt-4 font-display text-2xl font-bold">Help while you wait</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                When no advisor is available, an optional AI helper can explain basic terms, suggest safer wording and help prepare your question for human review. It cannot give legal advice.
              </p>
              <ul className="mt-5 space-y-3 text-sm">
                {["Your question remains in the human queue", "The AI stops once an advisor joins", "Any AI reply is clearly labelled", "A human can review the full conversation"].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" /> {item}</li>)}
              </ul>
              <button onClick={() => openRequest(null)} className="mt-6 w-full rounded-full bg-mesh px-5 py-3 text-sm font-semibold text-white">Start a support request</button>
            </aside>

            <aside className="rounded-3xl border border-border bg-secondary/45 p-6">
              <BriefcaseBusiness className="h-7 w-7 text-teal" />
              <h2 className="mt-3 font-display text-xl font-bold">Volunteer as an advisor</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Law students, researchers, academics and qualified professionals can apply. Every application is reviewed before advisor access is granted.</p>
              <AdvisorIntentTrigger className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-teal/30 bg-card px-5 py-2.5 text-sm font-semibold text-teal hover:border-teal">
                Sign in or join, then apply
              </AdvisorIntentTrigger>
            </aside>
          </div>
        </div>
      </Section>

      {formOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-navy-deep/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setFormOpen(false); }}>
          <form onSubmit={submit} className="mx-auto my-8 max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div><div className="text-xs font-bold uppercase tracking-widest text-teal">New support request</div><h2 className="mt-2 text-2xl font-bold">{selectedAdvisor ? `Message ${selectedAdvisor.display_name}` : "Ask the advisor team"}</h2></div>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-full border border-border px-3 py-1.5 text-sm">Close</button>
            </div>

            <label className="mt-6 block text-sm font-semibold">Subject
              <input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={5} maxLength={120} required className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-teal/30" placeholder="What do you need help understanding?" />
            </label>
            <label className="mt-5 block text-sm font-semibold">Topic
              <select value={topic} onChange={(event) => setTopic(event.target.value as typeof topic)} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-teal/30">
                {topics.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="mt-5 block text-sm font-semibold">Your question
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={4000} required rows={7} className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 font-normal leading-relaxed outline-none focus:ring-2 focus:ring-teal/30" placeholder="Give enough context to understand the issue, but remove names and private information." />
              <span className="mt-1 block text-right text-xs font-normal text-muted-foreground">{message.length}/4000</span>
            </label>

            {!selectedAdvisor && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-4">
                <input type="checkbox" checked={allowAi} onChange={(event) => setAllowAi(event.target.checked)} className="mt-1" />
                <span><span className="block text-sm font-semibold">Allow the limited AI helper while waiting</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">The option only appears when no advisor is available, and your request stays in the human queue.</span></span>
              </label>
            )}

            <button type="submit" disabled={submitting || subject.trim().length < 5 || message.trim().length < 10} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-mesh px-6 py-3 font-semibold text-white disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Submitting…" : "Send question"}
            </button>
          </form>
        </div>
      )}
    </SiteLayout>
  );
}

function AdvisorCard({ advisor, onMessage }: { advisor: AdvisorProfile; onMessage: () => void }) {
  const status = advisor.availability_status;
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5 transition hover:border-teal/40 hover:shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mesh font-display font-bold text-white">{advisor.display_name?.[0]?.toUpperCase() || "A"}</div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-bold">{advisor.display_name}</h3>
          <p className="truncate text-xs text-muted-foreground">{advisor.headline || "Volunteer digital-law advisor"}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className={cn("h-2 w-2 rounded-full", status === "available" ? "bg-teal" : status === "busy" ? "bg-warn" : "bg-muted-foreground/40")} />
            <span className="capitalize text-muted-foreground">{status}</span>
          </div>
        </div>
      </div>
      {advisor.bio && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{advisor.bio}</p>}
      {advisor.focus_areas?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{advisor.focus_areas.slice(0, 4).map((focus) => <span key={focus} className="rounded-full bg-teal/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal">{focus}</span>)}</div>}
      <div className="mt-auto flex gap-2 pt-5">
        <button onClick={onMessage} disabled={!advisor.accepting_messages} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-navy px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><MessageCircle className="h-3.5 w-3.5" /> Message</button>
        {advisor.calendly_url && <a href={advisor.calendly_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full border border-border px-3 text-muted-foreground hover:text-foreground" title="Open booking page"><Calendar className="h-4 w-4" /></a>}
      </div>
    </article>
  );
}
