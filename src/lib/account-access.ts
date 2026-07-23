export type EffectiveAccountRole =
  | "member"
  | "advisor"
  | "administrator"
  | "restricted";

export type AdvisorApplicationStatus =
  | "draft"
  | "pending"
  | "more_info"
  | "approved"
  | "denied"
  | null;

export type AccountRoleEvidence = {
  hasMemberRole: boolean;
  hasAdvisorRole: boolean;
  hasAdminRole: boolean;
  profileIsAdvisor: boolean;
  applicationStatus: AdvisorApplicationStatus;
  isApplicant: boolean;
};

export type AccountAccessState = AccountRoleEvidence & {
  role: EffectiveAccountRole;
  hasRoleConflict: boolean;
  canApplyAsAdvisor: boolean;
  canCreateSupportRequest: boolean;
  canUseAdvisorWorkspace: boolean;
  canUseAdminWorkspace: boolean;
};

/**
 * Resolve one fail-closed account role from server-controlled database records.
 * An advisor needs the approved application, role row and profile flag together.
 */
export function resolveAccountAccess(
  evidence: AccountRoleEvidence,
): AccountAccessState {
  if (evidence.hasAdminRole) {
    return {
      ...evidence,
      role: "administrator",
      hasRoleConflict: false,
      canApplyAsAdvisor: false,
      canCreateSupportRequest: false,
      canUseAdvisorWorkspace: false,
      canUseAdminWorkspace: true,
    };
  }

  const advisorSignals = [
    evidence.hasAdvisorRole,
    evidence.profileIsAdvisor,
    evidence.applicationStatus === "approved",
  ];
  const approvedAdvisor = advisorSignals.every(Boolean);
  const partialAdvisor = advisorSignals.some(Boolean) && !approvedAdvisor;
  const missingMemberRole = !evidence.hasMemberRole;

  if (approvedAdvisor) {
    return {
      ...evidence,
      role: "advisor",
      hasRoleConflict: false,
      canApplyAsAdvisor: false,
      canCreateSupportRequest: false,
      canUseAdvisorWorkspace: true,
      canUseAdminWorkspace: false,
    };
  }

  if (partialAdvisor || missingMemberRole) {
    return {
      ...evidence,
      role: "restricted",
      hasRoleConflict: true,
      canApplyAsAdvisor: false,
      canCreateSupportRequest: false,
      canUseAdvisorWorkspace: false,
      canUseAdminWorkspace: false,
    };
  }

  return {
    ...evidence,
    role: "member",
    hasRoleConflict: false,
    canApplyAsAdvisor: true,
    canCreateSupportRequest: true,
    canUseAdvisorWorkspace: false,
    canUseAdminWorkspace: false,
  };
}

export function roleHome(role: EffectiveAccountRole):
  | "/messages"
  | "/admin-advisors"
  | "/profile" {
  if (role === "administrator") return "/admin-advisors";
  if (role === "advisor") return "/messages";
  if (role === "member") return "/messages";
  return "/profile";
}
