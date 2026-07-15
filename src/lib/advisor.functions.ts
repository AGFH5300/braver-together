import { createHash, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AdvisorUnlockInput = z.object({
  passcode: z.string().trim().min(1).max(200),
});

function passcodeMatches(input: string, expected: string): boolean {
  const inputDigest = createHash("sha256").update(input, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(inputDigest, expectedDigest);
}

export const unlockAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AdvisorUnlockInput.parse(data))
  .handler(async ({ data, context }) => {
    const expected = process.env.ADVISOR_PASSCODE;
    if (!expected) throw new Error("Advisor passcode is not configured");

    if (!passcodeMatches(data.passcode, expected)) {
      return { ok: false as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ is_advisor: true })
      .eq("id", context.userId);
    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      {
        user_id: context.userId,
        role: "advisor",
      },
      {
        onConflict: "user_id,role",
        ignoreDuplicates: true,
      },
    );

    if (roleError) {
      await supabaseAdmin.from("profiles").update({ is_advisor: false }).eq("id", context.userId);
      throw new Error(roleError.message);
    }

    return { ok: true as const };
  });
