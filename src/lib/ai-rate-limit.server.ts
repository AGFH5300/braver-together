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
  const usageDate = new Date().toISOString().slice(0, 10);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: current, error: readError } = await supabaseAdmin
    .from("ai_usage_daily")
    .select("request_count")
    .eq("feature", feature)
    .eq("actor_key", actorKey)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (readError) throw new Error("Could not verify the AI usage limit");
  const used = current?.request_count ?? 0;
  if (used >= dailyLimit) {
    throw new Error(`Daily ${feature} AI limit reached. A human advisor can still reply when available.`);
  }

  const { error: writeError } = await supabaseAdmin.from("ai_usage_daily").upsert({
    feature,
    actor_key: actorKey,
    usage_date: usageDate,
    request_count: used + 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: "feature,actor_key,usage_date" });

  if (writeError) throw new Error("Could not update the AI usage limit");
  return { remaining: Math.max(0, dailyLimit - used - 1) };
}
