import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash, timingSafeEqual } from "node:crypto";

function passcodeMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const unlockAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { passcode: string }) => {
    if (typeof data?.passcode !== "string" || data.passcode.length === 0 || data.passcode.length > 200) {
      throw new Error("Invalid passcode");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const expected = process.env.ADVISOR_PASSCODE;
    if (!expected) throw new Error("Advisor passcode is not configured");

    if (!passcodeMatches(data.passcode, expected)) {
      return { ok: false as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_advisor: true })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });
