import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { Sparkles, FileText, AlertTriangle, CheckCircle2, Info, Loader2, ArrowLeft, ShieldAlert } from "lucide-react";
import { analyzeContract, type ContractAnalysis } from "@/lib/decoder.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/decoder")({
  head: () => ({
    meta: [
      { title: "Contract Decoder — BraverTogether" },
      { name: "description", content: "Paste any Terms of Service or privacy policy. Get back a plain-English breakdown of what you're agreeing to — with risky clauses flagged." },
      { property: "og:title", content: "Contract Decoder — BraverTogether" },
      { property: "og:description", content: "Understand before you agree. AI-powered plain-English contract translator for teens." },
    ],
  }),
  component: Decoder,
});

const EXAMPLE = `By using our Service, you agree that we may collect, use, and share your personal data with third-party partners for marketing purposes without further consent. You also grant us a non-exclusive, worldwide, royalty-free license to use, reproduce, modify, and distribute any content you post on the Platform. We reserve the right to terminate your account at our sole discretion without notice.`;

function Decoder() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ContractAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useServerFn(analyzeContract);

  async function analyze() {
    const trimmed = text.trim();
    if (trimmed.length < 20) {
      setError("Paste a longer piece of contract text (at least 20 characters).");
      return;
    }
    if (trimmed.length > 500_000) {
      setError("That's an enormous document (500k+ characters). Try pasting a single policy at a time.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await run({ data: { text: trimmed } });
      setResult(r);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      console.error(e);
      setError("Couldn't analyze that text. Try again in a moment — long documents may take 20–40 seconds.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteLayout>
      <div className="relative bg-hero overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-20 pb-10 text-center">
          <Eyebrow><Sparkles className="h-3 w-3" /> AI-Powered Contract Decoder</Eyebrow>
          <h1 className="mt-6 font-display text-5xl sm:text-7xl font-bold leading-[1.02] text-navy-deep">
            Understand <span className="text-gradient-teal">Before You Agree.</span>
          </h1>
          <p className="mt-5 text-navy-deep/70 max-w-2xl mx-auto text-lg">
            Paste Terms & Conditions, app agreements, or any digital contract — no length limit. We'll translate the legal jargon into plain English instantly.
          </p>
        </div>

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 -mb-20 pb-20">
          {!result && (
            <div className="rounded-3xl bg-card text-foreground border border-border shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/40">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-warn">
                  <FileText className="h-4 w-4" /> Paste legal text here
                </div>
                <button
                  onClick={() => setText(EXAMPLE)}
                  className="text-xs font-semibold rounded-full border border-border bg-background px-3 py-1.5 hover:bg-secondary"
                >
                  Paste Example
                </button>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the Terms of Service, Privacy Policy, or contract text here..."
                className="w-full min-h-[280px] p-5 text-sm leading-relaxed resize-y focus:outline-none bg-card"
                disabled={loading}
              />
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between px-5 py-4 border-t border-border bg-secondary/20">
                <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-md">
                  <Info className="h-3.5 w-3.5 text-teal mt-0.5 flex-shrink-0" />
                  <span>By clicking analyze, you understand this tool provides educational summaries and not formal legal advice. Never paste sensitive passwords or SSNs.</span>
                </div>
                <button
                  onClick={analyze}
                  disabled={loading || text.trim().length < 20}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-mesh text-white px-6 py-3 text-sm font-semibold shadow-glow hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {loading ? "Analyzing..." : "Analyze Text"}
                </button>
              </div>
              {error && (
                <div className="px-5 py-3 bg-destructive/10 text-destructive text-sm border-t border-destructive/30">{error}</div>
              )}
            </div>
          )}

          {result && (
            <div id="results">
              <button
                onClick={() => { setResult(null); setText(""); }}
                className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary mb-4"
              >
                <ArrowLeft className="h-4 w-4" /> Analyze another contract
              </button>

              {/* Summary */}
              <div className="rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-card mb-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-teal/15 text-teal flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Contract Summary</h2>
                </div>
                <p className="text-foreground/80 leading-relaxed">
                  {result.summary}{" "}
                  {result.highRiskCount > 0 && (
                    <>We flagged{" "}
                      <span className="font-bold text-danger">{result.highRiskCount} high-risk clause{result.highRiskCount !== 1 ? "s" : ""}</span>{" "}
                      you should be aware of.
                    </>
                  )}
                </p>
              </div>

              {/* High & medium risk */}
              <div className="grid md:grid-cols-2 gap-5 mb-5">
                {result.clauses.filter((c) => c.risk === "high" || c.risk === "medium").map((c, i) => (
                  <ClauseCard key={i} clause={c} />
                ))}
              </div>

              {/* Standard / low */}
              {result.clauses.some((c) => c.risk === "standard" || c.risk === "low") && (
                <div className="rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-card">
                  <div className="flex items-center gap-2 text-teal font-display text-xl font-bold mb-5">
                    <CheckCircle2 className="h-5 w-5" /> Standard Clauses (Normal)
                  </div>
                  <div className="space-y-4">
                    {result.clauses.filter((c) => c.risk === "standard" || c.risk === "low").map((c, i) => (
                      <div key={i} className="border-l-2 border-teal/40 pl-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="h-2 w-2 rounded-full bg-teal" />
                          <span className="font-semibold text-foreground">{c.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{c.plainEnglish}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-2xl bg-secondary/60 border border-border p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" /> This analysis is generated by AI for educational purposes and is not legal advice.
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="pt-32" />
    </SiteLayout>
  );
}

function ClauseCard({ clause }: { clause: ContractAnalysis["clauses"][number] }) {
  const isHigh = clause.risk === "high";
  return (
    <div className={cn(
      "rounded-2xl border bg-card p-6 shadow-card",
      isHigh ? "border-danger/30" : "border-warn/30"
    )}>
      <div className={cn(
        "inline-flex items-center gap-2 font-bold text-sm mb-4",
        isHigh ? "text-danger" : "text-warn"
      )}>
        {isHigh ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {isHigh ? "High Risk" : "Medium Risk"}: {clause.title}
      </div>

      <div className="mb-4">
        <div className="text-sm font-semibold text-foreground mb-1.5">What it says:</div>
        <div className="rounded-lg bg-secondary/60 border border-border p-3">
          <p className="text-sm italic text-muted-foreground">"{clause.quote}"</p>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-foreground mb-1.5">Plain English:</div>
        <div className={cn(
          "rounded-lg p-3 text-sm font-medium",
          isHigh ? "bg-danger/10 text-danger" : "bg-warn/10 text-warn"
        )}>
          {clause.plainEnglish}
        </div>
      </div>
    </div>
  );
}
