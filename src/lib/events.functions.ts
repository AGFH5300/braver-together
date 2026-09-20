import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ChapterInterestInput = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  nationality: z.string().trim().min(2, "Enter your nationality.").max(100),
  location: z.string().trim().min(2, "Tell us where you live.").max(160),
  age: z.number().int().min(10).max(120),
  interestedPeople: z.number().int().min(1).max(100000),
  notes: z.string().trim().max(3000).optional().default(""),
  website: z.string().max(0).optional().default(""),
});

export const submitChapterInterest = createServerFn({ method: "POST" })
  .validator((value: unknown) => ChapterInterestInput.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const normalizedEmail = data.email.toLowerCase();
    const recentCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: recent, error: recentError } = await supabaseAdmin
      .from("chapter_interest_submissions")
      .select("id")
      .ilike("email", normalizedEmail)
      .gte("created_at", recentCutoff)
      .limit(1);

    if (recentError) {
      throw new Error("Your chapter interest could not be submitted right now. Please try again.");
    }

    if ((recent ?? []).length > 0) {
      return { ok: true as const, alreadyReceived: true as const };
    }

    const { error } = await supabaseAdmin
      .from("chapter_interest_submissions")
      .insert({
        name: data.name,
        email: normalizedEmail,
        nationality: data.nationality,
        location: data.location,
        age: data.age,
        interested_people: data.interestedPeople,
        notes: data.notes || null,
      });

    if (error) {
      console.error("[Events] Chapter interest submission failed", error.message);
      throw new Error("Your chapter interest could not be submitted right now. Please try again.");
    }

    return { ok: true as const, alreadyReceived: false as const };
  });
