import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";

function requestAddress(): string {
  try {
    const request = getRequest();
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

function hashActor(value: string): string {
  const salt = process.env.AI_RATE_LIMIT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "braver-together";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export async function consumeAiAllowance({
  feature,
  userId,
  dailyLimit,
}: {
  feature: "support" | "decoder";
  userId?: string | null;
  dailyLimit: number;
}): Promise<{ remaining: number }> {
  const actorKey = hashActor(userId ? `user:${userId}` : `ip:${requestAddress()}`);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("consume_ai_allowance", { p_feature: feature, p_actor_key: actorKey, p_limit: dailyLimit });
  if (error || data === null) throw new Error("AI is unavailable or today's limit has been reached. Please try again later.");
  return { remaining: data };
}
