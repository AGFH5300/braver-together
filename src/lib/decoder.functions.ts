import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { createAiProvider } from "./ai-provider.server";

export const MAX_CONTRACT_CHARACTERS = 120_000;

const ClauseSchema = z.object({
  risk: z.enum(["high", "medium", "low", "standard"]),
  title: z.string().min(1).max(120),
  quote: z.string().min(1).max(500),
  plainEnglish: z.string().min(1).max(1_200),
});

const GeneratedAnalysisSchema = z.object({
  summary: z.string().min(1).max(2_000),
  clauses: z.array(ClauseSchema).min(1).max(12),
});

export type ContractAnalysis = z.infer<typeof GeneratedAnalysisSchema> & {
  highRiskCount: number;
};

const Input = z.object({
  text: z.string().trim().min(20).max(MAX_CONTRACT_CHARACTERS),
});

export const analyzeContract = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ContractAnalysis> => {
    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const modelName = process.env.AI_MODEL;

    if (!apiKey) throw new Error("Missing AI_API_KEY or OPENAI_API_KEY");
    if (!modelName) throw new Error("Missing AI_MODEL");

    const provider = createAiProvider({
      apiKey,
      baseUrl: process.env.AI_BASE_URL,
      supportsStructuredOutputs: process.env.AI_STRUCTURED_OUTPUTS !== "false",
    });

    const { output } = await generateText({
      model: provider(modelName),
      output: Output.object({ schema: GeneratedAnalysisSchema }),
      maxOutputTokens: 2_500,
      system: `You are a legal-literacy assistant for teens ages 12–18. Analyze the provided Terms of Service, Privacy Policy, or digital contract across the entire supplied text.

Return:
- "summary": one short paragraph of 2–3 sentences explaining what the user is agreeing to.
- "clauses": 5–12 of the most notable clauses across the whole document. For each clause return:
  - "risk": "high" for significant rights loss, data selling, broad content licences, legal-right waivers, or arbitrary termination; "medium" for notable concerns; "low" for minor concerns; or "standard" for normal terms.
  - "title": a short descriptive label.
  - "quote": a verbatim excerpt under 200 characters, using ellipses if trimmed.
  - "plainEnglish": 1–2 sentences understandable to a 14-year-old.

Include 2–3 standard or low-risk clauses for context when the document contains them. Be accurate and calm rather than alarmist. Do not invent language that is not present in the supplied text.`,
      prompt: `Contract text:\n\n${data.text}`,
    });

    return {
      ...output,
      highRiskCount: output.clauses.filter((clause) => clause.risk === "high").length,
    };
  });
