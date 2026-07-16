import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { consumeAiAllowance } from "./ai-rate-limit.server";
import { MAX_CONTRACT_CHARACTERS } from "./decoder.constants";
import { createAiProvider } from "./ai-provider.server";

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
  remainingToday: number;
};

const Input = z.object({ text: z.string().trim().min(20).max(MAX_CONTRACT_CHARACTERS) });

export const analyzeContract = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ContractAnalysis> => {
    const apiKey = process.env.DECODER_AI_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const modelName = process.env.DECODER_AI_MODEL || process.env.AI_MODEL;
    if (!apiKey || !modelName) {
      throw new Error("The Contract Decoder is temporarily unavailable. Please try again later.");
    }

    const allowance = await consumeAiAllowance({ feature: "decoder", dailyLimit: 10 });
    const provider = createAiProvider({
      apiKey,
      baseUrl: process.env.DECODER_AI_BASE_URL || process.env.AI_BASE_URL,
      supportsStructuredOutputs: (process.env.DECODER_AI_STRUCTURED_OUTPUTS || process.env.AI_STRUCTURED_OUTPUTS) !== "false",
    });

    const { output } = await generateText({
      model: provider(modelName),
      output: Output.object({ schema: GeneratedAnalysisSchema }),
      maxOutputTokens: 2_200,
      temperature: 0.1,
      system: `You are a legal-literacy assistant for teenagers. Analyze only the supplied Terms of Service, Privacy Policy, or digital contract. This is educational information, not legal advice.

Return a two-to-three sentence summary and 5–12 notable clauses from across the supplied text. For each clause provide a risk level, short title, a verbatim excerpt under 200 characters, and a plain-English explanation understandable to a 14-year-old. Mark high risk only for significant rights loss, data sale, broad licences, legal-right waivers, or arbitrary termination. Include normal clauses for context. Do not invent missing wording, jurisdiction, consequences, or legal conclusions.`,
      prompt: `Contract text:\n\n${data.text}`,
    });

    return {
      ...output,
      highRiskCount: output.clauses.filter((clause) => clause.risk === "high").length,
      remainingToday: allowance.remaining,
    };
  });
