import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Newspaper, FileSearch, MessageCircle, Trophy, Users, Sparkles, ShieldCheck, Lock, Scale } from "lucide-react";
import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BraverTogether — Know Your Rights Online" },
      { name: "description", content: "The internet has rules — and most teens never get taught them. We're changing that. Digital legal literacy for teens aged 12–18." },
      { property: "og:title", content: "BraverTogether — Know Your Rights Online" },
      { property: "og:description", content: "Plain-English digital rights, laws and protections for teens." },
    ],
  }),
  component: Home,
});

const offerings = [
  { icon: Users, title: "About", desc: "Meet Tara and learn the mission behind a platform built so teens can finally access digital legal knowledge.", cta: "Meet Tara & Our Mission", to: "/about" as const },
  { icon: BookOpen, title: "Resources", desc: "A growing library of guides and PDFs on privacy, social media law, digital contracts, cyberbullying and more.", cta: "Explore the Resource Library", to: "/resources" as const },
  { icon: Newspaper, title: "Latest News", desc: "Real legal developments — from Instagram encryption to new data privacy laws — broken down for real teens.", cta: "Read the Latest", to: "/news" as const },
  { icon: FileSearch, title: "Contract Decoder", desc: "Paste any Terms & Conditions, privacy policy, or digital agreement. Get back exactly what you're signing up for.", cta: "Try the Contract Decoder", to: "/decoder" as const },
  { icon: MessageCircle, title: "Ask an Advisor", desc: "Connect with law students and professors volunteering their time. Free, informational, judgment-free.", cta: "Talk to an Advisor", to: "/advisors" as const },
  { icon: Trophy, title: "Competitions", desc: "Essay competitions with cash prizes and other ways to engage with digital rights and get recognised.", cta: "See Competitions", to: "/competitions" as const },
];

function Home() {
  return (
    <SiteLayout>
      {/* HERO */}
      <div className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 dot-pattern opacity-60" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-24 pb-32 sm:pt-32 sm:pb-40">
          <div className="max-w-3xl">
            <Eyebrow>Digital Legal Literacy Initiative</Eyebrow>
            <h1 className="mt-6 font-display text-5xl sm:text-7xl font-bold leading-[1.02] text-navy-deep">
              Know Your <span className="text-gradient-teal">Rights Online.</span><br />
              No Law Degree Required.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-navy-deep/70 max-w-2xl">
              The internet has rules — and most teens never get taught them. We're changing that.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/decoder" className="inline-flex items-center gap-2 rounded-full bg-mesh text-white px-6 py-3 font-semibold shadow-glow hover:brightness-110 transition">
                <Sparkles className="h-4 w-4" /> Decode a Contract
              </Link>
              <Link to="/resources" className="inline-flex items-center gap-2 rounded-full border border-navy-deep/20 bg-white/70 px-6 py-3 font-semibold text-navy-deep backdrop-blur hover:bg-white transition">
                Browse Resources <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-4 max-w-xl">
              {[
                { icon: ShieldCheck, label: "Plain English" },
                { icon: Lock, label: "Built for Teens" },
                { icon: Scale, label: "Reviewed Content" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-2 rounded-lg border border-navy-deep/10 bg-white/70 backdrop-blur px-3 py-2.5">
                  <b.icon className="h-4 w-4 text-teal" />
                  <span className="text-xs sm:text-sm font-semibold text-navy-deep">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* INTRO */}
      <Section>
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <Eyebrow>The Platform</Eyebrow>
            <h2 className="mt-4 text-4xl font-bold">An intro to the platform</h2>
          </div>
          <div className="space-y-5 text-muted-foreground leading-relaxed">
            <p>Every time you download an app, scroll through social media, or click "I Agree" on a terms and conditions page, the law is involved. But nobody's teaching you what any of it actually means — until now.</p>
            <p>This platform was built specifically for teens aged 12–18 who deserve to understand their digital rights in plain, honest language. No jargon. No lectures. Just the real stuff that affects your everyday life online.</p>
            <p>Whether you want to know what TikTok can actually do with your data, whether your school can monitor your DMs, or what you're really agreeing to when you sign up for a platform — this is your space to find out.</p>
          </div>
        </div>
      </Section>

      {/* WHO IT'S FOR */}
      <div className="bg-secondary/50 border-y border-border">
        <Section>
          <div className="max-w-3xl">
            <Eyebrow>Who it's for</Eyebrow>
            <h2 className="mt-4 text-4xl font-bold">Built for Teens. Designed Around Your Reality.</h2>
            <p className="mt-6 text-muted-foreground">
              If you're between 12 and 18, you're already living a digital life — and that digital life comes with legal fine print that most adults don't even read, let alone understand.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 gap-4">
            {[
              "You've ever clicked \"Accept\" without reading what you were agreeing to",
              "You've wondered whether an app can legally share your location or photos",
              "You've been unsure about your rights when something goes wrong online",
              "You want to understand digital law before you're old enough for a lawyer to care",
            ].map((t) => (
              <div key={t} className="rounded-2xl border border-border bg-card p-5 flex gap-3 items-start shadow-card">
                <div className="mt-0.5 h-6 w-6 rounded-md bg-teal/15 text-teal flex items-center justify-center text-xs font-bold">✓</div>
                <p className="text-sm">{t}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted-foreground max-w-2xl">
            You don't need to be interested in law to be here. You just need to care about what happens to you online — and most teens do.
          </p>
        </Section>
      </div>

      {/* OFFERINGS */}
      <Section>
        <div className="max-w-3xl mb-12">
          <Eyebrow>What we offer</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold">Everything you need to navigate the digital world — legally.</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {offerings.map((o) => (
            <Link key={o.title} to={o.to} className="group relative rounded-2xl border border-border bg-card p-6 hover:border-teal/50 hover:shadow-card transition">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-navy to-teal/80 flex items-center justify-center text-white">
                  <o.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-bold">{o.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">{o.desc}</p>
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal group-hover:gap-2.5 transition-all">
                {o.cta} <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section className="pb-32">
        <div className="relative overflow-hidden rounded-3xl bg-mesh p-10 sm:p-16 text-white">
          <div className="absolute inset-0 grid-pattern opacity-20" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl sm:text-5xl font-bold">Before you click "I Agree" again…</h2>
            <p className="mt-4 text-white/80 text-lg">Paste any Terms of Service into the Contract Decoder. We'll flag the risky clauses and translate them into plain English.</p>
            <Link to="/decoder" className="mt-8 inline-flex items-center gap-2 rounded-full bg-teal px-6 py-3 font-semibold text-navy-deep shadow-glow hover:brightness-110 transition">
              <Sparkles className="h-4 w-4" /> Try the Contract Decoder
            </Link>
          </div>
        </div>
      </Section>
    </SiteLayout>
  );
}
