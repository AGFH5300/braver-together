from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if new in content:
        print(f"already applied: {label}")
        return content
    if old not in content:
        print(f"not found: {label}")
        return content
    print(f"applied: {label}")
    return content.replace(old, new, 1)


def regex_once(content: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count:
        print(f"applied: {label}")
        return updated
    if replacement.strip() in content:
        print(f"already applied: {label}")
    else:
        print(f"not found: {label}")
    return content


server_path = "src/lib/advisor-application.functions.ts"
server = read(server_path)
server = regex_once(
    server,
    r'function normalizeHttpsUrl\(value: string\): string \| null \{.*?\n\}\n\nfunction fileExtension',
    '''function normalizeHttpsUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z\\d+.-]*:\\/\\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Enter a valid website address.");
  }

  if (url.protocol !== "https:") throw new Error("Profile links must use HTTPS.");
  if (!url.hostname || !url.hostname.includes(".")) throw new Error("Enter a valid website address.");
  return url.toString();
}

function fileExtension''',
    "bare profile domains",
)
server = replace_once(
    server,
    '  const completed = Boolean(profile?.is_advisor || (application && application.status !== "draft"));',
    '  const completed = Boolean(profile?.is_advisor || application?.status === "approved");',
    "approval-only completion",
)
server = regex_once(
    server,
    r'export const getAdvisorOnboardingGate = createServerFn\(\{ method: "GET" \}\).*?\n\s*\}\);\n\nexport const getAdvisorPortalState',
    '''export const getAdvisorOnboardingGate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: intent }, { data: application }, { data: profile }, { data: adminRole }] = await Promise.all([
      supabaseAdmin
        .from("advisor_onboarding_intents")
        .select("completed_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("advisor_applications")
        .select("status")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("is_advisor").eq("id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    const isApplicant = Boolean(intent || application);
    const required = Boolean(
      isApplicant
      && !profile?.is_advisor
      && !adminRole
      && application?.status !== "approved",
    );
    return { required, applicationStatus: application?.status ?? null };
  });

export const getAdvisorPortalState''',
    "pending applicant gate",
)
server = replace_once(
    server,
    '      applicationRequired: !profile?.is_advisor && !adminRole && (!application || application.status === "draft"),',
    '      applicationRequired: !profile?.is_advisor && !adminRole && application?.status !== "approved",',
    "portal application gate",
)
server = server.replace(
    '.upsert({ user_id: context.userId, completed_at: now }, { onConflict: "user_id" }),',
    '.upsert({ user_id: context.userId, completed_at: null }, { onConflict: "user_id" }),',
)
server = server.replace(
    'throw new Error("This CV does not match the active secure upload slot.");',
    'throw new Error("This upload is no longer active. Select the file again.");',
)
server = server.replace(
    'throw new Error(signedError?.message || "A secure CV upload slot could not be created.");',
    'throw new Error(signedError?.message || "The CV upload could not be started.");',
)
review_marker = '''    await supabaseAdmin.from("advisor_application_events").insert({
      application_id: application.id,'''
review_replacement = '''    const { error: onboardingError } = await supabaseAdmin
      .from("advisor_onboarding_intents")
      .upsert({
        user_id: application.user_id,
        completed_at: data.decision === "approved" ? now : null,
      }, { onConflict: "user_id" });
    if (onboardingError) throw new Error(onboardingError.message);

    await supabaseAdmin.from("advisor_application_events").insert({
      application_id: application.id,'''
if "const { error: onboardingError }" not in server:
    server = replace_once(server, review_marker, review_replacement, "review completion state")
write(server_path, server)


application_path = "src/routes/_authenticated/advisor-application.tsx"
application = read(application_path)
application = replace_once(
    application,
    '<Field label="Professional or university profile" type="url" placeholder="https://…" value={form.profileUrl} onChange={(value) => setForm((current) => ({ ...current, profileUrl: value }))} maxLength={500} />',
    '<Field label="Professional or university profile" placeholder="example.com or https://example.com" value={form.profileUrl} onChange={(value) => setForm((current) => ({ ...current, profileUrl: value }))} maxLength={500} />',
    "profile input",
)
application = replace_once(
    application,
    '<div className="text-sm font-semibold">CV or résumé</div>\n                  <div className="mt-1 text-xs text-muted-foreground">Required · PDF or DOCX · maximum 5 MB</div>',
    '<div className="text-sm font-semibold">CV or résumé <span className="text-danger" aria-hidden="true">*</span><span className="sr-only"> required</span></div>\n                  <div className="mt-1 text-xs text-muted-foreground">PDF or DOCX · maximum 5 MB</div>',
    "CV required asterisk",
)
application = application.replace("Ready for secure verification", "Ready to upload")
application = application.replace('if (stage === "hashing") return "Checking CV integrity…";', 'if (stage === "hashing") return "Preparing file…";')
application = application.replace('if (stage === "preparing") return "Creating secure upload…";', 'if (stage === "preparing") return "Starting upload…";')
application = application.replace('if (stage === "verifying") return "Verifying CV…";', 'if (stage === "verifying") return "Checking file…";')
application = application.replace(
    'Your application and verified CV have been received. You can continue using BraverTogether while the team reviews them.',
    'Your application and CV have been received. We will update this page after the review.',
)
application = regex_once(
    application,
    r'  const className = "mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-teal/35";\n  return <label className="block text-sm font-semibold">.*?</label>;',
    '''  const className = "mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-teal/35";
  return (
    <label className="block text-sm font-semibold">
      <span>{label}{required && <><span className="ml-1 text-danger" aria-hidden="true">*</span><span className="sr-only"> required</span></>}</span>
      {textarea
        ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} minLength={minLength} maxLength={maxLength} className={cn(className, minHeight, "resize-y leading-relaxed")} />
        : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} minLength={minLength} maxLength={maxLength} autoCapitalize="none" spellCheck={false} className={className} />}
    </label>
  );''',
    "required field asterisks",
)
write(application_path, application)


layout_path = "src/components/SiteLayout.tsx"
layout = read(layout_path)
if "type OnboardingGateState" not in layout:
    layout = replace_once(
        layout,
        "] as const;\n\nfunction BrandMark",
        '''] as const;

type OnboardingGateState = {
  required: boolean;
  applicationStatus: "draft" | "pending" | "more_info" | "approved" | "denied" | null;
};

const onboardingGateCache = new Map<string, OnboardingGateState>();

function BrandMark''',
        "gate cache type",
    )
new_auth_controls = '''function AuthControls({ onNavigate }: { onNavigate?: () => void }) {
  const { user, loading, signOut } = useAuth();
  const getOnboardingGate = useServerFn(getAdvisorOnboardingGate);
  const navigate = useNavigate();
  const [gate, setGate] = useState<OnboardingGateState | null>(() => user ? onboardingGateCache.get(user.id) ?? null : null);
  const [gateLoading, setGateLoading] = useState(() => Boolean(user && !onboardingGateCache.has(user.id)));

  useEffect(() => {
    let active = true;
    const userId = user?.id;

    async function refreshGate(showLoading: boolean) {
      if (!userId) {
        if (active) {
          setGate(null);
          setGateLoading(false);
        }
        return;
      }

      if (showLoading) setGateLoading(true);
      try {
        const result = await getOnboardingGate();
        const next: OnboardingGateState = {
          required: result.required,
          applicationStatus: result.applicationStatus as OnboardingGateState["applicationStatus"],
        };
        onboardingGateCache.set(userId, next);
        if (active) setGate(next);
      } finally {
        if (active) setGateLoading(false);
      }
    }

    if (!userId) {
      setGate(null);
      setGateLoading(false);
    } else {
      const cached = onboardingGateCache.get(userId);
      if (cached) {
        setGate(cached);
        setGateLoading(false);
      } else {
        void refreshGate(true);
      }
    }

    const listener = () => {
      if (!userId) return;
      onboardingGateCache.delete(userId);
      void refreshGate(false);
    };
    window.addEventListener("advisor-onboarding-changed", listener);
    return () => {
      active = false;
      window.removeEventListener("advisor-onboarding-changed", listener);
    };
  }, [user?.id]);

  async function handleSignOut() {
    if (user) onboardingGateCache.delete(user.id);
    await signOut();
    onNavigate?.();
    await navigate({ to: "/" });
  }

  if (loading || (user && gateLoading && !gate)) return <div className="h-8 w-20 animate-pulse rounded-full bg-secondary" aria-hidden="true" />;

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Link to="/advisor-signup" onClick={onNavigate} className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-teal/30 bg-teal/5 px-3 py-2 text-xs font-semibold text-teal transition hover:bg-teal/10">
          <UserRoundPlus className="h-3.5 w-3.5" /> Become an Advisor
        </Link>
        <Link to="/auth" onClick={onNavigate} className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90">
          <LogIn className="h-3.5 w-3.5" /> Sign in
        </Link>
      </div>
    );
  }

  if (gate?.required) {
    const applicationLabel = gate.applicationStatus === "pending"
      ? "Application under review"
      : gate.applicationStatus === "more_info"
        ? "Update application"
        : gate.applicationStatus === "denied"
          ? "Review application"
          : "Complete application";

    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <Link to="/advisor-application" onClick={onNavigate} className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-xs font-semibold text-white shadow-sm">
          <UserRoundPlus className="h-3.5 w-3.5" /> {applicationLabel}
        </Link>
        <button onClick={handleSignOut} title="Sign out" aria-label="Sign out" className="rounded-md p-2 hover:bg-secondary">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Link to="/advisor-application" onClick={onNavigate} title="Advisor application" aria-label="Advisor application" className="rounded-md p-2 hover:bg-secondary"><UserRoundPlus className="h-4 w-4" /></Link>
      <Link to="/messages" search={{ c: undefined }} onClick={onNavigate} title="Messages" aria-label="Messages" className="rounded-md p-2 hover:bg-secondary"><MessageCircle className="h-4 w-4" /></Link>
      <Link to="/meetings" onClick={onNavigate} title="Meetings" aria-label="Meetings" className="rounded-md p-2 hover:bg-secondary"><CalendarDays className="h-4 w-4" /></Link>
      <Link to="/profile" onClick={onNavigate} title="Profile" aria-label="Profile" className="rounded-md p-2 hover:bg-secondary"><UserIcon className="h-4 w-4" /></Link>
      <button onClick={handleSignOut} title="Sign out" aria-label="Sign out" className="rounded-md p-2 hover:bg-secondary">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}'''
layout = regex_once(
    layout,
    r'function AuthControls\(\{ onNavigate \}: \{ onNavigate\?: \(\) => void \}\) \{.*?\n\}\n\nexport function SiteLayout',
    new_auth_controls + "\n\nexport function SiteLayout",
    "cached navbar controls",
)
write(layout_path, layout)


write(
    "src/hooks/use-auth.ts",
    '''import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

let cachedUser: User | null | undefined;
let pendingUserRequest: Promise<User | null> | null = null;

function loadCurrentUser(): Promise<User | null> {
  if (cachedUser !== undefined) return Promise.resolve(cachedUser);
  if (!pendingUserRequest) {
    pendingUserRequest = supabase.auth.getUser().then(({ data }) => {
      cachedUser = data.user ?? null;
      return cachedUser;
    });
  }
  return pendingUserRequest;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser ?? null);
  const [loading, setLoading] = useState(cachedUser === undefined);

  useEffect(() => {
    let mounted = true;

    void loadCurrentUser().then((nextUser) => {
      if (!mounted) return;
      setUser(nextUser);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      cachedUser = nextUser;
      pendingUserRequest = Promise.resolve(nextUser);
      if (!mounted) return;
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, signOut: () => supabase.auth.signOut() };
}
''',
)

auth_path = "src/routes/auth.tsx"
auth = read(auth_path).replace('advisorIntent ? "Sign in and continue application" : "Sign in securely"', 'advisorIntent ? "Sign in and continue application" : "Sign in"')
write(auth_path, auth)


docs_path = "docs/PRE_RENDER_PRODUCTION_TEST_CHECKLIST.md"
docs = read(docs_path)
docs = replace_once(
    docs,
    "Use email addresses controlled by the team and a password manager.\n\n## 4. Public navigation and layout",
    """Use email addresses controlled by the team and a password manager.

Create the Administrator account as an ordinary account first. Then, in Supabase SQL Editor, replace the email below and run:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where lower(email) = lower('admin@example.com')
on conflict (user_id, role) do nothing;
```

Sign out and back in after assigning the role. Keep the administrator account separate from student and advisor-applicant accounts.

## 4. Public navigation and layout""",
    "admin setup instructions",
)
docs = replace_once(
    docs,
    "- confirm pending status after success\n- download the current CV and compare it with the original",
    "- confirm pending status after success\n- confirm account controls show `Application under review` and sign out only\n- manually open `/messages`, `/meetings`, `/profile`, `/essay-submission`, `/admin-advisors` and `/admin-competitions`\n- confirm every protected route redirects back to `/advisor-application` until approval\n- download the current CV and compare it with the original",
    "pending gate test",
)
docs = docs.replace(
    "- advisor applicant forced-onboarding works",
    "- advisor applicants remain gated through draft, pending, more-information and denied states until approval",
)
write(docs_path, docs)
