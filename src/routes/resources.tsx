import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { Download, Star, ShieldCheck, Users, Lock, FileText, BrainCircuit, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resource Library — BraverTogether" },
      { name: "description", content: "Free guides and PDFs on privacy, social media law, digital contracts, online safety, AI, and digital rights — written for teens." },
      { property: "og:title", content: "Resource Library — BraverTogether" },
      { property: "og:description", content: "Plain-English guides on the laws that shape your digital life." },
    ],
  }),
  component: Resources,
});

const categories = [
  { id: "all", label: "All", icon: FileText },
  { id: "privacy", label: "Privacy & Data", icon: Lock },
  { id: "social", label: "Social Media Law", icon: Users },
  { id: "contracts", label: "Digital Contracts", icon: Scale },
  { id: "safety", label: "Online Safety", icon: ShieldCheck },
  { id: "ai", label: "AI & Emerging Tech", icon: BrainCircuit },
  { id: "rights", label: "Digital Rights", icon: FileText },
];

const pdfs = [
  { cat: "privacy", n: 1, title: "Your Data, Your Rights", desc: "What personal data is, how companies collect it, why data has value, basic privacy rights." },
  { cat: "privacy", n: 2, title: "What Apps Know About You", desc: "Location tracking, device permissions, data sharing, advertising profiles." },
  { cat: "privacy", n: 3, title: "Can Social Media Platforms Track You?", desc: "Cookies, tracking pixels, cross-platform tracking, personalized ads." },
  { cat: "social", n: 4, title: "Social Media and the Law", desc: "Platform rules, user responsibilities, account suspensions, content moderation." },
  { cat: "social", n: 5, title: "Can Schools Monitor Your Online Activity?", desc: "School devices, school networks, student privacy, educational platforms." },
  { cat: "social", n: 6, title: "Understanding Cyberbullying Laws", desc: "Legal definitions, reporting options, evidence collection, available protections." },
  { cat: "contracts", n: 7, title: "Terms & Conditions Explained", desc: "Why they matter, common clauses, hidden permissions, things to look for." },
  { cat: "contracts", n: 8, title: "The Teen's Guide to Privacy Policies", desc: "How to read policies, data collection clauses, red flags, questions to ask." },
  { cat: "contracts", n: 9, title: "What Does \"I Agree\" Actually Mean?", desc: "Digital contracts, consent, user obligations, legal implications." },
  { cat: "safety", n: 10, title: "Digital Safety Essentials", desc: "Passwords, multi-factor authentication, account protection, security basics." },
  { cat: "safety", n: 11, title: "Online Scams and How to Spot Them", desc: "Phishing, fake giveaways, impersonation scams, fraud prevention." },
  { cat: "ai", n: 12, title: "AI and Your Rights", desc: "What AI is, how AI uses data, ethical concerns, future regulations." },
  { cat: "ai", n: 13, title: "Deepfakes, AI Images, and the Law", desc: "What deepfakes are, legal challenges, privacy concerns, responsible use." },
  { cat: "rights", n: 14, title: "Your Rights Online", desc: "Freedom of expression, privacy, access to information, digital citizenship." },
  { cat: "rights", n: 15, title: "A Beginner's Guide to Digital Law", desc: "Key legal concepts, major areas of digital law, why digital law matters, future trends." },
];

function Resources() {
  const [active, setActive] = useState("all");
  const filtered = active === "all" ? pdfs : pdfs.filter((p) => p.cat === active);

  return (
    <SiteLayout>
      <div className="bg-hero relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="py-24 relative">
          <Eyebrow>Resource Library</Eyebrow>
          <h1 className="mt-4 text-5xl sm:text-6xl font-bold max-w-3xl text-navy-deep">Free guides on the legal side of your digital life.</h1>
          <p className="mt-6 text-navy-deep/70 max-w-2xl text-lg">
            No legal jargon. No prior experience required. Just straightforward explanations of the laws, rights, and systems that affect you online.
          </p>
        </Section>
      </div>

      <Section>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          {[
            { t: "Understand Your Rights", d: "What protections exist for you online." },
            { t: "Make Better Decisions", d: "Know what you're agreeing to." },
            { t: "Stay Safe Online", d: "Spot scams, bullying, and privacy risks." },
            { t: "Build Digital Literacy", d: "How tech, law and society interact." },
            { t: "Prepare for the Future", d: "A life skill that matters more every year." },
          ].map((b) => (
            <div key={b.t} className="rounded-xl border border-border bg-card p-5">
              <div className="text-sm font-semibold mb-1">{b.t}</div>
              <div className="text-xs text-muted-foreground">{b.d}</div>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                active === c.id ? "bg-navy text-white border-navy" : "bg-card border-border text-muted-foreground hover:border-teal/50 hover:text-foreground"
              )}
            >
              <c.icon className="h-3.5 w-3.5" />
              {c.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <ResourceCard key={p.n} pdf={p} />
          ))}
        </div>
      </Section>
    </SiteLayout>
  );
}

function ResourceCard({ pdf }: { pdf: (typeof pdfs)[number] }) {
  const [rating, setRating] = useState(0);
  return (
    <div className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-card hover:border-teal/40 transition flex flex-col">
      <div className="relative h-32 bg-mesh flex items-center justify-center text-white">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="relative text-center">
          <div className="text-[10px] uppercase tracking-widest text-teal-soft">PDF {String(pdf.n).padStart(2, "0")}</div>
          <FileText className="h-8 w-8 mx-auto mt-1 text-teal" />
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display font-bold text-lg leading-tight mb-2">{pdf.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">{pdf.desc}</p>
        <div className="flex items-center justify-between gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-full bg-navy text-white px-3 py-1.5 text-xs font-semibold hover:opacity-90">
            <Download className="h-3.5 w-3.5" /> Download
          </button>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)} aria-label={`Rate ${s}`}>
                <Star className={cn("h-4 w-4 transition", s <= rating ? "fill-warn text-warn" : "text-muted-foreground/40")} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
