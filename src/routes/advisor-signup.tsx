import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/advisor-signup")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "Apply to Be an Advisor — BraverTogether" },
      {
        name: "description",
        content: "Create or sign in to your BraverTogether member account, then apply to become an advisor.",
      },
    ],
  }),
  component: () => null,
});
