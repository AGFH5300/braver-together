import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Heart, LogIn, LogOut, Menu, MessageCircle, User as UserIcon, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useAuth } from "@/hooks/use-auth";
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

function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex h-9 w-9 items-center justify-center rounded-xl bg-mesh shadow-glow", className)}>
      <Heart className="h-4 w-4 fill-teal-soft/90 text-teal-soft" strokeWidth={2.5} />
    </div>
  );
}

function AuthControls({ onNavigate }: { onNavigate?: () => void }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div className="h-8 w-20 animate-pulse rounded-full bg-secondary" aria-hidden="true" />;

  if (!user) {
    return (
      <Link to="/auth" onClick={onNavigate} className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90">
        <LogIn className="h-3.5 w-3.5" /> Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link to="/messages" onClick={onNavigate} title="Messages" aria-label="Messages" className="rounded-md p-2 hover:bg-secondary"><MessageCircle className="h-4 w-4" /></Link>
      <Link to="/meetings" onClick={onNavigate} title="Meetings" aria-label="Meetings" className="rounded-md p-2 hover:bg-secondary"><CalendarDays className="h-4 w-4" /></Link>
      <Link to="/profile" onClick={onNavigate} title="Profile" aria-label="Profile" className="rounded-md p-2 hover:bg-secondary"><UserIcon className="h-4 w-4" /></Link>
      <button
        onClick={async () => {
          await signOut();
          onNavigate?.();
          await navigate({ to: "/" });
        }}
        title="Sign out"
        aria-label="Sign out"
        className="rounded-md p-2 hover:bg-secondary"
      >
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
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5">
            <BrandMark />
            <div className="flex flex-col leading-none">
              <span className="font-display text-base font-bold tracking-tight">Braver<span className="text-teal">Together</span></span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Digital Legal Literacy</span>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link key={item.to} to={item.to} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground bg-secondary" }} activeOptions={{ exact: item.to === "/" }}>
                {item.label}
              </Link>
            ))}
            <Link to="/decoder" className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-mesh px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-90">Contract Decoder</Link>
            <div className="ml-2 border-l border-border pl-2"><AuthControls /></div>
          </nav>
          <button onClick={() => setOpen(!open)} className="rounded-md p-2 hover:bg-secondary lg:hidden" aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-border bg-background lg:hidden">
            <div className="flex flex-col gap-1 px-4 py-3">
              {nav.map((item) => (
                <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary">{item.label}</Link>
              ))}
              <Link to="/decoder" onClick={() => setOpen(false)} className="mt-2 inline-flex items-center justify-center rounded-full bg-mesh px-4 py-2.5 text-sm font-semibold text-white">Contract Decoder</Link>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3"><span className="text-xs text-muted-foreground">Account</span><AuthControls onNavigate={() => setOpen(false)} /></div>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-mesh text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
          <div><div className="mb-3 flex items-center gap-2"><BrandMark /><span className="font-display text-lg font-bold">BraverTogether</span></div><p className="max-w-xs text-sm leading-relaxed text-white/70">Free digital legal literacy for teens aged 12–18. Built by Tara Vishwakarthik.</p></div>
          <div><h4 className="mb-3 text-sm font-semibold text-teal-soft">Explore</h4><ul className="space-y-2 text-sm text-white/70">{nav.slice(1).map((item) => <li key={item.to}><Link to={item.to} className="hover:text-white">{item.label}</Link></li>)}</ul></div>
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
