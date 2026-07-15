import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { AlertTriangle, MessageCircle, ShieldCheck, Lock, Users, BrainCircuit, Copyright, Globe, FileText, ServerCog, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/advisors")({
  head: () => ({
    meta: [
      { title: "Ask an Advisor — BraverTogether" },
      { name: "description", content: "Connect with law students, academics and legal professionals who volunteer their time to help teens understand digital law." },
      { property: "og:title", content: "Ask an Advisor — BraverTogether" },
      { property: "og:description", content: "Free, educational guidance from volunteer legal advisors." },
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
};

const advisors = [
  { n: 1, icon: Lock, focus: ["Data Privacy & Personal Information", "Social Media Platform Policies", "Digital Footprints", "Children's Online Privacy Rights", "Data Collection Practices"], quote: "Helping teens understand what happens to their data online and what rights they have over it." },
  { n: 2, icon: FileText, focus: ["Terms & Conditions", "Privacy Policies", "User Agreements", "Subscription Contracts", "Consumer Rights in Digital Services"], quote: "Making legal fine print understandable before you click 'I Agree'." },
  { n: 3, icon: ShieldCheck, focus: ["Cyberbullying & Online Harassment", "Digital Safety", "Reporting Mechanisms", "School Technology Policies", "Online Conduct Regulations"], quote: "Helping young people navigate difficult online situations and understand available protections." },
  { n: 4, icon: BrainCircuit, focus: ["Artificial Intelligence & Emerging Technology", "AI Ethics", "Algorithmic Decision-Making", "Generative AI Tools", "Future Technology Regulation"], quote: "Explaining how rapidly changing technologies intersect with law and society." },
  { n: 5, icon: Copyright, focus: ["Intellectual Property", "Copyright", "Content Creation", "Influencer & Creator Rights", "Fair Use Principles"], quote: "Supporting young creators in understanding ownership and responsible content use online." },
  { n: 6, icon: ServerCog, focus: ["Cybersecurity Law", "Online Fraud & Scams", "Digital Risk Awareness", "Account Security", "Responsible Technology Use"], quote: "Helping teens stay informed about legal and practical issues related to online security." },
  { n: 7, icon: Globe, focus: ["International Digital Law", "Cross-Border Internet Regulation", "Platform Governance", "Technology Policy", "Comparative Digital Rights"], quote: "Exploring how different countries approach the rights and responsibilities of internet users." },
  { n: 8, icon: Users, focus: ["Technology Law Research", "Digital Rights Advocacy", "Public Policy", "Internet Governance", "Youth Rights Online"], quote: "Connecting legal developments to the everyday experiences of young people online." },
];

function Advisors() {
  const navigate = useNavigate();
  const [verified, setVerified] = useState<AdvisorProfile[]>([]);
  const [loadingVerified, setLoadingVerified] = useState(true);
  const [startingWith, setStartingWith] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, display_name, headline, bio, focus_areas, calendly_url, accepting_messages")
      .eq("is_advisor", true)
      .eq("is_public", true)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setVerified((data ?? []) as AdvisorProfile[]);
        setLoadingVerified(false);
      });
  }, []);

  async function startConversation(advisorId: string) {
    setStartingWith(advisorId);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      navigate({ to: "/auth" });
      return;
    }
    // Try existing
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("teen_id", u.user.id)
      .eq("advisor_id", advisorId)
      .maybeSingle();
    let id = existing?.id;
    if (!id) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ teen_id: u.user.id, advisor_id: advisorId })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        setStartingWith(null);
        return;
      }
      id = data.id;
    }
    navigate({ to: "/messages", search: { c: id } });
  }

  return (
    <SiteLayout>
      <div className="bg-hero relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="py-24 relative">
          <Eyebrow>Ask an Advisor</Eyebrow>
          <h1 className="mt-4 text-5xl sm:text-6xl font-bold max-w-3xl text-navy-deep">Have a question about digital law?</h1>
          <p className="mt-6 text-navy-deep/70 max-w-2xl text-lg">
            Our advisors are law students, academics, and legal professionals who volunteer their time to help teens better understand digital law and online rights. Free, educational, and judgment-free.
          </p>
        </Section>
      </div>

      {/* Disclaimer - prominent */}
      <Section className="py-10">
        <div className="rounded-2xl border-2 border-warn/40 bg-warn/5 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-warn/20 text-warn flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-warn mb-2">Important Disclaimer</div>
              <h2 className="font-display text-2xl font-bold mb-3">This service is educational only — not legal advice.</h2>
              <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
                <p>The Ask an Advisor service is provided for educational and informational purposes only. Information shared by advisors does <strong className="text-foreground">not constitute legal advice</strong> and should not be relied upon as a substitute for advice from a qualified lawyer licensed in your jurisdiction.</p>
                <p>Using this service does not create an attorney-client relationship, solicitor-client relationship, or any other professional legal relationship between users and advisors.</p>
                <p>Advisors may include law students, academics, researchers, and legal professionals volunteering their time. While every effort is made to provide accurate and useful information, we cannot guarantee the completeness, accuracy, or applicability of any response to your specific circumstances.</p>
                <p><strong className="text-foreground">Do not share confidential, sensitive, or personally identifying information when submitting questions.</strong> By using this service, you acknowledge and agree that all responses are educational in nature and should not be considered formal legal counsel.</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* How it works */}
      <Section className="py-10">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-4 text-3xl font-bold mb-8">Four simple steps.</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { n: 1, t: "Browse Advisors", d: "Find someone whose area of expertise matches your question." },
            { n: 2, t: "Submit Your Question", d: "Send a brief description with as much context as possible." },
            { n: 3, t: "Receive a Response", d: "An advisor will provide educational guidance and resources." },
            { n: 4, t: "Request a Call (Optional)", d: "Where available, follow up with a virtual conversation." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-card p-5">
              <div className="text-teal font-display text-3xl font-bold mb-2">0{s.n}</div>
              <div className="font-semibold mb-1">{s.t}</div>
              <div className="text-xs text-muted-foreground">{s.d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Rules */}
      <Section className="py-10">
        <Eyebrow>Rules & expectations</Eyebrow>
        <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { t: "Be Respectful", d: "Treat advisors and community members with courtesy and professionalism." },
            { t: "Ask Genuine Questions", d: "Questions should relate to digital law, online rights, technology policy, or privacy." },
            { t: "Protect Your Privacy", d: "Do not submit passwords, financial information, or identifying details about yourself or others." },
            { t: "No Emergency Situations", d: "For urgent legal or safety issues, this platform is not an appropriate substitute." },
            { t: "Educational Use Only", d: "Responses help you learn — they don't resolve disputes or provide representation." },
            { t: "One Question at a Time", d: "Keep submissions focused so we can serve everyone fairly." },
          ].map((r) => (
            <div key={r.t} className="rounded-xl border border-border bg-card p-4">
              <div className="font-semibold text-sm mb-1">{r.t}</div>
              <div className="text-xs text-muted-foreground">{r.d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Verified advisors from DB */}
      <Section className="py-10">
        <Eyebrow>Verified advisors</Eyebrow>
        <h2 className="mt-4 text-3xl sm:text-4xl font-bold">Message an advisor directly.</h2>
        <p className="mt-3 text-muted-foreground text-sm max-w-2xl">Sign in, send a message, and book a call when they're free. Advisors below have published their profiles and accept new conversations.</p>

        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loadingVerified ? (
            <div className="col-span-full py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : verified.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No advisor profiles published yet. Advisors: sign in and head to your profile to publish.
            </div>
          ) : (
            verified.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-5 hover:border-teal/40 hover:shadow-card transition flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-full bg-mesh text-white flex items-center justify-center font-display font-bold">
                    {a.display_name?.[0]?.toUpperCase() ?? "A"}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold truncate">{a.display_name}</div>
                    {a.headline && <div className="text-xs text-muted-foreground truncate">{a.headline}</div>}
                  </div>
                </div>
                {a.bio && <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{a.bio}</p>}
                {a.focus_areas?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {a.focus_areas.slice(0, 4).map((f) => (
                      <span key={f} className="text-[10px] uppercase tracking-wider rounded-full bg-teal/10 text-teal border border-teal/20 px-2 py-0.5">{f}</span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex gap-2">
                  <button
                    onClick={() => startConversation(a.id)}
                    disabled={!a.accepting_messages || startingWith === a.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-navy text-white px-3 py-2 text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
                  >
                    {startingWith === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                    Message
                  </button>
                  {a.calendly_url && (
                    <a href={a.calendly_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-secondary">
                      <Calendar className="h-3.5 w-3.5" /> Book call
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* Topic coverage (static) */}
      <div className="bg-secondary/40 border-y border-border">
        <Section>
          <Eyebrow>Topics we cover</Eyebrow>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold">What our advisors can help with.</h2>
          <p className="mt-3 text-muted-foreground text-sm">These are the areas of digital law our volunteer panel specialises in.</p>

          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {advisors.map((a) => (
              <div key={a.n} className="rounded-2xl border border-border bg-card p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-xl bg-mesh flex items-center justify-center text-white">
                    <a.icon className="h-5 w-5" />
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-teal font-bold">Topic area {String(a.n).padStart(2, "0")}</div>
                </div>
                <ul className="text-xs space-y-1 mb-4 flex-1">
                  {a.focus.map((f) => (
                    <li key={f} className="text-muted-foreground">· {f}</li>
                  ))}
                </ul>
                <p className="text-xs italic text-muted-foreground border-l-2 border-teal/40 pl-3">"{a.quote}"</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </SiteLayout>
  );
}
