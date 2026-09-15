import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

type SignupEmailCheckResponse = {
  maySendSignupOtp?: boolean;
  error?: string;
};

async function maySendSignupOtp(email: string): Promise<boolean> {
  if (typeof window === "undefined") {
    throw new Error("Signup verification must be started in your browser.");
  }

  const response = await fetch("/api/signup-email-check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });

  let payload: SignupEmailCheckResponse | null = null;
  try {
    payload = (await response.json()) as SignupEmailCheckResponse;
  } catch {
    // The response status below still produces a safe user-facing error.
  }

  if (!response.ok) {
    throw new Error(
      payload?.error || "We could not verify this email right now. Please try again.",
    );
  }

  return payload?.maySendSignupOtp === true;
}

function createSupabaseClient() {
  const serverEnvironment: Record<string, string | undefined> =
    typeof process !== "undefined" ? process.env : {};
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || serverEnvironment.SUPABASE_URL;
  const supabasePublishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    serverEnvironment.SUPABASE_PUBLISHABLE_KEY ||
    serverEnvironment.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    const missing = [
      ...(!supabaseUrl ? ["VITE_SUPABASE_URL"] : []),
      ...(!supabasePublishableKey ? ["VITE_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. See .env.example.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  const client = createClient<Database>(supabaseUrl, supabasePublishableKey, {
    global: {
      fetch: createSupabaseFetch(supabasePublishableKey),
    },
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  const originalSignInWithOtp = client.auth.signInWithOtp.bind(client.auth);
  client.auth.signInWithOtp = async (credentials) => {
    const signupMetadata = credentials.options?.data;
    const signupCompleted =
      signupMetadata && "signup_completed" in signupMetadata
        ? signupMetadata.signup_completed
        : undefined;
    const isSignupOtp =
      "email" in credentials &&
      credentials.options?.shouldCreateUser === true &&
      signupCompleted === false;

    if (isSignupOtp) {
      const allowed = await maySendSignupOtp(credentials.email);

      if (!allowed) {
        throw new Error(
          "This email already has an account. Sign in with your existing password.",
        );
      }
    }

    return originalSignInWithOtp(credentials);
  };

  return client;
}

let supabaseClient: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, property, receiver) {
    if (!supabaseClient) supabaseClient = createSupabaseClient();
    return Reflect.get(supabaseClient, property, receiver);
  },
});
