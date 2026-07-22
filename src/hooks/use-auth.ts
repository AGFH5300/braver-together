import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

function completedAccountUser(user: User | null | undefined): User | null {
  return user?.user_metadata?.signup_completed === false ? null : (user ?? null);
}

let cachedUser: User | null | undefined;
let pendingUserRequest: Promise<User | null> | null = null;

function loadCurrentUser(): Promise<User | null> {
  if (cachedUser !== undefined) return Promise.resolve(cachedUser);
  if (!pendingUserRequest) {
    pendingUserRequest = supabase.auth.getUser().then(({ data }) => {
      cachedUser = completedAccountUser(data.user);
      return cachedUser;
    });
  }
  return pendingUserRequest;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser ?? null);
  const [loading, setLoading] = useState(cachedUser === undefined);

  useEffect(() => {
    let mounted = true;

    void loadCurrentUser().then((nextUser) => {
      if (!mounted) return;
      setUser(nextUser);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = completedAccountUser(session?.user);
      cachedUser = nextUser;
      pendingUserRequest = Promise.resolve(nextUser);
      if (!mounted) return;
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, signOut: () => supabase.auth.signOut() };
}
