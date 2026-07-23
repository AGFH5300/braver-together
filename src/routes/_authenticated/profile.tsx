import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, Calendar, Loader2, Save, ShieldCheck, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import type { EffectiveAccountRole } from "@/lib/account-access";
import { getAccountAccessState } from "@/lib/account-access.functions";

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
  availability_status: "available" | "busy" | "offline";
  max_active_conversations: number;
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
  availability_status: "offline",
  max_active_conversations: 5,
};

function normalizeBookingUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const url = new URL(trimmed);
  if (url.protocol !== "https:") throw new Error("The booking link must use HTTPS.");
  return url.toString();
}

function ProfilePage() {
  const getAccess = useServerFn(getAccountAccessState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE);
  const [accountRole, setAccountRole] = useState<EffectiveAccountRole>("member");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const [{ data: authData, error: authError }, access] = await Promise.all([
        supabase.auth.getUser(),
        getAccess(),
      ]);
      if (authError) throw authError;
      if (!authData.user) throw new Error("Your session has expired. Please sign in again.");
      setAccountRole(access.role);

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, headline, bio, focus_areas, calendly_url, accepting_messages, is_advisor, is_public, availability_status, max_active_conversations")
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
          is_advisor: access.role === "advisor",
          is_public: data.is_public ?? false,
          availability_status: (data.availability_status as ProfileForm["availability_status"]) ?? "offline",
          max_active_conversations: data.max_active_conversations ?? 5,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your profile could not be loaded.");
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

      const focusAreas = form.focus_areas.split(",").map((area) => area.trim()).filter(Boolean).slice(0, 12);
      const bookingUrl = normalizeBookingUrl(form.calendly_url);
      const common = {
        display_name: form.display_name.trim(),
        headline: form.headline.trim() || null,
        bio: form.bio.trim() || null,
        focus_areas: focusAreas,
        calendly_url: bookingUrl,
      };
      const advisorSettings = accountRole === "advisor" ? {
        accepting_messages: form.accepting_messages,
        is_public: form.is_public,
        availability_status: form.availability_status,
        max_active_conversations: form.max_active_conversations,
        last_seen_at: new Date().toISOString(),
      } : {};

      const { error } = await supabase.from("profiles").update({ ...common, ...advisorSettings }).eq("id", authData.user.id);
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
      toast.error(error instanceof Error ? error.message : "Your profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SiteLayout><Section className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></Section></SiteLayout>;
  }

  return (
    <SiteLayout>
      <div className="bg-hero">
        <Section className="py-14">
          <Eyebrow>{accountRole === "advisor" ? "Advisor profile" : accountRole === "administrator" ? "Administrator profile" : accountRole === "restricted" ? "Account review" : "Member profile"}</Eyebrow>
          <h1 className="mt-3 text-4xl font-bold text-navy-deep">
            {accountRole === "advisor" ? "Advisor profile and availability" : accountRole === "administrator" ? "My administrator profile" : accountRole === "restricted" ? "Account access needs review" : "My member profile"}
          </h1>
          <p className="mt-2 max-w-xl text-navy-deep/70">
            {accountRole === "advisor"
              ? "Manage the information members see and control whether you can receive new support requests."
              : accountRole === "administrator"
                ? "Manage your personal profile. Administration tools are available from the clearly labelled administrator workspace."
                : accountRole === "restricted"
                  ? "Your account records do not agree, so member, advisor and administrator actions are disabled until an administrator reviews them."
                  : "Manage your member information. Advisor access is a separate application and approval process."}
          </p>
        </Section>
      </div>

      <Section className="py-12">
        <form onSubmit={save} className="max-w-2xl space-y-5">
          <Field label="Display name" value={form.display_name} onChange={(value) => setForm((current) => ({ ...current, display_name: value }))} required maxLength={80} />
          <Field label="Headline" placeholder="e.g. Student interested in privacy and technology" value={form.headline} onChange={(value) => setForm((current) => ({ ...current, headline: value }))} maxLength={160} />
          <Field label="Bio" textarea value={form.bio} onChange={(value) => setForm((current) => ({ ...current, bio: value }))} placeholder="A short introduction" maxLength={1200} />
          <Field label="Focus areas (comma-separated)" value={form.focus_areas} onChange={(value) => setForm((current) => ({ ...current, focus_areas: value }))} placeholder="Data privacy, online safety, copyright" maxLength={600} />

          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-teal" /><div className="font-display font-bold">{accountRole === "advisor" ? "Advisor settings" : accountRole === "administrator" ? "Administrator account" : accountRole === "restricted" ? "Access review required" : "Optional advisor application"}</div></div>

            {accountRole === "member" ? (
              <div className="rounded-xl border border-border bg-secondary/50 p-5">
                <UserRoundCheck className="h-7 w-7 text-teal" />
                <h2 className="mt-3 text-lg font-bold">Interested in becoming an advisor?</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">You are currently a member. You can apply with your background and areas of interest, but you remain a member unless an administrator approves the application.</p>
                <Link to="/advisor-application" className="mt-4 inline-flex rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white">Open advisor application</Link>
              </div>
            ) : accountRole === "advisor" ? (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-teal/30 bg-teal/10 px-3 py-2 text-xs text-navy-deep"><ShieldCheck className="h-4 w-4 text-teal" />Your advisor account is approved.</div>
                <Toggle label="Publish my advisor profile" desc="Show my profile on the Ask an Advisor page" checked={form.is_public} onChange={(value) => setForm((current) => ({ ...current, is_public: value }))} />
                <Toggle label="Accept new messages" desc="Allow students to start new conversations with me" checked={form.accepting_messages} onChange={(value) => setForm((current) => ({ ...current, accepting_messages: value }))} />

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Availability</span>
                  <select value={form.availability_status} onChange={(event) => setForm((current) => ({ ...current, availability_status: event.target.value as ProfileForm["availability_status"] }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal/40">
                    <option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Maximum active conversations</span>
                  <input type="number" min={1} max={50} value={form.max_active_conversations} onChange={(event) => setForm((current) => ({ ...current, max_active_conversations: Number(event.target.value) }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal/40" />
                </label>

                <Field label="Optional booking page" type="url" placeholder="https://calendly.com/your-name/intro-call" value={form.calendly_url} onChange={(value) => setForm((current) => ({ ...current, calendly_url: value }))} icon={Calendar} maxLength={500} />
                <p className="text-xs text-muted-foreground">Students and advisors can also propose a specific time and meeting link from the Meetings page.</p>
              </>
            ) : accountRole === "administrator" ? (
              <div className="rounded-xl border border-navy/20 bg-secondary/50 p-5">
                <ShieldCheck className="h-7 w-7 text-navy" />
                <h2 className="mt-3 text-lg font-bold">Signed in as Administrator</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">This profile does not expose member request controls or advisor availability. Use the administrator navigation for applications and competition management.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-warn/35 bg-warn/10 p-5">
                <AlertTriangle className="h-7 w-7 text-warn" />
                <h2 className="mt-3 text-lg font-bold">Role records need administrator review</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">No privileged or member workflow has been assigned while the records conflict. Your general profile can still be saved.</p>
              </div>
            )}
          </div>

          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-mesh px-6 py-3 font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save profile
          </button>
        </form>
      </Section>
    </SiteLayout>
  );
}

function Field({ label, value, onChange, placeholder, required, textarea, icon: Icon, type = "text", maxLength }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; textarea?: boolean; icon?: React.ElementType; type?: React.HTMLInputTypeAttribute; maxLength?: number;
}) {
  const className = `w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-teal/40 ${Icon ? "pl-10" : ""}`;
  return (
    <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><div className="relative">{Icon && <Icon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />}{textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} rows={4} maxLength={maxLength} className={className} /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} maxLength={maxLength} className={className} />}</div></label>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1" /><span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{desc}</span></span></label>;
}
