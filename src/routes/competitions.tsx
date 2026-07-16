import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, FileText, Sparkles, Trophy, Users } from "lucide-react";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { getPublicCompetition } from "@/lib/competition.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/competitions")({
  head: () => ({
    meta: [
      { title: "Essay Competition — BraverTogether" },
      { name: "description", content: "The BraverTogether digital-rights essay competition for students aged 12–18." },
      { property: "og:title", content: "BraverTogether Digital Rights Essay Competition" },
      { property: "og:description", content: "Research a digital-rights issue, develop your perspective and submit an original essay." },
    ],
  }),
  loader: () => getPublicCompetition(),
  component: Competitions,
});

function Competitions() {
  const competition = Route.useLoaderData();
  const statusLabel = competition.acceptingSubmissions
    ? "Submissions open"
    : competition.status === "draft" ? "Details coming soon" : competition.status === "judging" ? "Judging in progress" : competition.status === "published" ? "Results published" : "Submissions closed";

  return (
    <SiteLayout>
      <div className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="relative py-24">
          <Eyebrow><Sparkles className="h-3.5 w-3.5" /> Our flagship programme</Eyebrow>
          <h1 className="mt-4 max-w-4xl text-5xl font-bold text-navy-deep sm:text-6xl">The BraverTogether Digital Rights Essay Competition.</h1>
          <p className="mt-6 max-w-2xl text-lg text-navy-deep/70">Research an issue shaping young people online, build a clear argument and contribute your own perspective to the digital-rights conversation.</p>
        </Section>
      </div>

      <Section className="py-12">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <article className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-card sm:p-10">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal/20 blur-3xl" />
            <div className="relative">
              <div className={cn("inline-flex rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest", competition.acceptingSubmissions ? "bg-teal/10 text-teal" : "bg-secondary text-muted-foreground")}>{statusLabel}</div>
              <h2 className="mt-5 font-display text-3xl font-bold sm:text-4xl">{competition.title}</h2>
              <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">{competition.summary}</p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Detail icon={Users} label="Eligibility" value={`Ages ${competition.minimum_age}–${competition.maximum_age}`} />
                <Detail icon={FileText} label="Word count" value={wordRange(competition.minimum_words, competition.maximum_words)} />
                <Detail icon={Calendar} label="Deadline" value={competition.closes_at ? new Date(competition.closes_at).toLocaleString() : "To be announced"} />
                <Detail icon={Trophy} label="Prize" value={competition.prize_text || "To be announced"} />
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/essay-submission" className="inline-flex items-center gap-2 rounded-full bg-mesh px-6 py-3 font-semibold text-white shadow-glow">
                  <FileText className="h-4 w-4" /> {competition.acceptingSubmissions ? "Submit your essay" : "Open submission portal"}
                </Link>
                {competition.rules_url && <a href={competition.rules_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-border px-6 py-3 font-semibold">Read competition rules</a>}
              </div>
            </div>
          </article>

          <aside className="rounded-3xl border border-border bg-secondary/40 p-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/10 text-teal"><FileText className="h-6 w-6" /></div>
            <h2 className="mt-5 font-display text-2xl font-bold">What the portal provides</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li>A private PDF or DOCX upload for signed-in student accounts.</li>
              <li>File-type, size, header and integrity verification.</li>
              <li>A permanent submission reference and revision number.</li>
              <li>The ability to replace or withdraw an entry before the deadline.</li>
            </ul>
          </aside>
        </div>
      </Section>

      <div className="border-y border-border bg-secondary/40">
        <Section>
          <div className="max-w-3xl">
            <Eyebrow>Winning work</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold">The first collection will be published after judging.</h2>
            <p className="mt-4 text-muted-foreground">Selected entries will be presented here so future participants can learn from strong research, clear reasoning and distinctive student perspectives.</p>
          </div>
        </Section>
      </div>
    </SiteLayout>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-background/70 p-4"><Icon className="h-4 w-4 text-teal" /><div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></div>;
}

function wordRange(minimum: number | null, maximum: number | null) {
  if (minimum && maximum) return `${minimum.toLocaleString()}–${maximum.toLocaleString()} words`;
  if (minimum) return `At least ${minimum.toLocaleString()} words`;
  if (maximum) return `Up to ${maximum.toLocaleString()} words`;
  return "To be announced";
}
