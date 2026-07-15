import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { MAX_CONTRACT_CHARACTERS } from "@/lib/decoder.constants";
import { analyzeContract, type ContractAnalysis } from "@/lib/decoder.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/decoder")({
  head: () => ({
    meta: [
      { title: "Contract Decoder — BraverTogether" },
      {
        name: "description",
        content:
          "Paste Terms of Service or a privacy policy and get a plain-English breakdown with risky clauses flagged.",
      },
      { property: "og:title", content: "Contract Decoder — BraverTogether" },
      {
        property: "og:description",
        content: "Understand before you agree with a plain-English contract summary for teens.",
      },
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
    if (trimmed.length > MAX_CONTRACT_CHARACTERS) {
      setError(
        `This document is over ${MAX_CONTRACT_CHARACTERS.toLocaleString()} characters. Try one policy or section at a time.`,
      );
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const analysis = await run({ data: { text: trimmed } });
      setResult(analysis);
      window.setTimeout(
        () => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } catch (caughtError) {
      console.error(caughtError);
      setError(
        "Couldn't analyze that text. Check the AI configuration or try again in a moment.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteLayout>
      <div className="relative bg-hero overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-20 pb-10 text-center">
          <Eyebrow>
            <Sparkles className="h-3 w-3" /> AI-Powered Contract Decoder
          </Eyebrow>
          <h1 className="mt-6 font-display text-5xl sm:text-7xl font-bold leading-[1.02] text-navy-deep">
            Understand <span className="text-gradient-teal">Before You Agree.</span>
          </h1>
          <p className="mt-5 text-navy-deep/70 max-w-2xl mx-auto text-lg">
            Paste Terms &amp; Conditions, app agreements, or another digital contract up to about{" "}
            {MAX_CONTRACT_CHARACTERS.toLocaleString()} characters. We’ll translate the important
            clauses into plain English.
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
                  type="button"
                  onClick={() => {
                    setText(EXAMPLE);
                    setError(null);
                  }}
                  className="text-xs font-semibold rounded-full border border-border bg-background px-3 py-1.5 hover:bg-secondary"
                >
                  Paste Example
                </button>
              </div>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste the Terms of Service, Privacy Policy, or contract text here..."
                maxLength={MAX_CONTRACT_CHARACTERS + 1}
                className="w-full min-h-[280px] p-5 text-sm leading-relaxed resize-y focus:outline-none bg-card"
                disabled={loading}
              />
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between px-5 py-4 border-t border-border bg-secondary/20">
                <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-md">
                  <Info className="h-3.5 w-3.5 text-teal mt-0.5 flex-shrink-0" />
                  <span>
                    This tool provides an educational summary, not formal legal advice. Never paste
                    passwords, identity numbers, financial details, or other sensitive information.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={analyze}
                  disabled={loading || text.trim().length < 20}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-mesh text-white px-6 py-3 text-sm font-semibold shadow-glow hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {loading ? "Analyzing..." : "Analyze Text"}
                </button>
              </div>
              {error && (
                <div className="px-5 py-3 bg-destructive/10 text-destructive text-sm border-t border-destructive/30">
                  {error}
                </div>
              )}
            </div>
          )}

          {result && (
            <div id="results">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setText("");
                  setError(null);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary mb-4"
              >
                <ArrowLeft className="h-4 w-4" /> Analyze another contract
              </button>

              <div className="rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-card mb-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-teal/15 text-teal flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                    Contract Summary
                  </h2>
                </div>
                <p className="text-foreground/80 leading-relaxed">
                  {result.summary}{" "}
                  {result.highRiskCount > 0 && (
                    <>
                      We flagged{" "}
                      <span className="font-bold text-danger">
                        {result.highRiskCount} high-risk clause
                        {result.highRiskCount !== 1 ? "s" : ""}
                      </span>{" "}
                      you should be aware of.
                    </>
                  )}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-5 mb-5">
                {result.clauses
                  .filter((clause) => clause.risk === "high" || clause.risk === "medium")
                  .map((clause) => (
                    <ClauseCard key={`${clause.title}-${clause.quote}`} clause={clause} />
                  ))}
              </div>

              {result.clauses.some(
                (clause) => clause.risk === "standard" || clause.risk === "low",
              ) && (
                <div className="rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-card">
                  <div className="flex items-center gap-2 text-teal font-display text-xl font-bold mb-5">
                    <CheckCircle2 className="h-5 w-5" /> Standard and lower-risk clauses
                  </div>
                  <div className="space-y-4">
                    {result.clauses
                      .filter(
                        (clause) => clause.risk === "standard" || clause.risk === "low",
                      )
                      .map((clause) => (
                        <div key={`${clause.title}-${clause.quote}`} className="border-l-2 border-teal/40 pl-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="h-2 w-2 rounded-full bg-teal" />
                            <span className="font-semibold text-foreground">{clause.title}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{clause.plainEnglish}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-2xl bg-secondary/60 border border-border p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" /> This analysis is generated by AI for educational
                purposes and is not legal advice.
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
    <div
      className={cn(
        "rounded-2xl border bg-card p-6 shadow-card",
        isHigh ? "border-danger/30" : "border-warn/30",
      )}
    >
      <div
        className={cn(
          "inline-flex items-center gap-2 font-bold text-sm mb-4",
          isHigh ? "text-danger" : "text-warn",
        )}
      >
        {isHigh ? (
          <ShieldAlert className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        {isHigh ? "High Risk" : "Medium Risk"}: {clause.title}
      </div>

      <div className="mb-4">
        <div className="text-sm font-semibold text-foreground mb-1.5">What it says:</div>
        <div className="rounded-lg bg-secondary/60 border border-border p-3">
          <p className="text-sm italic text-muted-foreground">“{clause.quote}”</p>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-foreground mb-1.5">Plain English:</div>
        <div
          className={cn(
            "rounded-lg p-3 text-sm font-medium",
            isHigh ? "bg-danger/10 text-danger" : "bg-warn/10 text-warn",
          )}
        >
          {clause.plainEnglish}
        </div>
      </div>
    </div>
  );
}
