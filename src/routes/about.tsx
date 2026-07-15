import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { Target, Sparkles, GitBranch } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — BraverTogether" },
      { name: "description", content: "About Tara Vishwakarthik and the mission behind the Digital Legal Literacy Initiative." },
      { property: "og:title", content: "About BraverTogether" },
      { property: "og:description", content: "Why this initiative exists and the gap it fills." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <SiteLayout>
      <div className="bg-hero relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="py-24 relative">
          <Eyebrow>About</Eyebrow>
          <h1 className="mt-4 text-5xl sm:text-6xl font-bold max-w-3xl text-navy-deep">The person behind it — and why it exists.</h1>
        </Section>
      </div>

      <Section>
        <div className="grid lg:grid-cols-[1fr_2fr] gap-12 items-start">
          <div className="lg:sticky lg:top-24">
            <div className="aspect-[4/5] rounded-3xl bg-mesh shadow-card overflow-hidden flex items-end p-8 text-white">
              <div>
                <div className="text-xs uppercase tracking-widest text-teal mb-2">Founder</div>
                <div className="font-display text-3xl font-bold">Tara<br />Vishwakarthik</div>
                <div className="text-sm text-white/70 mt-2">16 · Law, Tech & Policy</div>
              </div>
            </div>
          </div>
          <div>
            <Eyebrow>About the founder</Eyebrow>
            <h2 className="mt-4 text-4xl font-bold">Tara Vishwakarthik</h2>
            <div className="mt-6 space-y-5 text-muted-foreground leading-relaxed">
              <p>Tara Vishwakarthik is a 16-year-old with a serious interest in law — specifically technology law and mergers & acquisitions — alongside international relations and economics. She built this platform because she noticed something straightforward: teens are navigating complex digital environments every single day, and no one is giving them the legal context to do it informed.</p>
              <p>Her interest in how law intersects with technology, global systems, and economic structures is what shaped the foundation of this initiative. She wanted to create something that didn't exist — a resource that meets teens where they are, speaks their language, and gives them real, usable knowledge about their digital rights.</p>
            </div>
          </div>
        </div>
      </Section>

      <div className="bg-secondary/40 border-y border-border">
        <Section>
          <Eyebrow>About the initiative</Eyebrow>
          <h2 className="mt-4 text-4xl sm:text-5xl font-bold max-w-3xl">Why This Exists</h2>

          <div className="mt-12 grid md:grid-cols-3 gap-5">
            {[
              { icon: Target, title: "Our Mission", body: "To make digital legal literacy accessible to every teen — regardless of their background, income, or interest in law — by providing free, clear, and relevant resources on the rights and laws that shape their lives online." },
              { icon: Sparkles, title: "What We Aim to Achieve", body: "Every teen between 12 and 18 should finish using this platform with a working understanding of their digital rights — what data companies can collect, what they're agreeing to, what protections exist, and where to turn when something goes wrong." },
              { icon: GitBranch, title: "The Gap We Fill", body: "Legal resources are written for adults, by adults. Teen-facing content rarely touches law. Meanwhile, digital law is increasingly affecting younger people. This platform sits at that intersection — where currently very little exists." },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <div className="h-10 w-10 rounded-xl bg-teal/15 text-teal flex items-center justify-center mb-4">
                  <c.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-bold mb-3">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </SiteLayout>
  );
}
