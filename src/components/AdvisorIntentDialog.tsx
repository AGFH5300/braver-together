import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, LogIn, UserRoundPlus } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

export function AdvisorIntentTrigger({
  children,
  className,
  onNavigate,
}: {
  children: ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleTrigger() {
    if (loading) return;
    if (user) {
      onNavigate?.();
      await navigate({ to: "/advisor-application" });
      return;
    }
    setOpen(true);
  }

  async function continueToAuth(mode: "signup" | "signin") {
    setOpen(false);
    onNavigate?.();
    await navigate({
      to: "/auth",
      search: { mode },
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleTrigger}
        disabled={loading}
        className={className}
      >
        {children}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl overflow-hidden rounded-3xl border-teal/25 p-0 shadow-2xl">
          <div className="bg-hero px-6 py-7 sm:px-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/15 text-teal">
              <UserRoundPlus className="h-6 w-6" />
            </div>
            <DialogHeader className="mt-5 text-left">
              <DialogTitle className="font-display text-2xl text-navy-deep sm:text-3xl">
                Interested in becoming an advisor?
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-relaxed text-navy-deep/70">
                Advisors do not create a separate account. First create or sign
                in to a normal BraverTogether member account. Once signed in,
                you can complete the separate advisor application.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-6 pb-7 sm:px-8 sm:pb-8">
            <div className="space-y-3 rounded-2xl border border-border bg-secondary/45 p-4 text-sm text-foreground">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                <span>
                  Your account remains a normal member account while the
                  application is reviewed.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                <span>
                  Advisor access and advisor tools appear only after approval.
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => continueToAuth("signup")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-mesh px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
              >
                <UserRoundPlus className="h-4 w-4" /> Create member account
              </button>
              <button
                type="button"
                onClick={() => continueToAuth("signin")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-navy/20 bg-card px-5 py-3 text-sm font-semibold text-navy-deep transition hover:border-teal/50 hover:bg-secondary"
              >
                <LogIn className="h-4 w-4" /> Sign in to continue
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
