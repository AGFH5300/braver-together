export function reportClientError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  const route = typeof window !== "undefined" ? window.location.pathname : undefined;
  console.error("[Client error]", {
    error,
    route,
    ...context,
  });
}
