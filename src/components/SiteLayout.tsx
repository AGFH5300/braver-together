import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Heart,
  Inbox,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  ShieldCheck,
  Trophy,
  User as UserIcon,
  UserRoundPlus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/hooks/use-auth";
import { getAdvisorOnboardingGate } from "@/lib/advisor-application.functions";
import { cn } from "@/lib/utils";
import { AdvisorIntentTrigger } from "@/components/AdvisorIntentDialog";

const nav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/team", label: "Team" },
  { to: "/resources", label: "Resources" },
  { to: "/news", label: "News" },
  { to: "/competitions", label: "Competitions" },
] as const;

type AccountState = {
  applicationStatus: "draft" | "pending" | "more_info" | "approved" | "denied" | null;
  isApplicant: boolean;
  isAdvisor: boolean;
  isAdmin: boolean;
};

const accountStateCache = new Map<string, AccountState>();

function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex h-9 w-9 items-center justify-center rounded-xl bg-mesh shadow-glow", className)}>
      <Heart className="h-4 w-4 fill-teal-soft/90 text-teal-soft" strokeWidth={2.5} />
    </div>
  );
}

function AccountLink({
  to,
  label,
  icon: Icon,
  messageView,
  onNavigate,
}: {
  to: "/messages" | "/meetings" | "/profile" | "/admin-advisors" | "/admin-competitions";
  label: string;
  icon: React.ElementType;
  messageView?: "mine" | "queue";
  onNavigate?: () => void;
}) {
  const className =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:border-teal/40 hover:bg-secondary";

  if (to === "/messages") {
    return (
      <Link
        to={to}
        search={{ c: undefined, view: messageView }}
        onClick={onNavigate}
        title={label}
        aria-label={label}
        className={className}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      to={to}
      onClick={onNavigate}
      title={label}
      aria-label={label}
      className={className}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Link>
  );
}

function AuthControls({ onNavigate }: { onNavigate?: () => void }) {
  const { user, loading, signOut } = useAuth();
  const getAccountState = useServerFn(getAdvisorOnboardingGate);
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountState | null>(() =>
    user ? accountStateCache.get(user.id) ?? null : null,
  );
  const [accountLoading, setAccountLoading] = useState(() =>
    Boolean(user && !accountStateCache.has(user.id)),
  );

  const refreshAccount = useCallback(async (userId: string, showLoading: boolean) => {
    if (showLoading) setAccountLoading(true);
    try {
      const result = await getAccountState();
      const next: AccountState = {
        applicationStatus: result.applicationStatus as AccountState["applicationStatus"],
        isApplicant: result.isApplicant,
        isAdvisor: result.isAdvisor,
        isAdmin: result.isAdmin,
      };
      accountStateCache.set(userId, next);
      setAccount(next);
    } finally {
      setAccountLoading(false);
    }
  }, [getAccountState]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setAccount(null);
      setAccountLoading(false);
      return;
    }

    const cached = accountStateCache.get(userId);
    if (cached) {
      setAccount(cached);
      setAccountLoading(false);
    } else {
      void refreshAccount(userId, true);
    }

    const listener = () => {
      accountStateCache.delete(userId);
      void refreshAccount(userId, false);
    };
    window.addEventListener("advisor-onboarding-changed", listener);
    return () => window.removeEventListener("advisor-onboarding-changed", listener);
  }, [refreshAccount, user?.id]);

  async function handleSignOut() {
    if (user) accountStateCache.delete(user.id);
    await signOut();
    onNavigate?.();
    await navigate({ to: "/" });
  }

  if (loading || (user && accountLoading && !account)) {
    return <div className="h-8 w-24 animate-pulse rounded-full bg-secondary" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          to="/advisors"
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-teal/30 bg-teal/5 px-3 py-2 text-xs font-semibold text-teal transition hover:bg-teal/10"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Ask an Advisor
        </Link>
        <Link
          to="/auth"
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          <LogIn className="h-3.5 w-3.5" /> Join or sign in
        </Link>
      </div>
    );
  }

  const applicationLabel = account?.applicationStatus === "pending"
    ? "Advisor application: under review"
    : account?.applicationStatus === "more_info"
      ? "Update advisor application"
      : account?.applicationStatus === "denied"
        ? "Review advisor application"
        : account?.isApplicant
          ? "Continue advisor application"
          : "Apply as an Advisor";

  if (account?.isAdmin) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-navy px-3 py-2 text-xs font-semibold text-white">
          <ShieldCheck className="h-3.5 w-3.5" /> Signed in as Administrator
        </span>
        <AccountLink to="/admin-advisors" label="Advisor Applications" icon={UserRoundPlus} onNavigate={onNavigate} />
        <AccountLink to="/admin-competitions" label="Competition Admin" icon={Trophy} onNavigate={onNavigate} />
        <AccountLink to="/profile" label="My Profile" icon={UserIcon} onNavigate={onNavigate} />
        <button onClick={handleSignOut} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    );
  }

  if (account?.isAdvisor) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-teal/10 px-3 py-2 text-xs font-semibold text-teal">
          <ShieldCheck className="h-3.5 w-3.5" /> Signed in as Advisor
        </span>
        <AccountLink to="/messages" label="Advisor Inbox" icon={MessageCircle} messageView="mine" onNavigate={onNavigate} />
        <AccountLink to="/messages" label="Open Request Queue" icon={Inbox} messageView="queue" onNavigate={onNavigate} />
        <AccountLink to="/meetings" label="Advisor Meetings" icon={CalendarDays} onNavigate={onNavigate} />
        <AccountLink to="/profile" label="Advisor Profile" icon={UserIcon} onNavigate={onNavigate} />
        <button onClick={handleSignOut} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-navy-deep">
        <UserIcon className="h-3.5 w-3.5" /> Signed in as Member
      </span>
      <Link
        to="/advisors"
        onClick={onNavigate}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-navy px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
      >
        <MessageCircle className="h-3.5 w-3.5" /> Ask an Advisor
      </Link>
      <AccountLink to="/messages" label="My Support Requests" icon={MessageCircle} messageView="mine" onNavigate={onNavigate} />
      <AccountLink to="/meetings" label="My Meetings" icon={CalendarDays} onNavigate={onNavigate} />
      <Link
        to="/advisor-application"
        onClick={onNavigate}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-teal/30 bg-teal/5 px-3 py-2 text-xs font-semibold text-teal transition hover:bg-teal/10"
      >
        <UserRoundPlus className="h-3.5 w-3.5" /> {applicationLabel}
      </Link>
      <AccountLink to="/profile" label="My Profile" icon={UserIcon} onNavigate={onNavigate} />
      <button onClick={handleSignOut} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">
        <LogOut className="h-3.5 w-3.5" /> Sign out
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
          <nav className="hidden min-w-0 items-center gap-0.5 2xl:flex">
            {nav.map((item) => (
              <Link key={item.to} to={item.to} className="whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground bg-secondary" }} activeOptions={{ exact: item.to === "/" }}>
                {item.label}
              </Link>
            ))}
            <Link to="/decoder" className="ml-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-mesh px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-90">Contract Decoder</Link>
            <div className="ml-1 shrink-0 border-l border-border pl-2"><AuthControls /></div>
          </nav>
          <button onClick={() => setOpen(!open)} className="rounded-md p-2 hover:bg-secondary 2xl:hidden" aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-border bg-background 2xl:hidden">
            <div className="flex flex-col gap-1 px-4 py-3">
              {nav.map((item) => (
                <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary">{item.label}</Link>
              ))}
              <Link to="/decoder" onClick={() => setOpen(false)} className="mt-2 inline-flex items-center justify-center rounded-full bg-mesh px-4 py-2.5 text-sm font-semibold text-white">Contract Decoder</Link>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">Account</span>
                <AuthControls onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-mesh text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
          <div><div className="mb-3 flex items-center gap-2"><BrandMark /><span className="font-display text-lg font-bold">BraverTogether</span></div><p className="max-w-xs text-sm leading-relaxed text-white/70">Free digital legal literacy for teens aged 12–18. Built by Tara Vishwakarthik.</p></div>
          <div><h4 className="mb-3 text-sm font-semibold text-teal-soft">Explore</h4><ul className="space-y-2 text-sm text-white/70">{nav.slice(1).map((item) => <li key={item.to}><Link to={item.to} className="hover:text-white">{item.label}</Link></li>)}<li><Link to="/advisors" className="hover:text-white">Ask an Advisor</Link></li><li><AdvisorIntentTrigger className="inline-flex items-center gap-1.5 font-semibold text-teal-soft hover:text-white"><UserRoundPlus className="h-3.5 w-3.5" /> Apply to be an Advisor</AdvisorIntentTrigger></li></ul></div>
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
