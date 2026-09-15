import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SignupEmailInput = z.object({
  email: z.string().trim().email().max(200),
});

/**
 * Check signup eligibility with the trusted Supabase admin client before an OTP
 * is sent. Completed accounts are redirected to sign-in; unfinished signup
 * accounts are allowed to resume their existing verification flow.
 */
export const checkSignupEmailAvailability = createServerFn({ method: "POST" })
  .validator((value: unknown) => SignupEmailInput.parse(value))
  .handler(async ({ data }) => {
    const normalizedEmail = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data: usersPage, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw new Error("We could not verify this email right now. Please try again.");
      }

      const existingUser = usersPage.users.find(
        (user) => user.email?.trim().toLowerCase() === normalizedEmail,
      );

      if (existingUser) {
        const signupIncomplete =
          existingUser.user_metadata?.signup_completed === false;

        return {
          maySendSignupOtp: signupIncomplete,
          accountAlreadyExists: !signupIncomplete,
        };
      }

      if (usersPage.users.length < perPage) {
        return {
          maySendSignupOtp: true,
          accountAlreadyExists: false,
        };
      }

      page += 1;
    }
  });
