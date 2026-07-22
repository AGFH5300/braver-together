import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  RotateCcw,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AdvisorIntentTrigger } from "@/components/AdvisorIntentDialog";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { Eyebrow, Section, SiteLayout } from "@/components/SiteLayout";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { roleHome } from "@/lib/account-access";
import { getAccountAccessState } from "@/lib/account-access.functions";
import { cn } from "@/lib/utils";

const AuthSearch = z.object({
  mode: z.enum(["signup", "signin"]).optional(),
});

type AuthMode = "signin" | "signup";
type SignupStep = "details" | "otp" | "password";

type SignupDraft = {
  email: string;
  fullName: string;
  step: SignupStep;
};

const SIGNUP_DRAFT_KEY = "braver_together_signup";
const OTP_LENGTH = 6;
const RESEND_DELAY_SECONDS = 60;

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => AuthSearch.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in — BraverTogether" },
      {
        name: "description",
        content: "Create or sign in to your BraverTogether member account.",
      },
    ],
  }),
  component: AuthPage,
});

function readSignupDraft(): SignupDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SIGNUP_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SignupDraft>;
    if (
      typeof parsed.email === "string" &&
      typeof parsed.fullName === "string" &&
      (parsed.step === "details" ||
        parsed.step === "otp" ||
        parsed.step === "password")
    ) {
      return parsed as SignupDraft;
    }
  } catch {
    window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
  }
  return null;
}

function saveSignupDraft(draft: SignupDraft) {
  window.sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
}

function AuthPage() {
  const navigate = useNavigate();
  const getAccess = useServerFn(getAccountAccessState);
  const { mode: requestedMode } = Route.useSearch();
  const [mode, setMode] = useState<AuthMode>(requestedMode ?? "signup");
  const [signupStep, setSignupStep] = useState<SignupStep>("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const googleEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true";

  const continueAfterAuth = useCallback(async () => {
    const access = await getAccess();
    await navigate({
      to: roleHome(access.role),
      ...(access.role === "member" || access.role === "advisor"
        ? { search: { c: undefined, view: undefined } }
        : {}),
      replace: true,
    });
  }, [getAccess, navigate]);

  useEffect(() => {
    const nextMode = requestedMode ?? "signup";
    setMode((currentMode) => {
      if (currentMode !== nextMode) setInlineMessage(null);
      return nextMode;
    });
  }, [requestedMode]);

  useEffect(() => {
    let cancelled = false;
    const draft = readSignupDraft();
    const initialMode = new URLSearchParams(window.location.search).get("mode");
    if (draft && initialMode !== "signin") {
      setEmail(draft.email);
      setFullName(draft.fullName);
      setSignupStep(draft.step);
      if (draft.step !== "details") setMode("signup");
    } else if (draft?.step !== "password" && initialMode === "signin") {
      window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
    }

    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const unfinishedSignup =
        data.user?.user_metadata?.signup_completed === false;
      if (data.user && (draft?.step === "password" || unfinishedSignup)) {
        const recoveredName =
          draft?.fullName ||
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.display_name ||
          "";
        setMode("signup");
        setSignupStep("password");
        setEmail(draft?.email || data.user.email || "");
        setFullName(recoveredName);
        if (data.user.email) {
          saveSignupDraft({
            email: data.user.email,
            fullName: recoveredName,
            step: "password",
          });
        }
      } else if (data.user) {
        void continueAfterAuth();
      }
      setHydrating(false);
    });

    const resetTransientState = () => setGoogleLoading(false);
    window.addEventListener("pageshow", resetTransientState);
    document.addEventListener("visibilitychange", resetTransientState);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", resetTransientState);
      document.removeEventListener("visibilitychange", resetTransientState);
    };
  }, [continueAfterAuth]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function changeMode(nextMode: AuthMode) {
    if (
      nextMode === mode &&
      (nextMode === "signin" || signupStep === "details")
    )
      return;
    if (signupStep === "password") await supabase.auth.signOut();
    setMode(nextMode);
    setSignupStep("details");
    setInlineMessage(null);
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
    await navigate({ to: "/auth", search: { mode: nextMode }, replace: true });
  }

  async function handleGoogle() {
    if (!googleEnabled) {
      setInlineMessage(
        "Google sign-in is not available yet. Please use email and password.",
      );
      return;
    }

    setGoogleLoading(true);
    setInlineMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth?mode=signin`,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error("Google sign-in could not be started.");
      window.location.assign(data.url);
    } catch (error) {
      showError(error, "Google sign-in failed.");
      setGoogleLoading(false);
    }
  }

  async function sendSignupOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();
    if (!normalizedName) {
      setInlineMessage("Please enter your full name.");
      return;
    }
    if (!normalizedEmail) {
      setInlineMessage("Please enter your email address.");
      return;
    }
    if (!agreed) {
      setInlineMessage(
        "Please agree to the community rules before creating an account.",
      );
      return;
    }

    setFormLoading(true);
    setInlineMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth?mode=signup`,
          data: {
            display_name: normalizedName,
            full_name: normalizedName,
            signup_completed: false,
          },
        },
      });
      if (error) throw error;
      setEmail(normalizedEmail);
      setFullName(normalizedName);
      setOtp("");
      setSignupStep("otp");
      setResendSeconds(RESEND_DELAY_SECONDS);
      saveSignupDraft({
        email: normalizedEmail,
        fullName: normalizedName,
        step: "otp",
      });
      setInlineMessage(
        `We sent a ${OTP_LENGTH}-digit verification code to ${normalizedEmail}.`,
      );
    } catch (error) {
      showError(error, "The verification code could not be sent.");
    } finally {
      setFormLoading(false);
    }
  }

  async function verifySignupOtp() {
    if (!/^\d{6}$/.test(otp)) {
      setInlineMessage("Enter the complete 6-digit verification code.");
      return;
    }

    setFormLoading(true);
    setInlineMessage(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: "email",
      });
      if (error) throw error;
      if (!data.user || !data.session)
        throw new Error("Email verification did not create a session.");

      if (data.user.user_metadata?.signup_completed !== false) {
        await supabase.auth.signOut();
        window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
        setMode("signin");
        setSignupStep("details");
        setOtp("");
        setPassword("");
        setInlineMessage(
          "This email already has an account. Sign in with your existing password.",
        );
        await navigate({
          to: "/auth",
          search: { mode: "signin" },
          replace: true,
        });
        return;
      }

      setSignupStep("password");
      saveSignupDraft({ email, fullName, step: "password" });
      setInlineMessage(
        "Email verified. Create your password to finish setting up your member account.",
      );
    } catch (error) {
      showError(error, "The verification code is invalid or has expired.");
    } finally {
      setFormLoading(false);
    }
  }

  async function resendSignupOtp() {
    if (resendSeconds > 0 || formLoading) return;
    setFormLoading(true);
    setInlineMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth?mode=signup`,
          data: {
            display_name: fullName,
            full_name: fullName,
            signup_completed: false,
          },
        },
      });
      if (error) throw error;
      setResendSeconds(RESEND_DELAY_SECONDS);
      setInlineMessage(
        `A new ${OTP_LENGTH}-digit code has been sent to ${email}.`,
      );
    } catch (error) {
      showError(error, "A new verification code could not be sent.");
    } finally {
      setFormLoading(false);
    }
  }

  async function setSignupPassword() {
    if (password.length < 8) {
      setInlineMessage("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setInlineMessage("Passwords do not match.");
      return;
    }

    setFormLoading(true);
    setInlineMessage(null);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
        data: {
          display_name: fullName.trim(),
          full_name: fullName.trim(),
          signup_completed: true,
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Your account could not be completed.");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: fullName.trim() })
        .eq("id", data.user.id);
      if (profileError) throw profileError;

      window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
      toast.success("Member account created");
      await continueAfterAuth();
    } catch (error) {
      showError(error, "Your password could not be saved.");
    } finally {
      setFormLoading(false);
    }
  }

  async function signIn() {
    setFormLoading(true);
    setInlineMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      toast.success("Signed in");
      await continueAfterAuth();
    } catch (error) {
      showError(error, "Sign-in failed.");
    } finally {
      setFormLoading(false);
    }
  }

  function showError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    setInlineMessage(message);
    toast.error(message);
  }

  const busy = formLoading || googleLoading || hydrating;
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const heading = getHeading(mode, signupStep);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "signin") void signIn();
    else if (signupStep === "details") void sendSignupOtp();
    else if (signupStep === "otp") void verifySignupOtp();
    else void setSignupPassword();
  }

  return (
    <SiteLayout>
      <div className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="relative py-20">
          <div className="mx-auto max-w-md">
            <Eyebrow>{heading.eyebrow}</Eyebrow>
            <h1 className="mt-4 text-4xl font-bold text-navy-deep">
              {heading.title}
            </h1>
            <p className="mt-3 text-navy-deep/70">{heading.description}</p>

            <div className="mt-8 rounded-2xl border border-border bg-card/95 p-6 shadow-card backdrop-blur">
              <div
                className="grid grid-cols-2 rounded-xl bg-secondary p-1"
                aria-label="Account action"
              >
                <button
                  type="button"
                  onClick={() => void changeMode("signup")}
                  className={tabClass(mode === "signup")}
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => void changeMode("signin")}
                  className={tabClass(mode === "signin")}
                >
                  Sign in
                </button>
              </div>

              {signupStep === "details" && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={busy || !googleEnabled}
                    className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border-2 border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy-deep transition hover:border-teal/50 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {googleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    {googleEnabled
                      ? "Continue with Google"
                      : "Google sign-in coming soon"}
                  </button>
                  <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="h-px flex-1 bg-border" /> or use email{" "}
                    <div className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}

              {signupStep === "otp" && <SignupProgress current={2} />}
              {signupStep === "password" && <SignupProgress current={3} />}

              {inlineMessage && (
                <div
                  className="mb-4 mt-4 rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {inlineMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "signup" && signupStep === "details" && (
                  <>
                    <Field
                      icon={UserIcon}
                      autoComplete="name"
                      placeholder="Full name"
                      value={fullName}
                      onChange={setFullName}
                      required
                      disabled={busy}
                    />
                    <Field
                      icon={Mail}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={setEmail}
                      required
                      disabled={busy}
                    />
                    <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(event) => setAgreed(event.target.checked)}
                        className="mt-0.5"
                        disabled={busy}
                      />
                      <span>
                        I agree to the{" "}
                        <Link
                          to="/advisors"
                          className="font-semibold text-teal underline underline-offset-2"
                        >
                          community rules
                        </Link>{" "}
                        and understand that the service provides educational
                        information, not legal advice.
                      </span>
                    </label>
                  </>
                )}

                {mode === "signup" && signupStep === "otp" && (
                  <OtpStep
                    email={email}
                    otp={otp}
                    onOtpChange={setOtp}
                    disabled={busy}
                    resendSeconds={resendSeconds}
                    onResend={() => void resendSignupOtp()}
                    onChangeEmail={() => {
                      setSignupStep("details");
                      setOtp("");
                      setInlineMessage(null);
                      saveSignupDraft({ email, fullName, step: "details" });
                    }}
                  />
                )}

                {mode === "signup" && signupStep === "password" && (
                  <PasswordStep
                    password={password}
                    confirmPassword={confirmPassword}
                    showPassword={showPassword}
                    showConfirmPassword={showConfirmPassword}
                    setPassword={setPassword}
                    setConfirmPassword={setConfirmPassword}
                    setShowPassword={setShowPassword}
                    setShowConfirmPassword={setShowConfirmPassword}
                    passwordsMatch={passwordsMatch}
                    disabled={busy}
                  />
                )}

                {mode === "signin" && (
                  <>
                    <Field
                      icon={Mail}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={setEmail}
                      required
                      disabled={busy}
                    />
                    <PasswordField
                      value={password}
                      onChange={setPassword}
                      show={showPassword}
                      onToggle={() => setShowPassword((current) => !current)}
                      autoComplete="current-password"
                      placeholder="Password"
                      disabled={busy}
                    />
                  </>
                )}

                <button
                  type="submit"
                  disabled={
                    busy ||
                    (mode === "signup" &&
                      signupStep === "otp" &&
                      otp.length !== OTP_LENGTH) ||
                    (mode === "signup" &&
                      signupStep === "password" &&
                      (!passwordsMatch || password.length < 8))
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mesh px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {formLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {submitLabel(mode, signupStep, formLoading)}
                </button>
              </form>

              <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
                Interested in volunteering?{" "}
                <AdvisorIntentTrigger className="font-semibold text-teal underline underline-offset-4">
                  Learn how advisor applications work
                </AdvisorIntentTrigger>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </SiteLayout>
  );
}

function OtpStep({
  email,
  otp,
  onOtpChange,
  disabled,
  resendSeconds,
  onResend,
  onChangeEmail,
}: {
  email: string;
  otp: string;
  onOtpChange: (value: string) => void;
  disabled: boolean;
  resendSeconds: number;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-3 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Verification code
        </label>
        <InputOTP
          maxLength={OTP_LENGTH}
          value={otp}
          onChange={onOtpChange}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          containerClassName="justify-center"
        >
          <InputOTPGroup>
            {Array.from({ length: OTP_LENGTH }).map((_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="h-12 w-11 border-border bg-background text-base first:rounded-l-xl last:rounded-r-xl"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <button
          type="button"
          onClick={onChangeEmail}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 font-semibold text-teal hover:underline disabled:opacity-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Change email
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={disabled || resendSeconds > 0}
          className="inline-flex items-center gap-1.5 font-semibold text-teal hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Code sent to{" "}
        <span className="font-semibold text-foreground">{email}</span>
      </p>
    </div>
  );
}

function PasswordStep({
  password,
  confirmPassword,
  showPassword,
  showConfirmPassword,
  setPassword,
  setConfirmPassword,
  setShowPassword,
  setShowConfirmPassword,
  passwordsMatch,
  disabled,
}: {
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  setShowPassword: (value: boolean) => void;
  setShowConfirmPassword: (value: boolean) => void;
  passwordsMatch: boolean;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <PasswordField
          value={password}
          onChange={setPassword}
          show={showPassword}
          onToggle={() => setShowPassword(!showPassword)}
          autoComplete="new-password"
          placeholder="Password — at least 8 characters"
          disabled={disabled}
        />
        <PasswordStrengthMeter password={password} />
      </div>
      <div>
        <PasswordField
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirmPassword}
          onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
          autoComplete="new-password"
          placeholder="Confirm password"
          disabled={disabled}
        />
        {confirmPassword && (
          <p
            className={cn(
              "mt-2 flex items-center gap-1.5 text-xs",
              passwordsMatch ? "text-green-700" : "text-red-700",
            )}
          >
            {passwordsMatch && <CheckCircle2 className="h-3.5 w-3.5" />}
            {passwordsMatch ? "Passwords match." : "Passwords do not match."}
          </p>
        )}
      </div>
    </div>
  );
}

function SignupProgress({ current }: { current: 2 | 3 }) {
  return (
    <div
      className="my-5 grid grid-cols-3 gap-2"
      aria-label={`Signup step ${current} of 3`}
    >
      {["Details", "Verify", "Password"].map((label, index) => (
        <div key={label} className="text-center">
          <div
            className={cn(
              "h-1.5 rounded-full",
              index + 1 <= current ? "bg-teal" : "bg-secondary",
            )}
          />
          <span
            className={cn(
              "mt-1.5 block text-[10px] font-semibold uppercase tracking-wider",
              index + 1 === current ? "text-teal" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Field({
  icon: Icon,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  autoComplete,
  disabled,
}: {
  icon: React.ElementType;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
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
        autoComplete={autoComplete}
        disabled={disabled}
        className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-teal/40 disabled:opacity-60"
      />
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        minLength={8}
        autoComplete={autoComplete}
        disabled={disabled}
        className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-11 text-sm outline-none focus:ring-2 focus:ring-teal/40 disabled:opacity-60"
      />
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-navy-deep disabled:opacity-50"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function getHeading(mode: AuthMode, step: SignupStep) {
  if (mode === "signin")
    return {
      eyebrow: "Welcome back",
      title: "Sign in to continue.",
      description: "Access your messages, meetings and profile.",
    };
  if (step === "otp")
    return {
      eyebrow: "Email verification",
      title: "Check your inbox.",
      description: "Enter the six-digit code to verify your email address.",
    };
  if (step === "password")
    return {
      eyebrow: "Set your password",
      title: "Finish your account.",
      description:
        "Create a secure password for your BraverTogether member account.",
    };
  return {
    eyebrow: "Create your member account",
    title: "Join BraverTogether.",
    description:
      "Join as a member to ask advisors, follow conversations and enter competitions.",
  };
}

function submitLabel(mode: AuthMode, step: SignupStep, loading: boolean) {
  if (loading)
    return mode === "signin"
      ? "Signing in..."
      : step === "details"
        ? "Sending code..."
        : step === "otp"
          ? "Verifying..."
          : "Creating account...";
  if (mode === "signin") return "Sign in";
  if (step === "details") return "Send verification code";
  if (step === "otp") return "Verify code";
  return "Set password and continue";
}

function tabClass(active: boolean) {
  return cn(
    "rounded-lg px-4 py-2.5 text-sm font-semibold transition",
    active
      ? "bg-card text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground",
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
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
