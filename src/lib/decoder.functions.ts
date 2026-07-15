import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createAiProvider } from "./ai-provider.server";

const ClauseSchema = z.object({
  risk: z.enum(["high", "medium", "low", "standard"]),
  title: z.string(),
  quote: z.string(),
  plainEnglish: z.string(),
});

const AnalysisSchema = z.object({
  summary: z.string(),
  highRiskCount: z.number(),
  clauses: z.array(ClauseSchema),
});

export type ContractAnalysis = z.infer<typeof AnalysisSchema>;

const Input = z.object({ text: z.string().min(20).max(500000) });

export const analyzeContract = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ContractAnalysis> => {
    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const modelName = process.env.AI_MODEL;

    if (!apiKey) {
      throw new Error("Missing AI_API_KEY or OPENAI_API_KEY");
    }
    if (!modelName) {
      throw new Error("Missing AI_MODEL");
    }

    const provider = createAiProvider({
      apiKey,
      baseUrl: process.env.AI_BASE_URL,
    });

    const { experimental_output: output } = await generateText({
      model: provider(modelName),
      experimental_output: Output.object({ schema: AnalysisSchema }),
      system: `You are a legal-literacy assistant for teens (ages 12-18). Analyze the provided Terms of Service, Privacy Policy, or digital contract — even if it is very long (tens of thousands of words).

Return:
- "summary": one short paragraph (2-3 sentences) summarizing what the user is actually agreeing to. Mention how many high-risk clauses were flagged.
- "highRiskCount": integer count of clauses with risk="high".
- "clauses": list of the most notable clauses across the WHOLE document. For each:
  - "risk": "high" (gives up significant rights / data sold / broad licenses / waives legal rights / arbitrary termination),
            "medium" (notable rights/content concerns), "low" (minor concerns), or "standard" (normal/expected).
  - "title": short label like "Data Sharing" or "Content License".
  - "quote": a short verbatim snippet (under 200 chars) from the contract, with "..." if trimmed.
  - "plainEnglish": 1-2 sentences explaining what it really means, in language a 14-year-old understands.

For long documents, scan the entire text and surface the 5-12 most important clauses (don't just summarize section 1). Include 2-3 standard clauses for context. Be honest about risks but not alarmist.`,
      prompt: `Contract text:\n\n${data.text}`,
    });

    return output;
  });
