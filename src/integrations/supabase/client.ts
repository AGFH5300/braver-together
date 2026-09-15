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

async function maySendSignupOtp(
  supabaseUrl: string,
  supabaseKey: string,
  email: string,
): Promise<boolean> {
  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/can_send_signup_otp`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ p_email: email.trim().toLowerCase() }),
    },
  );

  if (!response.ok) {
    throw new Error("We could not verify this email right now. Please try again.");
  }

  return (await response.json()) === true;
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
    const isSignupOtp =
      "email" in credentials &&
      credentials.options?.shouldCreateUser === true &&
      credentials.options?.data?.signup_completed === false;

    if (isSignupOtp) {
      const allowed = await maySendSignupOtp(
        supabaseUrl,
        supabasePublishableKey,
        credentials.email,
      );

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
