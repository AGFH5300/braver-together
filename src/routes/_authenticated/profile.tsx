import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Calendar, KeyRound, Loader2, Lock, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { unlockAdvisor } from "@/lib/advisor.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

type ProfileForm = {
  display_name: string;
  headline: string;
  bio: string;
  focus_areas: string;
  calendly_url: string;
  accepting_messages: boolean;
  is_advisor: boolean;
  is_public: boolean;
};

const EMPTY_PROFILE: ProfileForm = {
  display_name: "",
  headline: "",
  bio: "",
  focus_areas: "",
  calendly_url: "",
  accepting_messages: true,
  is_advisor: false,
  is_public: false,
};

function normalizeBookingUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const url = new URL(trimmed);
  if (url.protocol !== "https:") {
    throw new Error("The booking link must use HTTPS");
  }
  return url.toString();
}

function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Your session has expired. Please sign in again.");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (error) throw error;

      if (data) {
        setForm({
          display_name: data.display_name ?? "",
          headline: data.headline ?? "",
          bio: data.bio ?? "",
          focus_areas: (data.focus_areas ?? []).join(", "),
          calendly_url: data.calendly_url ?? "",
          accepting_messages: data.accepting_messages ?? true,
          is_advisor: data.is_advisor ?? false,
          is_public: data.is_public ?? false,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load your profile");
    } finally {
      setLoading(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Your session has expired. Please sign in again.");

      const focusAreas = form.focus_areas
        .split(",")
        .map((area) => area.trim())
        .filter(Boolean)
        .slice(0, 12);
      const bookingUrl = normalizeBookingUrl(form.calendly_url);

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: form.display_name.trim(),
          headline: form.headline.trim() || null,
          bio: form.bio.trim() || null,
          focus_areas: focusAreas,
          calendly_url: bookingUrl,
          accepting_messages: form.accepting_messages,
          is_public: form.is_advisor ? form.is_public : false,
        })
        .eq("id", authData.user.id);
      if (error) throw error;

      setForm((current) => ({
        ...current,
        display_name: current.display_name.trim(),
        headline: current.headline.trim(),
        bio: current.bio.trim(),
        calendly_url: bookingUrl ?? "",
        focus_areas: focusAreas.join(", "),
      }));
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SiteLayout>
        <Section className="py-20 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </Section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="bg-hero">
        <Section className="py-14">
          <Eyebrow>Your profile</Eyebrow>
          <h1 className="mt-3 text-4xl font-bold text-navy-deep">Profile settings</h1>
          <p className="mt-2 text-navy-deep/70 max-w-xl">
            This is how others see you on BraverTogether. Advisors can publish a profile and add
            a secure booking link.
          </p>
        </Section>
      </div>

      <Section className="py-12">
        <form onSubmit={save} className="max-w-2xl space-y-5">
          <Field
            label="Display name"
            value={form.display_name}
            onChange={(value) => setForm((current) => ({ ...current, display_name: value }))}
            required
            maxLength={80}
          />
          <Field
            label="Headline"
            placeholder="e.g. Law student • Data privacy focus"
            value={form.headline}
            onChange={(value) => setForm((current) => ({ ...current, headline: value }))}
            maxLength={160}
          />
          <Field
            label="Bio"
            textarea
            value={form.bio}
            onChange={(value) => setForm((current) => ({ ...current, bio: value }))}
            placeholder="Short intro shown on your public profile"
            maxLength={1200}
          />
          <Field
            label="Focus areas (comma-separated)"
            value={form.focus_areas}
            onChange={(value) => setForm((current) => ({ ...current, focus_areas: value }))}
            placeholder="Data Privacy, Cyberbullying, Copyright"
            maxLength={600}
          />

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-teal" />
              <div className="font-display font-bold">Advisor settings</div>
            </div>

            {!form.is_advisor ? (
              <AdvisorUnlock
                onUnlocked={() => setForm((current) => ({ ...current, is_advisor: true }))}
              />
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-teal/10 border border-teal/30 px-3 py-2 text-xs text-navy-deep">
                  <ShieldCheck className="h-4 w-4 text-teal" />
                  Advisor mode unlocked. Complete your profile below.
                </div>
                <Toggle
                  label="Publish my profile"
                  desc="Make my advisor profile visible to teens"
                  checked={form.is_public}
                  onChange={(value) => setForm((current) => ({ ...current, is_public: value }))}
                />
                <Toggle
                  label="Accepting messages"
                  desc="Teens can start new conversations with me"
                  checked={form.accepting_messages}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, accepting_messages: value }))
                  }
                />
                <Field
                  label="Booking URL"
                  type="url"
                  placeholder="https://calendly.com/your-handle/intro-call"
                  value={form.calendly_url}
                  onChange={(value) => setForm((current) => ({ ...current, calendly_url: value }))}
                  icon={Calendar}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  Paste an HTTPS booking link. A “Book a call” button will appear on your profile
                  and inside conversations.
                </p>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-mesh text-white px-6 py-3 font-semibold shadow-glow hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save profile
          </button>
        </form>
      </Section>
    </SiteLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  textarea,
  icon: Icon,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  textarea?: boolean;
  icon?: React.ElementType;
  type?: React.HTMLInputTypeAttribute;
  maxLength?: number;
}) {
  const className = `w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 ${Icon ? "pl-10" : ""}`;

  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1.5">{label}</span>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />}
        {textarea ? (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            required={required}
            rows={4}
            maxLength={maxLength}
            className={className}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            required={required}
            maxLength={maxLength}
            className={className}
          />
        )}
      </div>
    </label>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </label>
  );
}

function AdvisorUnlock({ onUnlocked }: { onUnlocked: () => void }) {
  const unlock = useServerFn(unlockAdvisor);
  const [passcode, setPasscode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedPasscode = passcode.trim();
    if (!normalizedPasscode) return;

    setSubmitting(true);
    try {
      const result = await unlock({ data: { passcode: normalizedPasscode } });
      if (result.ok) {
        toast.success("Advisor mode unlocked");
        onUnlocked();
        setPasscode("");
      } else {
        toast.error("Incorrect passcode");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify passcode");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-secondary/60 border border-border px-3 py-2.5 text-xs text-muted-foreground">
        <Lock className="h-4 w-4 text-teal mt-0.5 shrink-0" />
        <span>
          Advisor mode is invite-only. Enter the passcode BraverTogether sent you to enable your
          public advisor profile.
        </span>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="password"
            autoComplete="off"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            placeholder="Advisor passcode"
            maxLength={200}
            className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !passcode.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-deep text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          Unlock
        </button>
      </form>
    </div>
  );
}
