import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck, Calendar, KeyRound, Lock } from "lucide-react";
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

function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>({
    display_name: "",
    headline: "",
    bio: "",
    focus_areas: "",
    calendly_url: "",
    accepting_messages: true,
    is_advisor: false,
    is_public: false,
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
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
    setLoading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const focusArray = form.focus_areas.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("profiles").update({
      display_name: form.display_name,
      headline: form.headline,
      bio: form.bio,
      focus_areas: focusArray,
      calendly_url: form.calendly_url || null,
      accepting_messages: form.accepting_messages,
      is_advisor: form.is_advisor,
      is_public: form.is_public,
    }).eq("id", u.user.id);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
    setSaving(false);
  }

  if (loading) return <SiteLayout><Section className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></Section></SiteLayout>;

  return (
    <SiteLayout>
      <div className="bg-hero">
        <Section className="py-14">
          <Eyebrow>Your profile</Eyebrow>
          <h1 className="mt-3 text-4xl font-bold text-navy-deep">Profile settings</h1>
          <p className="mt-2 text-navy-deep/70 max-w-xl">This is how others see you on BraverTogether. Advisors should mark themselves and add a Calendly link to accept call bookings.</p>
        </Section>
      </div>

      <Section className="py-12">
        <form onSubmit={save} className="max-w-2xl space-y-5">
          <Field label="Display name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} required />
          <Field label="Headline" placeholder="e.g. Law student • Data privacy focus" value={form.headline} onChange={(v) => setForm({ ...form, headline: v })} />
          <Field label="Bio" textarea value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} placeholder="Short intro shown on your public profile" />
          <Field label="Focus areas (comma-separated)" value={form.focus_areas} onChange={(v) => setForm({ ...form, focus_areas: v })} placeholder="Data Privacy, Cyberbullying, Copyright" />

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-teal" />
              <div className="font-display font-bold">Advisor settings</div>
            </div>

            {!form.is_advisor ? (
              <AdvisorUnlock onUnlocked={() => setForm((f) => ({ ...f, is_advisor: true }))} />
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-teal/10 border border-teal/30 px-3 py-2 text-xs text-navy-deep">
                  <ShieldCheck className="h-4 w-4 text-teal" />
                  Advisor mode unlocked. Complete your profile below.
                </div>
                <Toggle label="Publish my profile" desc="Make my advisor profile visible to teens" checked={form.is_public} onChange={(v) => setForm({ ...form, is_public: v })} />
                <Toggle label="Accepting messages" desc="Teens can start new conversations with me" checked={form.accepting_messages} onChange={(v) => setForm({ ...form, accepting_messages: v })} />
                <Field
                  label="Calendly URL"
                  placeholder="https://calendly.com/your-handle/intro-call"
                  value={form.calendly_url}
                  onChange={(v) => setForm({ ...form, calendly_url: v })}
                  icon={Calendar}
                />
                <p className="text-xs text-muted-foreground">Paste your Calendly event link. A "Book a call" button will appear on your profile and inside conversations.</p>
              </>
            )}
          </div>

          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-mesh text-white px-6 py-3 font-semibold shadow-glow hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save profile
          </button>
        </form>
      </Section>
    </SiteLayout>
  );
}

function Field({ label, value, onChange, placeholder, required, textarea, icon: Icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; textarea?: boolean; icon?: React.ElementType;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1.5">{label}</span>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />}
        {textarea ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} className={`w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 ${Icon ? "pl-10" : ""}`} />
        ) : (
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className={`w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 ${Icon ? "pl-10" : ""}`} />
        )}
      </div>
    </label>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim()) return;
    setSubmitting(true);
    try {
      const res = await unlock({ data: { passcode: passcode.trim() } });
      if (res.ok) {
        toast.success("Advisor mode unlocked");
        onUnlocked();
        setPasscode("");
      } else {
        toast.error("Incorrect passcode");
      }
    } catch (err) {
      toast.error((err as Error).message || "Could not verify passcode");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-secondary/60 border border-border px-3 py-2.5 text-xs text-muted-foreground">
        <Lock className="h-4 w-4 text-teal mt-0.5 shrink-0" />
        <span>Advisor mode is invite-only. Enter the passcode BraverTogether sent you to enable your public advisor profile.</span>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="password"
            autoComplete="off"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Advisor passcode"
            className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !passcode.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-deep text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Unlock
        </button>
      </form>
    </div>
  );
}
