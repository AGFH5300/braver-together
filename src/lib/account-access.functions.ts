import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  resolveAccountAccess,
  type AccountAccessState,
  type AdvisorApplicationStatus,
  type EffectiveAccountRole,
} from "@/lib/account-access";

export async function loadAccountAccessState(
  userId: string,
): Promise<AccountAccessState> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [profileResult, rolesResult, applicationResult, intentResult] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("is_advisor")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin
        .from("advisor_applications")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("advisor_onboarding_intents")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const firstError = [
    profileResult.error,
    rolesResult.error,
    applicationResult.error,
    intentResult.error,
  ].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const roles = new Set((rolesResult.data ?? []).map((row) => row.role));
  const applicationStatus =
    (applicationResult.data?.status as AdvisorApplicationStatus | undefined) ??
    null;

  return resolveAccountAccess({
    hasMemberRole: roles.has("teen"),
    hasAdvisorRole: roles.has("advisor"),
    hasAdminRole: roles.has("admin"),
    profileIsAdvisor: profileResult.data?.is_advisor === true,
    applicationStatus,
    isApplicant: Boolean(intentResult.data || applicationResult.data),
  });
}

export async function requireAccountRole(
  userId: string,
  allowed: EffectiveAccountRole[],
): Promise<AccountAccessState> {
  const access = await loadAccountAccessState(userId);
  if (!allowed.includes(access.role)) {
    if (access.hasRoleConflict) {
      throw new Error(
        "This account has conflicting access records. Contact an administrator before continuing.",
      );
    }
    const label = allowed
      .map((role) =>
        role === "administrator"
          ? "administrator"
          : role === "advisor"
            ? "approved advisor"
            : role,
      )
      .join(" or ");
    throw new Error(`This action requires a ${label} account.`);
  }
  return access;
}

export const getAccountAccessState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadAccountAccessState(context.userId));
