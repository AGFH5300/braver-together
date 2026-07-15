import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Menu, X, MessageCircle, User as UserIcon, LogOut, LogIn } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

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
    <div className={cn("relative h-9 w-9 rounded-xl bg-mesh flex items-center justify-center shadow-glow", className)}>
      <Heart className="h-4 w-4 text-teal-soft fill-teal-soft/90" strokeWidth={2.5} />
    </div>
  );
}

function AuthControls({ onNavigate }: { onNavigate?: () => void }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  if (loading) return null;
  if (!user) {
    return (
      <Link to="/auth" onClick={onNavigate} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
        <LogIn className="h-3.5 w-3.5" /> Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Link to="/messages" onClick={onNavigate} title="Messages" className="p-2 rounded-md hover:bg-secondary"><MessageCircle className="h-4 w-4" /></Link>
      <Link to="/profile" onClick={onNavigate} title="Profile" className="p-2 rounded-md hover:bg-secondary"><UserIcon className="h-4 w-4" /></Link>
      <button onClick={async () => { await signOut(); onNavigate?.(); navigate({ to: "/" }); }} title="Sign out" className="p-2 rounded-md hover:bg-secondary"><LogOut className="h-4 w-4" /></button>
    </div>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <BrandMark />
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-base tracking-tight">Braver<span className="text-teal">Together</span></span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Digital Legal Literacy</span>
            </div>
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition rounded-md"
                activeProps={{ className: "text-foreground bg-secondary" }}
                activeOptions={{ exact: n.to === "/" }}
              >
                {n.label}
              </Link>
            ))}
            <Link
              to="/decoder"
              className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-mesh px-4 py-2 text-sm font-semibold text-white shadow-glow hover:opacity-90 transition"
            >
              Contract Decoder
            </Link>
            <div className="ml-2 pl-2 border-l border-border"><AuthControls /></div>
          </nav>
          <button
            onClick={() => setOpen(!open)}
            className="lg:hidden p-2 rounded-md hover:bg-secondary"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="lg:hidden border-t border-border bg-background">
            <div className="px-4 py-3 flex flex-col gap-1">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 text-sm font-medium rounded-md hover:bg-secondary"
                >
                  {n.label}
                </Link>
              ))}
              <Link
                to="/decoder"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-mesh px-4 py-2.5 text-sm font-semibold text-white"
              >
                Contract Decoder
              </Link>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Account</span>
                <AuthControls onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-mesh text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14 grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BrandMark />
              <span className="font-display font-bold text-lg">BraverTogether</span>
            </div>
            <p className="text-sm text-white/70 max-w-xs leading-relaxed">
              Free digital legal literacy for teens aged 12–18. Built by Tara Vishwakarthik.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3 text-teal-soft">Explore</h4>
            <ul className="space-y-2 text-sm text-white/70">
              {nav.slice(1).map((n) => (
                <li key={n.to}><Link to={n.to} className="hover:text-white">{n.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3 text-teal-soft">Disclaimer</h4>
            <p className="text-xs text-white/65 leading-relaxed">
              All content on this platform is for educational purposes only and does not constitute legal advice.
              Always consult a qualified lawyer for legal matters specific to your jurisdiction.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/55">
          © {new Date().getFullYear()} BraverTogether · Digital Legal Literacy Initiative
        </div>
      </footer>
    </div>
  );
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24", className)}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-teal">
      <span className="h-1.5 w-1.5 rounded-full bg-teal animate-pulse" />
      {children}
    </span>
  );
}
