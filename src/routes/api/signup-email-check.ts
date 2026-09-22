import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SignupEmailInput = z.object({
  email: z.string().trim().email().max(200),
});

export const Route = createFileRoute("/api/signup-email-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const origin = request.headers.get("origin");
        const forwardedHost = request.headers
          .get("x-forwarded-host")
          ?.split(",")[0]
          ?.trim();
        const forwardedProto = request.headers
          .get("x-forwarded-proto")
          ?.split(",")[0]
          ?.trim();
        const host = forwardedHost || request.headers.get("host");
        const protocol =
          forwardedProto || requestUrl.protocol.replace(/:$/, "");
        const expectedOrigin = host
          ? `${protocol}://${host}`
          : requestUrl.origin;

        let normalizedOrigin: string | null = null;
        try {
          normalizedOrigin = origin ? new URL(origin).origin : null;
        } catch {
          normalizedOrigin = null;
        }

        if (!normalizedOrigin || normalizedOrigin !== expectedOrigin) {
          return Response.json(
            { error: "Invalid request origin." },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          );
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid request." },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }

        const parsed = SignupEmailInput.safeParse(payload);
        if (!parsed.success) {
          return Response.json(
            { error: "Enter a valid email address." },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }

        const normalizedEmail = parsed.data.email.toLowerCase();
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        let page = 1;
        const perPage = 1000;

        while (true) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
          });

          if (error) {
            return Response.json(
              { error: "Email availability could not be checked." },
              { status: 503, headers: { "Cache-Control": "no-store" } },
            );
          }

          const existingUser = data.users.find(
            (user) => user.email?.trim().toLowerCase() === normalizedEmail,
          );

          if (existingUser) {
            const signupIncomplete =
              existingUser.user_metadata?.signup_completed === false;

            return Response.json(
              { maySendSignupOtp: signupIncomplete },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          if (data.users.length < perPage) {
            return Response.json(
              { maySendSignupOtp: true },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          page += 1;
        }
      },
    },
  },
});
