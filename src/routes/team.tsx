import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { User } from "lucide-react";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Meet the Team — BraverTogether" },
      { name: "description", content: "The people building BraverTogether — leadership, media, events, outreach, and digital legal advisors." },
      { property: "og:title", content: "Meet the Team — BraverTogether" },
      { property: "og:description", content: "The people behind BraverTogether." },
    ],
  }),
  component: TeamPage,
});

type Member = { name: string; role: string; image?: string };
type Group = { title: string; members: Member[] };

const groups: Group[] = [
  {
    title: "Leadership",
    members: [
      { name: "Tara Vishwakarthik", role: "Founder & Executive Director" },
      { name: "Izaan Mohammad", role: "Chief Management Officer & Co-Founder" },
      { name: "Katherine Raj Varghese", role: "Chief Operations Officer & Co-Founder" },
    ],
  },
  {
    title: "Media",
    members: [
      { name: "Vihaan Bhatia", role: "Head of Media" },
      { name: "Avni Pabreja", role: "Head of Media" },
      { name: "Khyati", role: "Deputy Head of Media" },
      { name: "Ahvni Hegde", role: "Deputy Head of Media" },
    ],
  },
  {
    title: "Events",
    members: [
      { name: "Parita Bhatia", role: "Head of Events" },
      { name: "Yuvraj Dewan", role: "Deputy Head of Events" },
      { name: "Aayra Sahiwala", role: "Deputy Head of Events" },
      { name: "Kiara Patel", role: "Deputy Head of Events" },
    ],
  },
  {
    title: "Outreach",
    members: [
      { name: "Jhanvi Uttamchandani", role: "Co-Head of Outreach" },
      { name: "Prisha Talwar", role: "Co-Head of Outreach" },
    ],
  },
  {
    title: "Digital Legal Advisors",
    members: [
      { name: "Aryaveer Babu", role: "Head of Digital Legal Advisors" },
      { name: "Malak Jundi", role: "Deputy Head of Digital Legal Advisors" },
    ],
  },
];

function MemberCard({ m }: { m: Member }) {
  return (
    <div className="group">
      <div className="aspect-square rounded-2xl bg-secondary/60 border border-border overflow-hidden flex items-center justify-center">
        {m.image ? (
          <img src={m.image} alt={m.name} className="h-full w-full object-cover" />
        ) : (
          <User className="h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} />
        )}
      </div>
      <div className="mt-3">
        <div className="font-display font-semibold text-sm text-navy-deep leading-tight">{m.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{m.role}</div>
      </div>
    </div>
  );
}

function TeamPage() {
  return (
    <SiteLayout>
      <div className="bg-hero relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="py-20 relative">
          <Eyebrow>The Team</Eyebrow>
          <h1 className="mt-4 text-5xl sm:text-6xl font-bold max-w-3xl text-navy-deep">Meet the people behind BraverTogether.</h1>
          <p className="mt-4 max-w-2xl text-navy-deep/70">A student-led team building digital legal literacy for teens — across leadership, media, events, outreach, and advising.</p>
        </Section>
      </div>

      <Section className="py-16 space-y-16">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="flex items-baseline justify-between border-b border-border pb-3 mb-8">
              <h2 className="font-display text-2xl font-bold text-navy-deep">{g.title}</h2>
              <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{g.members.length} {g.members.length === 1 ? "member" : "members"}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {g.members.map((m) => (
                <MemberCard key={m.name} m={m} />
              ))}
            </div>
          </div>
        ))}
      </Section>
    </SiteLayout>
  );
}
