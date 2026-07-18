import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Lock, Mail, ShieldCheck, User as UserIcon, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { beginAdvisorOnboarding } from "@/lib/advisor-application.functions";
import { cn } from "@/lib/utils";

const AuthSearch = z.object({
  intent: z.enum(["advisor"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => AuthSearch.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in — BraverTogether" },
      { name: "description", content: "Sign in or create an account to message advisors and manage meetings." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const startAdvisorOnboarding = useServerFn(beginAdvisorOnboarding);
  const { intent } = Route.useSearch();
  const advisorIntent = intent === "advisor";
  const [mode, setMode] = useState<"signin" | "signup">(advisorIntent ? "signin" : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const googleEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true";

  async function continueAfterAuth() {
    if (advisorIntent) {
      await startAdvisorOnboarding();
      window.dispatchEvent(new Event("advisor-onboarding-changed"));
      await navigate({ to: "/advisor-application", replace: true });
      return;
    }
    await navigate({ to: "/messages", search: { c: undefined }, replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) void continueAfterAuth();
    });

    const resetTransientState = () => setGoogleLoading(false);
    window.addEventListener("pageshow", resetTransientState);
    document.addEventListener("visibilitychange", resetTransientState);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", resetTransientState);
      document.removeEventListener("visibilitychange", resetTransientState);
    };
  }, [advisorIntent, navigate]);

  function changeMode(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setInlineMessage(null);
    setPassword("");
  }

  async function handleGoogle() {
    if (!googleEnabled) {
      setInlineMessage("Google sign-in is not available yet. Please use email and password.");
      return;
    }

    setGoogleLoading(true);
    setInlineMessage(null);
    try {
      const redirectPath = advisorIntent ? "/auth?intent=advisor" : "/auth";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${redirectPath}`,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error("Google sign-in could not be started.");
      window.location.assign(data.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign-in failed.";
      setInlineMessage(message);
      toast.error(message);
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setInlineMessage(null);
    if (mode === "signup" && !agreed) {
      setInlineMessage("Please agree to the community rules before creating an account.");
      return;
    }

    setFormLoading(true);
    try {
      if (mode === "signup") {
        const redirectPath = advisorIntent ? "/auth?intent=advisor" : "/auth";
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${redirectPath}`,
            data: {
              display_name: displayName.trim() || email.split("@")[0],
              ...(advisorIntent ? { onboarding_intent: "advisor" } : {}),
            },
          },
        });
        if (error) throw error;

        if (!data.session) {
          setInlineMessage(
            advisorIntent
              ? "Account created. Confirm your email, then sign in to continue to the advisor application."
              : "Account created. Check your email to confirm your address, then sign in.",
          );
          setMode("signin");
          setPassword("");
          return;
        }
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
      }

      await continueAfterAuth();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setInlineMessage(message);
      toast.error(message);
    } finally {
      setFormLoading(false);
    }
  }

  const busy = formLoading || googleLoading;

  return (
    <SiteLayout>
      <div className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="relative py-20">
          <div className="mx-auto max-w-md">
            <Eyebrow>
              {advisorIntent ? <UserRoundPlus className="h-3.5 w-3.5" /> : null}
              {advisorIntent ? "Advisor applicant access" : mode === "signup" ? "Create your account" : "Welcome back"}
            </Eyebrow>
            <h1 className="mt-4 text-4xl font-bold text-navy-deep">
              {advisorIntent
                ? "Sign in to continue your advisor application."
                : mode === "signup"
                  ? "Join BraverTogether."
                  : "Sign in to continue."}
            </h1>
            <p className="mt-3 text-navy-deep/70">
              {advisorIntent
                ? "Use the account you created through the advisor signup page. After signing in, you will go directly to the application portal."
                : mode === "signup"
                  ? "Ask advisors, follow conversations and manage meeting proposals in one account."
                  : "Access your messages, profile and meetings."}
            </p>

            {advisorIntent && (
              <div className="mt-5 rounded-2xl border border-teal/25 bg-teal/5 p-4 text-sm leading-relaxed text-navy-deep/70">
                Signing in does not automatically make an account an advisor. Advisor access is granted only after the BraverTogether team approves the application.
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-border bg-card/95 p-6 shadow-card backdrop-blur">
              <div className="grid grid-cols-2 rounded-xl bg-secondary p-1" aria-label="Account action">
                <button type="button" onClick={() => changeMode("signup")} className={cn("rounded-lg px-4 py-2.5 text-sm font-semibold transition", mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Create account</button>
                <button type="button" onClick={() => changeMode("signin")} className={cn("rounded-lg px-4 py-2.5 text-sm font-semibold transition", mode === "signin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Sign in</button>
              </div>

              <button type="button" onClick={handleGoogle} disabled={busy || !googleEnabled} className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border-2 border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy-deep transition hover:border-teal/50 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-55">
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}{googleEnabled ? "Continue with Google" : "Google sign-in coming soon"}
              </button>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" /> or use email <div className="h-px flex-1 bg-border" /></div>

              {inlineMessage && <div className="mb-4 rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground" role="status" aria-live="polite">{inlineMessage}</div>}

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "signup" && <Field icon={UserIcon} autoComplete="name" placeholder="Display name" value={displayName} onChange={setDisplayName} required />}
                <Field icon={Mail} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={setEmail} required />
                <Field icon={Lock} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Password — at least 8 characters" value={password} onChange={setPassword} required minLength={8} />

                {mode === "signup" && (
                  <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
                    <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5" />
                    <span>I agree to the <Link to="/advisors" className="font-semibold text-teal underline underline-offset-2">community rules</Link> and understand that the service provides educational information, not legal advice.</span>
                  </label>
                )}

                <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mesh px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-50">
                  {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{mode === "signup" ? "Create account" : advisorIntent ? "Sign in and continue application" : "Sign in"}
                </button>
              </form>

              <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
                {advisorIntent ? (
                  <>
                    Need an advisor applicant account?{" "}
                    <Link to="/advisor-signup" className="font-semibold text-teal underline underline-offset-4">Start advisor signup</Link>
                  </>
                ) : (
                  <>
                    Want to volunteer as an advisor?{" "}
                    <Link to="/advisor-signup" className="font-semibold text-teal underline underline-offset-4">Use advisor signup</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </SiteLayout>
  );
}

function Field({ icon: Icon, value, onChange, type = "text", placeholder, required, minLength, autoComplete }: { icon: React.ElementType; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean; minLength?: number; autoComplete?: string }) {
  return <div className="relative"><Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} minLength={minLength} autoComplete={autoComplete} className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-teal/40" /></div>;
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.09-1.93 3.27-4.76 3.27-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.28-1.93-6.14-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.86 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.36-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.68-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.68 2.84C6.72 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
