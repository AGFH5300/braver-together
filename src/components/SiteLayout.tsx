import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Heart, LogIn, LogOut, Menu, MessageCircle, User as UserIcon, UserRoundPlus, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/hooks/use-auth";
import { getAdvisorOnboardingGate } from "@/lib/advisor-application.functions";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/team", label: "Team" },
  { to: "/resources", label: "Resources" },
  { to: "/news", label: "News" },
  { to: "/advisors", label: "Ask an Advisor" },
  { to: "/competitions", label: "Competitions" },
] as const;

type OnboardingGateState = {
  required: boolean;
  applicationStatus: "draft" | "pending" | "more_info" | "approved" | "denied" | null;
};

const onboardingGateCache = new Map<string, OnboardingGateState>();

function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex h-9 w-9 items-center justify-center rounded-xl bg-mesh shadow-glow", className)}>
      <Heart className="h-4 w-4 fill-teal-soft/90 text-teal-soft" strokeWidth={2.5} />
    </div>
  );
}

function AuthControls({ onNavigate }: { onNavigate?: () => void }) {
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
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5">
            <BrandMark />
            <div className="flex flex-col leading-none">
              <span className="font-display text-base font-bold tracking-tight">Braver<span className="text-teal">Together</span></span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Digital Legal Literacy</span>
            </div>
          </Link>
          <nav className="hidden min-w-0 items-center gap-0.5 xl:flex">
            {nav.map((item) => (
              <Link key={item.to} to={item.to} className="whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground bg-secondary" }} activeOptions={{ exact: item.to === "/" }}>
                {item.label}
              </Link>
            ))}
            <Link to="/decoder" className="ml-1 inline-flex whitespace-nowrap items-center gap-1.5 rounded-full bg-mesh px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-90">Contract Decoder</Link>
            <div className="ml-1 shrink-0 border-l border-border pl-2"><AuthControls /></div>
          </nav>
          <button onClick={() => setOpen(!open)} className="rounded-md p-2 hover:bg-secondary xl:hidden" aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-border bg-background xl:hidden">
            <div className="flex flex-col gap-1 px-4 py-3">
              {nav.map((item) => (
                <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary">{item.label}</Link>
              ))}
              <Link to="/advisor-signup" onClick={() => setOpen(false)} className="mt-2 inline-flex items-center justify-center gap-2 rounded-full border border-teal/30 bg-teal/5 px-4 py-2.5 text-sm font-semibold text-teal">
                <UserRoundPlus className="h-4 w-4" /> Become an Advisor
              </Link>
              <Link to="/decoder" onClick={() => setOpen(false)} className="mt-1 inline-flex items-center justify-center rounded-full bg-mesh px-4 py-2.5 text-sm font-semibold text-white">Contract Decoder</Link>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3"><span className="text-xs text-muted-foreground">Account</span><AuthControls onNavigate={() => setOpen(false)} /></div>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-mesh text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
          <div><div className="mb-3 flex items-center gap-2"><BrandMark /><span className="font-display text-lg font-bold">BraverTogether</span></div><p className="max-w-xs text-sm leading-relaxed text-white/70">Free digital legal literacy for teens aged 12–18. Built by Tara Vishwakarthik.</p></div>
          <div><h4 className="mb-3 text-sm font-semibold text-teal-soft">Explore</h4><ul className="space-y-2 text-sm text-white/70">{nav.slice(1).map((item) => <li key={item.to}><Link to={item.to} className="hover:text-white">{item.label}</Link></li>)}<li><Link to="/advisor-signup" className="inline-flex items-center gap-1.5 font-semibold text-teal-soft hover:text-white"><UserRoundPlus className="h-3.5 w-3.5" /> Volunteer as an Advisor</Link></li></ul></div>
          <div><h4 className="mb-3 text-sm font-semibold text-teal-soft">Disclaimer</h4><p className="text-xs leading-relaxed text-white/65">All content on this platform is for educational purposes only and does not constitute legal advice. Always consult a qualified lawyer for legal matters specific to your jurisdiction.</p></div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/55">© {new Date().getFullYear()} BraverTogether · Digital Legal Literacy Initiative</div>
      </footer>
    </div>
  );
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24", className)}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-teal"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />{children}</span>;
}
