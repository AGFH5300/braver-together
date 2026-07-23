import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { getAccountAccessState } from "@/lib/account-access.functions";
import {
  resolveAccountAccess,
  type AccountAccessState,
} from "@/lib/account-access";

const accountAccessCache = new Map<string, AccountAccessState>();

export function clearAccountAccessCache(userId?: string) {
  if (userId) accountAccessCache.delete(userId);
  else accountAccessCache.clear();
}

export function useAccountAccess() {
  const auth = useAuth();
  const getAccess = useServerFn(getAccountAccessState);
  const [account, setAccount] = useState<AccountAccessState | null>(() =>
    auth.user ? accountAccessCache.get(auth.user.id) ?? null : null,
  );
  const [accountLoading, setAccountLoading] = useState(() =>
    Boolean(auth.user && !accountAccessCache.has(auth.user.id)),
  );

  const refresh = useCallback(
    async (showLoading = false) => {
      const userId = auth.user?.id;
      if (!userId) return null;
      if (showLoading) setAccountLoading(true);
      try {
        const next = (await getAccess()) as AccountAccessState;
        accountAccessCache.set(userId, next);
        setAccount(next);
        return next;
      } catch {
        const restricted = resolveAccountAccess({
          hasMemberRole: false,
          hasAdvisorRole: false,
          hasAdminRole: false,
          profileIsAdvisor: false,
          applicationStatus: null,
          isApplicant: false,
        });
        setAccount(restricted);
        return restricted;
      } finally {
        setAccountLoading(false);
      }
    },
    [auth.user?.id, getAccess],
  );

  useEffect(() => {
    const userId = auth.user?.id;
    if (!userId) {
      setAccount(null);
      setAccountLoading(false);
      return;
    }

    const cached = accountAccessCache.get(userId);
    if (cached) {
      setAccount(cached);
      setAccountLoading(false);
    } else {
      void refresh(true);
    }

    const listener = () => {
      clearAccountAccessCache(userId);
      void refresh(false);
    };
    window.addEventListener("advisor-onboarding-changed", listener);
    return () =>
      window.removeEventListener("advisor-onboarding-changed", listener);
  }, [auth.user?.id, refresh]);

  return {
    ...auth,
    account,
    loading: auth.loading || accountLoading,
    refreshAccountAccess: refresh,
  };
}
