import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getAdvisorOnboardingGate } from "@/lib/advisor-application.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    if (location.pathname !== "/advisor-application") {
      const gate = await getAdvisorOnboardingGate();
      if (gate.required) {
        throw redirect({ to: "/advisor-application" });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
