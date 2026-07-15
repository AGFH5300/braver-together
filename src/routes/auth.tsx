import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User as UserIcon, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — BraverTogether" },
      {
        name: "description",
        content: "Sign in or create an account to message advisors and book calls.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/messages" });
    });
  }, [navigate]);

  async function handleGoogle() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });

    if (error) {
      toast.error(error.message || "Google sign-in failed");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !agreed) {
      toast.error("Please agree to the community rules");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;

        if (!data.session) {
          toast.success("Account created. Check your email to confirm your address.");
          setMode("signin");
          return;
        }

        toast.success("Account created!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      navigate({ to: "/messages" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteLayout>
      <div className="bg-hero relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="py-20 relative">
          <div className="max-w-md mx-auto">
            <Eyebrow>{mode === "signup" ? "Create your account" : "Welcome back"}</Eyebrow>
            <h1 className="mt-4 text-4xl font-bold text-navy-deep">
              {mode === "signup" ? "Join BraverTogether." : "Sign in."}
            </h1>
            <p className="mt-3 text-navy-deep/70">
              {mode === "signup"
                ? "Message verified advisors, book calls, and keep your conversations in one place."
                : "Pick up where you left off."}
            </p>

            <div className="mt-8 rounded-2xl border border-border bg-card/95 backdrop-blur p-6 shadow-card">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-secondary transition disabled:opacity-50"
              >
                <GoogleIcon /> Continue with Google
              </button>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> or email{" "}
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "signup" && (
                  <Field
                    icon={UserIcon}
                    autoComplete="name"
                    placeholder="Display name (e.g. Tara V.)"
                    value={displayName}
                    onChange={setDisplayName}
                  />
                )}
                <Field
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={setEmail}
                  required
                />
                <Field
                  icon={Lock}
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="Password (min. 8 characters)"
                  value={password}
                  onChange={setPassword}
                  required
                  minLength={8}
                />

                {mode === "signup" && (
                  <label className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(event) => setAgreed(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      I agree to the{" "}
                      <Link to="/advisors" className="text-teal font-semibold underline">
                        community rules
                      </Link>{" "}
                      and understand that messages with advisors are educational and not legal
                      advice.
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-mesh text-white px-4 py-2.5 text-sm font-semibold shadow-glow hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {mode === "signup" ? "Create account" : "Sign in"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                {mode === "signup"
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </button>
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
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.09-1.93 3.27-4.76 3.27-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.28-1.93-6.14-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.86 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.36-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.68-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.68 2.84C6.72 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
