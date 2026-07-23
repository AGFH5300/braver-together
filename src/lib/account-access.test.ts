import assert from "node:assert/strict";
import test from "node:test";

import { resolveAccountAccess, roleHome } from "./account-access.ts";

const member = {
  hasMemberRole: true,
  hasAdvisorRole: false,
  hasAdminRole: false,
  profileIsAdvisor: false,
  applicationStatus: null,
  isApplicant: false,
} as const;

test("normal and applicant accounts remain members", () => {
  assert.equal(resolveAccountAccess(member).role, "member");
  assert.equal(
    resolveAccountAccess({
      ...member,
      isApplicant: true,
      applicationStatus: "pending",
    }).role,
    "member",
  );
});

test("advisor access requires approval, role and profile flag together", () => {
  const approved = resolveAccountAccess({
    ...member,
    isApplicant: true,
    applicationStatus: "approved",
    hasAdvisorRole: true,
    profileIsAdvisor: true,
  });
  assert.equal(approved.role, "advisor");
  assert.equal(approved.canUseAdvisorWorkspace, true);
  assert.equal(approved.canCreateSupportRequest, false);

  for (const partial of [
    { applicationStatus: "approved" as const },
    { hasAdvisorRole: true },
    { profileIsAdvisor: true },
    { applicationStatus: "approved" as const, hasAdvisorRole: true },
  ]) {
    const access = resolveAccountAccess({ ...member, ...partial });
    assert.equal(access.role, "restricted");
    assert.equal(access.hasRoleConflict, true);
  }
});

test("administrator role has one unambiguous workspace", () => {
  const access = resolveAccountAccess({
    ...member,
    hasAdminRole: true,
    hasAdvisorRole: true,
    profileIsAdvisor: true,
    applicationStatus: "approved",
  });
  assert.equal(access.role, "administrator");
  assert.equal(access.canUseAdminWorkspace, true);
  assert.equal(access.canUseAdvisorWorkspace, false);
  assert.equal(access.canCreateSupportRequest, false);
});

test("accounts missing the baseline member role fail closed", () => {
  const access = resolveAccountAccess({ ...member, hasMemberRole: false });
  assert.equal(access.role, "restricted");
  assert.equal(access.canApplyAsAdvisor, false);
  assert.equal(access.canCreateSupportRequest, false);
});

test("each role has one predictable landing workspace", () => {
  assert.equal(roleHome("member"), "/messages");
  assert.equal(roleHome("advisor"), "/messages");
  assert.equal(roleHome("administrator"), "/admin-advisors");
  assert.equal(roleHome("restricted"), "/profile");
});
