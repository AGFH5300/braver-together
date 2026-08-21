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
  recovery: z.literal("1").optional(),
});

type AuthMode = "signin" | "signup";
type SignupStep = "details" | "otp" | "password";
type RecoveryStep = "none" | "request" | "update";

type SignupDraft = {
  email: string;
  fullName: string;
  step: SignupStep;
  verifiedUserId?: string;
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
    const validStep =
      parsed.step === "details" ||
      parsed.step === "otp" ||
      parsed.step === "password";
    const validPasswordMarker =
      parsed.step !== "password" ||
      (typeof parsed.verifiedUserId === "string" && parsed.verifiedUserId.length > 0);

    if (
      typeof parsed.email === "string" &&
      typeof parsed.fullName === "string" &&
      validStep &&
      validPasswordMarker
    ) {
      return parsed as SignupDraft;
    }
  } catch {
    // Clear malformed or outdated signup state below.
  }

  window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
  return null;
}

function saveSignupDraft(draft: SignupDraft) {
  window.sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
}

function clearSignupDraft() {
  window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
}

function AuthPage() {
  const navigate = useNavigate();
  const getAccess = useServerFn(getAccountAccessState);
  const { mode: requestedMode, recovery: requestedRecovery } = Route.useSearch();

  const [mode, setMode] = useState<AuthMode>(requestedMode ?? "signup");
  const [signupStep, setSignupStep] = useState<SignupStep>("details");
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>(
    requestedRecovery === "1" ? "update" : "none",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(true);

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
      if (currentMode !== nextMode && recoveryStep === "none") {
        setInlineMessage(null);
      }
      return nextMode;
    });
  }, [requestedMode, recoveryStep]);

  useEffect(() => {
    let cancelled = false;
    const draft = readSignupDraft();
    const initialMode = new URLSearchParams(window.location.search).get("mode");
    const isRecoveryReturn = requestedRecovery === "1";

    if (!isRecoveryReturn && draft && initialMode !== "signin") {
      setEmail(draft.email);
      setFullName(draft.fullName);

      // OTP can safely be restored. The password step is restored only after
      // the current Supabase session is proven to match the verified user.
      if (draft.step === "otp") {
        setSignupStep("otp");
        setMode("signup");
      } else if (draft.step === "details") {
        setSignupStep("details");
      }
    } else if (!isRecoveryReturn && initialMode === "signin") {
      clearSignupDraft();
    }

    async function hydrate() {
      try {
        if (isRecoveryReturn) {
          setMode("signin");
          setRecoveryStep("update");
          clearSignupDraft();

          const { data, error } = await supabase.auth.getSession();
          if (cancelled) return;
          if (error || !data.session?.user) {
            setRecoveryStep("request");
            setInlineMessage(
              "This password reset link is invalid or has expired. Request a new reset email below.",
            );
          }
          return;
        }

        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error && !data.user) return;
        if (!data.user) return;

        const signupCompleted = data.user.user_metadata?.signup_completed;
        if (signupCompleted !== false) {
          await continueAfterAuth();
          return;
        }

        const verifiedDraft =
          draft?.step === "password" &&
          draft.verifiedUserId === data.user.id &&
          draft.email.toLowerCase() === (data.user.email ?? "").toLowerCase();

        if (!verifiedDraft) {
          // An unfinished/stale auth session is not proof that the OTP was
          // verified in this signup flow. Never expose password creation from it.
          await supabase.auth.signOut();
          clearSignupDraft();
          setMode(requestedMode ?? "signup");
          setSignupStep("details");
          setEmail("");
          setFullName("");
          setInlineMessage(null);
          return;
        }

        const recoveredName =
          draft.fullName ||
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.display_name ||
          "";

        setMode("signup");
        setSignupStep("password");
        setEmail(draft.email);
        setFullName(recoveredName);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [continueAfterAuth, requestedMode, requestedRecovery]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function changeMode(nextMode: AuthMode) {
    if (
      recoveryStep === "none" &&
      nextMode === mode &&
      (nextMode === "signin" || signupStep === "details")
    ) {
      return;
    }

    if (signupStep === "password" || recoveryStep === "update") {
      await supabase.auth.signOut();
    }

    setRecoveryStep("none");
    setMode(nextMode);
    setSignupStep("details");
    setInlineMessage(null);
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setAgreed(false);
    clearSignupDraft();

    await navigate({
      to: "/auth",
      search: { mode: nextMode, recovery: undefined },
      replace: true,
    });
  }

  function openRecoveryRequest() {
    setMode("signin");
    setRecoveryStep("request");
    setPassword("");
    setConfirmPassword("");
    setInlineMessage(null);
  }

  async function backToSignIn() {
    if (recoveryStep === "update") await supabase.auth.signOut();
    setRecoveryStep("none");
    setMode("signin");
    setPassword("");
    setConfirmPassword("");
    setInlineMessage(null);

    await navigate({
      to: "/auth",
      search: { mode: "signin", recovery: undefined },
      replace: true,
    });
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
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: otp,
        type: "email",
      });
      if (error) throw error;
      if (!data.user || !data.session) {
        throw new Error("Email verification did not create a session.");
      }

      if (data.user.user_metadata?.signup_completed !== false) {
        await supabase.auth.signOut();
        clearSignupDraft();
        setMode("signin");
        setSignupStep("details");
        setOtp("");
        setPassword("");
        setInlineMessage(
          "This email already has an account. Sign in with your existing password.",
        );
        await navigate({
          to: "/auth",
          search: { mode: "signin", recovery: undefined },
          replace: true,
        });
        return;
      }

      const verifiedName =
        fullName.trim() ||
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.display_name ||
        "";

      setFullName(verifiedName);
      setSignupStep("password");
      saveSignupDraft({
        email: normalizedEmail,
        fullName: verifiedName,
        step: "password",
        verifiedUserId: data.user.id,
      });
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
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth?mode=signup`,
          data: {
            display_name: fullName.trim(),
            full_name: fullName.trim(),
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
      const draft = readSignupDraft();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user;

      if (
        sessionError ||
        !sessionUser ||
        draft?.step !== "password" ||
        !draft.verifiedUserId ||
        draft.verifiedUserId !== sessionUser.id ||
        sessionUser.user_metadata?.signup_completed !== false
      ) {
        await supabase.auth.signOut();
        clearSignupDraft();
        setSignupStep("details");
        setPassword("");
        setConfirmPassword("");
        throw new Error(
          "Your verified signup session is no longer valid. Please verify your email again.",
        );
      }

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

      clearSignupDraft();
      toast.success("Member account created");
      await continueAfterAuth();
    } catch (error) {
      showError(error, "Your password could not be saved.");
    } finally {
      setFormLoading(false);
    }
  }

  async function signIn() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setInlineMessage("Enter your email address and password.");
      return;
    }

    setFormLoading(true);
    setInlineMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;

      if (data.user?.user_metadata?.signup_completed === false) {
        await supabase.auth.signOut();
        throw new Error(
          "This account setup is incomplete. Use Create account to verify your email and finish registration.",
        );
      }

      toast.success("Signed in");
      await continueAfterAuth();
    } catch (error) {
      showError(error, "Sign-in failed.");
    } finally {
      setFormLoading(false);
    }
  }

  async function requestPasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setInlineMessage("Please enter your email address.");
      return;
    }

    setFormLoading(true);
    setInlineMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth?mode=signin&recovery=1`,
      });
      if (error) throw error;
      setEmail(normalizedEmail);
      setInlineMessage(
        "If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.",
      );
    } catch (error) {
      showError(error, "The password reset email could not be sent.");
    } finally {
      setFormLoading(false);
    }
  }

  async function updateRecoveredPassword() {
    if (password.length < 8) {
      setInlineMessage("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setInlineMessage("Passwords do not match.");
      return;
    }

    setFormLoading(true);
    setInlineMessage(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        throw new Error(
          "This password reset session is no longer valid. Request a new reset email.",
        );
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      setRecoveryStep("none");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      toast.success("Password updated");
      setInlineMessage(
        "Your password has been updated. Sign in with your new password.",
      );
      await navigate({
        to: "/auth",
        search: { mode: "signin", recovery: undefined },
        replace: true,
      });
    } catch (error) {
      showError(error, "Your password could not be updated.");
    } finally {
      setFormLoading(false);
    }
  }

  function showError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    setInlineMessage(message);
    toast.error(message);
  }

  const busy = formLoading || hydrating;
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const heading = getHeading(mode, signupStep, recoveryStep);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (recoveryStep === "request") void requestPasswordReset();
    else if (recoveryStep === "update") void updateRecoveredPassword();
    else if (mode === "signin") void signIn();
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
              {recoveryStep === "none" ? (
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
              ) : (
                <button
                  type="button"
                  onClick={() => void backToSignIn()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </button>
              )}

              {recoveryStep === "none" && signupStep === "otp" && (
                <SignupProgress current={2} />
              )}
              {recoveryStep === "none" && signupStep === "password" && (
                <SignupProgress current={3} />
              )}

              {inlineMessage && (
                <div
                  className="mb-4 mt-4 rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {inlineMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                {recoveryStep === "request" && (
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
                )}

                {recoveryStep === "update" && (
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

                {recoveryStep === "none" && mode === "signup" && signupStep === "details" && (
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

                {recoveryStep === "none" && mode === "signup" && signupStep === "otp" && (
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

                {recoveryStep === "none" && mode === "signup" && signupStep === "password" && (
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

                {recoveryStep === "none" && mode === "signin" && (
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
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={openRecoveryRequest}
                        disabled={busy}
                        className="text-xs font-semibold text-teal hover:underline disabled:opacity-50"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={
                    busy ||
                    (recoveryStep === "update" &&
                      (!passwordsMatch || password.length < 8)) ||
                    (recoveryStep === "none" &&
                      mode === "signup" &&
                      signupStep === "otp" &&
                      otp.length !== OTP_LENGTH) ||
                    (recoveryStep === "none" &&
                      mode === "signup" &&
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
                  {submitLabel(mode, signupStep, recoveryStep, formLoading)}
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
        Code sent to <span className="font-semibold text-foreground">{email}</span>
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

function getHeading(
  mode: AuthMode,
  step: SignupStep,
  recoveryStep: RecoveryStep,
) {
  if (recoveryStep === "request") {
    return {
      eyebrow: "Account recovery",
      title: "Reset your password.",
      description:
        "Enter your email and we’ll send a secure password reset link if an account exists.",
    };
  }
  if (recoveryStep === "update") {
    return {
      eyebrow: "Account recovery",
      title: "Choose a new password.",
      description: "Create a new password for your BraverTogether account.",
    };
  }
  if (mode === "signin") {
    return {
      eyebrow: "Welcome back",
      title: "Sign in to continue.",
      description: "Access your messages, meetings and profile.",
    };
  }
  if (step === "otp") {
    return {
      eyebrow: "Email verification",
      title: "Check your inbox.",
      description: "Enter the six-digit code to verify your email address.",
    };
  }
  if (step === "password") {
    return {
      eyebrow: "Set your password",
      title: "Finish your account.",
      description:
        "Create a secure password for your BraverTogether member account.",
    };
  }
  return {
    eyebrow: "Create your member account",
    title: "Join BraverTogether.",
    description:
      "Join as a member to ask advisors, follow conversations and enter competitions.",
  };
}

function submitLabel(
  mode: AuthMode,
  step: SignupStep,
  recoveryStep: RecoveryStep,
  loading: boolean,
) {
  if (recoveryStep === "request") {
    return loading ? "Sending reset link..." : "Send password reset link";
  }
  if (recoveryStep === "update") {
    return loading ? "Updating password..." : "Update password";
  }
  if (loading) {
    return mode === "signin"
      ? "Signing in..."
      : step === "details"
        ? "Sending code..."
        : step === "otp"
          ? "Verifying..."
          : "Creating account...";
  }
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
