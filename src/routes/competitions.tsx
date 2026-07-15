import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { Trophy, Calendar, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/competitions")({
  head: () => ({
    meta: [
      { title: "Competitions — BraverTogether" },
      { name: "description", content: "Essay competitions and events focused on digital rights — with cash prizes and recognition for teen participants." },
      { property: "og:title", content: "Competitions — BraverTogether" },
      { property: "og:description", content: "Put your knowledge to work. Current and upcoming competitions." },
    ],
  }),
  component: Competitions,
});

function Competitions() {
  return (
    <SiteLayout>
      <div className="bg-hero relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="py-24 relative">
          <Eyebrow>Competitions & Events</Eyebrow>
          <h1 className="mt-4 text-5xl sm:text-6xl font-bold max-w-3xl text-navy-deep">Put your knowledge to work.</h1>
          <p className="mt-6 text-navy-deep/70 max-w-2xl text-lg">
            Engage with digital rights topics, write your perspective, and get recognised — sometimes with cash prizes attached.
          </p>
        </Section>
      </div>

      <Section>
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-8 shadow-card relative overflow-hidden">
            <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-teal/20 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-teal/15 text-teal px-3 py-1 text-xs font-semibold uppercase tracking-widest mb-4">
                <Sparkles className="h-3 w-3" /> Featured
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3">Inaugural Digital Rights Essay Competition</h2>
              <p className="text-muted-foreground mb-6 max-w-xl">
                Write a teen-perspective essay on a digital rights topic of your choice. Winners receive a cash prize and have their work published on the platform.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 mb-8">
                {[
                  { icon: Trophy, l: "Cash Prize", v: "TBD" },
                  { icon: Calendar, l: "Dates", v: "TBD" },
                  { icon: Users, l: "Open to", v: "Ages 12–18" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl border border-border p-3 flex items-center gap-3">
                    <s.icon className="h-4 w-4 text-teal" />
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
                      <div className="text-sm font-semibold">{s.v}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="inline-flex items-center gap-2 rounded-full bg-navy text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition">
                Notify me when applications open
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-8 flex flex-col items-start">
            <Calendar className="h-6 w-6 text-teal mb-3" />
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Community Events</div>
            <h3 className="font-display text-2xl font-bold mb-2">Coming up soon…</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Workshops, Q&As with advisors, and community discussions are in the works. Check back as we announce new events.
            </p>
            <div className="text-xs text-muted-foreground italic">No live events scheduled yet.</div>
          </div>
        </div>
      </Section>

      <div className="bg-secondary/40 border-y border-border">
        <Section>
          <div className="max-w-3xl">
            <Eyebrow>Past competitions</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold">Nothing yet — you could be in the first cohort.</h2>
            <p className="mt-4 text-muted-foreground">
              The essay competition is our inaugural event. Winning entries will be archived here for future participants to read.
            </p>
          </div>
        </Section>
      </div>
    </SiteLayout>
  );
}
