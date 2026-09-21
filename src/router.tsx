import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 60_000,
    defaultViewTransition: true,
  });

  return router;
};
