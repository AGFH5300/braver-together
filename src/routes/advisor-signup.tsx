import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Eyebrow, Section, SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/advisor-signup")({
  head: () => ({
    meta: [
      { title: "Become an Advisor — BraverTogether" },
      {
        name: "description",
        content:
          "Create an advisor-applicant account and apply to volunteer with BraverTogether.",
      },
    ],
  }),
  component: AdvisorSignupPage,
});

function AdvisorSignupPage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.user) {
        void navigate({ to: "/advisor-application", replace: true });
        return;
      }
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session?.user) {
        void navigate({ to: "/advisor-application", replace: true });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setInlineMessage(null);

    if (!agreed) {
      setInlineMessage("Please confirm the applicant declaration before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/advisor-signup`,
          data: {
            display_name: displayName.trim() || normalizedEmail.split("@")[0],
            onboarding_intent: "advisor",
          },
        },
      });

      if (error) throw error;

      if (data.session?.user) {
        toast.success("Account created");
        await navigate({ to: "/advisor-application", replace: true });
        return;
      }

      setSubmittedEmail(normalizedEmail);
      setPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Your account could not be created.";
      setInlineMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <SiteLayout>
        <Section className="py-24 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-teal" />
          <p className="mt-3 text-sm text-muted-foreground">Checking your account…</p>
        </Section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="relative py-16 sm:py-20">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_460px]">
            <div className="pt-4">
              <Eyebrow>
                <UserRoundPlus className="h-3.5 w-3.5" /> Become an Advisor
              </Eyebrow>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold text-navy-deep sm:text-5xl lg:text-6xl">
                Create your advisor applicant account.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-navy-deep/70">
                This is the starting point for people who want to volunteer as BraverTogether
                advisors. Creating this account does not grant advisor access. You will continue to
                a reviewed application after signing in.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  ["1", "Create account", "Register your applicant login."],
                  ["2", "Submit application", "Share your experience and focus areas."],
                  ["3", "Team review", "Advisor access activates only after approval."],
                ].map(([number, title, description]) => (
                  <div key={number} className="rounded-2xl border border-navy/10 bg-white/70 p-4 backdrop-blur">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal/10 text-sm font-bold text-teal">
                      {number}
                    </div>
                    <h2 className="mt-3 font-display text-base font-bold text-navy-deep">{title}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-navy-deep/60">{description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-start gap-3 rounded-2xl border border-navy/10 bg-white/65 p-5 text-sm text-navy-deep/70 backdrop-blur">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
                <p>
                  Applicants may be asked for a follow-up conversation or appropriate identity,
                  qualification and safeguarding checks before approval.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-card backdrop-blur sm:p-8">
              {submittedEmail ? (
                <div className="py-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal/10 text-teal">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 font-display text-2xl font-bold">Check your email</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    We sent a confirmation link to <strong className="text-foreground">{submittedEmail}</strong>.
                    Open it in this browser. After confirmation, you will continue directly to the
                    advisor application.
                  </p>
                  <Link
                    to="/auth"
                    search={{ intent: "advisor" }}
                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-semibold transition hover:border-teal/40"
                  >
                    Already confirmed? Sign in <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/10 text-teal">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-2xl font-bold">Advisor applicant signup</h2>
                      <p className="text-xs text-muted-foreground">For prospective volunteer advisors</p>
                    </div>
                  </div>

                  {inlineMessage && (
                    <div className="mt-5 rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm" role="status" aria-live="polite">
                      {inlineMessage}
                    </div>
                  )}

                  <form onSubmit={submit} className="mt-6 space-y-4">
                    <Field
                      icon={UserRoundPlus}
                      autoComplete="name"
                      placeholder="Full name"
                      value={displayName}
                      onChange={setDisplayName}
                      required
                    />
                    <Field
                      icon={Mail}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={setEmail}
                      required
                    />
                    <Field
                      icon={Lock}
                      type="password"
                      autoComplete="new-password"
                      placeholder="Password — at least 8 characters"
                      value={password}
                      onChange={setPassword}
                      minLength={8}
                      required
                    />

                    <label className="flex items-start gap-2 rounded-xl bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(event) => setAgreed(event.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        I confirm that I am creating an advisor applicant account. I understand that
                        this account has normal-user access until BraverTogether reviews and approves
                        my application.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mesh px-5 py-3 font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
                      Create applicant account
                    </button>
                  </form>

                  <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
                    Already have a BraverTogether account?{" "}
                    <Link to="/auth" search={{ intent: "advisor" }} className="font-semibold text-teal underline underline-offset-4">
                      Sign in and apply
                    </Link>
                  </div>

                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Looking for a normal student account?{" "}
                    <Link to="/auth" search={{ intent: undefined }} className="font-semibold text-foreground hover:text-teal">
                      Use regular signup
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </Section>
      </div>
    </SiteLayout>
  );
}

function Field({
  icon: Icon,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  minLength,
  autoComplete,
}: {
  icon: React.ElementType;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-teal/40"
      />
    </div>
  );
}
