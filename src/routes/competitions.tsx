import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  Scale,
  Trophy,
  Users,
} from "lucide-react";

import { Eyebrow, Section, SiteLayout } from "@/components/SiteLayout";
import { getPublicCompetition } from "@/lib/competition.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/competitions")({
  head: () => ({
    meta: [
      { title: "Inaugural Digital Rights Essay Competition — BraverTogether" },
      {
        name: "description",
        content:
          "BraverTogether's Summer 2026 essay competition for students aged 12–18, focused on sharenting, children's privacy and control over content posted about them online.",
      },
      {
        property: "og:title",
        content: "Inaugural Digital Rights Essay Competition — BraverTogether",
      },
      {
        property: "og:description",
        content:
          "Students aged 12–18 can submit an 800–1,200 word essay on sharenting, children's privacy and digital rights.",
      },
    ],
  }),
  loader: () => getPublicCompetition(),
  component: Competitions,
});

const prompts = [
  "Should minors have a legal right to control — or delete — content their parents post about them, even from before they were old enough to consent? Take a position and defend it.",
  "Where should the line sit between a parent's right to share their own life and a child's right to privacy? Propose a clear rule, and explain who should enforce it.",
  "If you were writing this law yourself, what would count as “too far”? Who should get the final say — parents, platforms, courts, or the kids themselves once they're old enough to weigh in?",
];

const judgingCriteria = [
  ["Originality & Perspective", "A genuine, personal take rather than a generic argument."],
  ["Legal Grounding", "Accurately references real laws, policies, or cases."],
  ["Persuasiveness", "The position is argued clearly and convincingly."],
  ["Writing Quality", "Structure, clarity and grammar."],
  ["Authentic Voice", "Sounds like a real teenager's point of view, not a textbook."],
] as const;

const prizes = [
  ["1st Place", "918.12 AED", "$250 USD"],
  ["2nd Place", "587.60 AED", "$160 USD"],
  ["3rd Place", "293.80 AED", "$80 USD"],
] as const;

function Competitions() {
  const competition = Route.useLoaderData();
  const statusLabel = competition.acceptingSubmissions
    ? "Submissions open"
    : competition.status === "judging"
      ? "Judging in progress"
      : competition.status === "published"
        ? "Results published"
        : competition.status === "closed"
          ? "Submissions closed"
          : "Summer 2026";

  return (
    <SiteLayout>
      <div className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="relative py-20 sm:py-24">
          <Eyebrow>
            <Trophy className="h-3.5 w-3.5" /> {statusLabel}
          </Eyebrow>
          <h1 className="mt-4 max-w-4xl text-5xl font-bold text-navy-deep sm:text-6xl">
            Inaugural Digital Rights Essay Competition
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-navy-deep/70">
            This year's competition asks students to examine “sharenting” — what happens when parents post photos, videos, stories and other details about their children online — and where the law should draw the line between a parent's right to share and a child's right to privacy.
          </p>

          <div className="mt-8 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Detail icon={Users} label="Eligibility" value="Ages 12–18" />
            <Detail icon={FileText} label="Essay length" value="800–1,200 words" />
            <Detail icon={Calendar} label="Deadline" value="August 20, 2026 · 11:59 PM local time" />
            <Detail icon={Trophy} label="Top prize" value="918.12 AED · approx. $250 USD" />
          </div>
        </Section>
      </div>

      <Section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <Eyebrow>This year's prompt</Eyebrow>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Who controls a child's digital footprint?</h2>

          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              Long before you ever posted anything yourself, there's a good chance something about you already existed online. Parents share baby photos, milestone videos, funny stories — even medical details and embarrassing moments — often without ever asking the child involved. It's called “sharenting,” and the law is only just starting to catch up.
            </p>
            <p>
              In 2024, France added children's image rights directly into its Civil Code, letting courts step in when a parent's sharing crosses a line. Illinois, California, Minnesota and Utah have also passed laws requiring parents to set aside earnings when a child is featured in monetized content, and in some cases allowing children to request that old posts come down once they're older. Most places still have no rules on this at all.
            </p>
          </div>

          <div className="mt-8 grid gap-4">
            {prompts.map((prompt, index) => (
              <div key={prompt} className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-7">
                <div className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal/10 text-sm font-bold text-teal">
                    {index + 1}
                  </div>
                  <p className="pt-1 leading-relaxed text-foreground">{prompt}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 rounded-2xl border border-teal/20 bg-teal/5 p-5 leading-relaxed text-muted-foreground">
            Ground your argument in real examples — laws, platform policies, or stories you've seen — and write from your own perspective as someone who grew up in the generation this is actually happening to.
          </p>
        </div>
      </Section>

      <div className="border-y border-border bg-secondary/35">
        <Section className="py-14 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <Eyebrow>Formatting & submission rules</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Prepare your essay correctly.</h2>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <RuleCard title="Writing & length" icon={BookOpen}>
                <ul className="space-y-2">
                  <li>800–1,200 words, not including your Works Cited or source list.</li>
                  <li>Include a title for your essay.</li>
                  <li>Original work only — the essay must be entirely your own writing.</li>
                  <li>One entry per student.</li>
                </ul>
              </RuleCard>

              <RuleCard title="Format & file" icon={FileText}>
                <ul className="space-y-2">
                  <li>Typed in a 12-point standard font such as Times New Roman or Calibri.</li>
                  <li>Double-spaced with 1-inch margins.</li>
                  <li>Submit a Word document (.docx) or PDF (.pdf) only.</li>
                  <li>At the top of page 1, include your full name, age or grade, and school. School is optional.</li>
                </ul>
              </RuleCard>

              <RuleCard title="File naming" icon={FileText}>
                <p>
                  Name your file exactly: <strong className="text-foreground">LastName_FirstName_BraverTogetherEssay2026.pdf</strong> or the same name ending in <strong className="text-foreground">.docx</strong>.
                </p>
                <p className="mt-3">Example: Patel_Kiara_BraverTogetherEssay2026.pdf</p>
                <p className="mt-3">Files that do not follow this pattern may be delayed in judging.</p>
              </RuleCard>

              <RuleCard title="Citations & sources" icon={Scale}>
                <ul className="space-y-2">
                  <li>Cite every law, statistic, case or platform policy you reference.</li>
                  <li>Use MLA 9th edition consistently.</li>
                  <li>You may use in-text parenthetical citations with a Works Cited page, or numbered citations matching a numbered source list.</li>
                  <li>Your Works Cited or source list does not count toward the word limit.</li>
                  <li>Reliable news outlets, government sites, legal databases and platform policy pages are all acceptable sources.</li>
                </ul>
              </RuleCard>
            </div>
          </div>
        </Section>
      </div>

      <Section className="py-14 sm:py-16">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Eyebrow>How you'll be judged</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold">Judging criteria</h2>
            <div className="mt-6 space-y-3">
              {judgingCriteria.map(([title, description]) => (
                <div key={title} className="flex gap-3 rounded-2xl border border-border bg-card p-5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
                  <div>
                    <div className="font-semibold text-foreground">{title}</div>
                    <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Eyebrow>Prizes</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold">Three winning essays.</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              All three winning essays will be published on the BraverTogether website.
            </p>

            <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
              {prizes.map(([place, aed, usd], index) => (
                <div
                  key={place}
                  className={cn(
                    "grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4",
                    index !== prizes.length - 1 && "border-b border-border",
                  )}
                >
                  <div>
                    <div className="font-semibold">{place}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{usd} approx.</div>
                  </div>
                  <div className="font-display text-lg font-bold text-navy-deep">{aed}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <div className="border-y border-border bg-secondary/35">
        <Section className="py-14 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <Eyebrow>Key dates</Eyebrow>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <DateCard label="Competition opens" value="July 31, 2026" />
              <DateCard label="Submission deadline" value="August 20, 2026 · 11:59 PM local time" />
              <DateCard label="Winners announced" value="By August 30, 2026" />
            </div>

            <div className="mt-8 rounded-3xl border border-border bg-card p-7 shadow-card sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8">
              <div>
                <h2 className="text-2xl font-bold">Ready to submit?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Submit your correctly named PDF or DOCX through the BraverTogether submission portal.
                </p>
              </div>
              <Link
                to="/essay-submission"
                className="mt-5 inline-flex shrink-0 items-center gap-2 rounded-full bg-mesh px-6 py-3 font-semibold text-white shadow-glow sm:mt-0"
              >
                <FileText className="h-4 w-4" />
                {competition.acceptingSubmissions ? "Submit your essay" : "Open submission portal"}
              </Link>
            </div>
          </div>
        </Section>
      </div>
    </SiteLayout>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 p-4 backdrop-blur-sm">
      <Icon className="h-4 w-4 text-teal" />
      <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-navy-deep">{value}</div>
    </div>
  );
}

function RuleCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/10 text-teal">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-xl font-bold">{title}</h3>
      <div className="mt-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function DateCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-teal">{label}</div>
      <div className="mt-2 font-semibold text-navy-deep">{value}</div>
    </div>
  );
}
