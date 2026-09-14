import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/team")({ beforeLoad: () => { throw redirect({ to: "/about", statusCode: 301 }); } });
