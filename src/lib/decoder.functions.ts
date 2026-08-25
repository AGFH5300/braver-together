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
  analysisMode: "ai" | "basic";
};

const Input = z.object({ text: z.string().trim().min(20).max(MAX_CONTRACT_CHARACTERS) });

type Risk = "high" | "medium" | "low" | "standard";

type BasicRule = {
  title: string;
  risk: Risk;
  pattern: RegExp;
  explanation: string;
};

const BASIC_RULES: BasicRule[] = [
  {
    title: "Sharing or selling personal data",
    risk: "high",
    pattern: /\b(sell|share|disclose|transfer)\b[^.!?]{0,140}\b(personal (?:data|information)|data|information)\b|\bpersonal (?:data|information)\b[^.!?]{0,140}\b(third part|partner|advertis|market)/i,
    explanation: "This may allow information about you to be shared with outside companies or used for advertising. Check what information is involved, who receives it and whether you can opt out.",
  },
  {
    title: "Broad licence to your content",
    risk: "high",
    pattern: /\b(worldwide|royalty[- ]free|perpetual|irrevocable|sublicen[cs]able)\b[^.!?]{0,180}\b(licen[cs]e|content|post|upload|material)/i,
    explanation: "This may give the service broad rights to use content you upload. Look for how long the licence lasts, what uses are allowed and whether those rights end when you delete the content or account.",
  },
  {
    title: "Account termination without notice",
    risk: "high",
    pattern: /\b(terminate|suspend|disable|close)\b[^.!?]{0,140}\b(without (?:prior )?notice|sole discretion|any reason|no reason)/i,
    explanation: "The service may be able to suspend or close an account with little warning or explanation. Check whether there is an appeal process or a requirement to give notice.",
  },
  {
    title: "Arbitration or class-action waiver",
    risk: "high",
    pattern: /\b(binding arbitration|arbitration|class action waiver|waive[^.!?]{0,60}(?:jury|class action|court))\b/i,
    explanation: "This can limit how disputes are brought and may prevent a normal court case or class action. The exact effect depends on the wording and jurisdiction.",
  },
  {
    title: "Automatic renewal or recurring payment",
    risk: "medium",
    pattern: /\b(auto(?:matic(?:ally)?)?[- ]?renew|recurring (?:payment|subscription|charge)|renew(?:s|ed)? automatically)\b/i,
    explanation: "The service may renew or charge again unless you cancel in time. Check the renewal period, cancellation steps and when notice must be given.",
  },
  {
    title: "Limits on the service's liability",
    risk: "medium",
    pattern: /\b(limitation of liability|not liable|no liability|disclaim(?:s|er)?|as is|without warranties)\b/i,
    explanation: "This tries to limit what the service may owe if something goes wrong. Read what kinds of loss are excluded and whether any exceptions are stated.",
  },
  {
    title: "Tracking and cookies",
    risk: "medium",
    pattern: /\b(cookie|tracking technolog|pixel|device identifier|analytics provider|advertising identifier)\b/i,
    explanation: "The service may track activity or device information. Check whether the tracking is necessary, used for advertising, shared with others, or adjustable in privacy settings.",
  },
  {
    title: "Changes to the terms",
    risk: "medium",
    pattern: /\b(modify|change|update|revise)\b[^.!?]{0,100}\b(terms|agreement|policy)\b[^.!?]{0,100}\b(any time|at any time|sole discretion|without notice)/i,
    explanation: "The company may be able to change the rules later. Check how users are notified and whether continued use automatically counts as accepting the new terms.",
  },
  {
    title: "Governing law or dispute location",
    risk: "standard",
    pattern: /\b(governed by|governing law|exclusive jurisdiction|venue|courts of)\b/i,
    explanation: "This says which law or location may apply to disputes. It is common in contracts, but it can matter if the chosen place is far from where you live.",
  },
  {
    title: "Age or parental consent requirement",
    risk: "standard",
    pattern: /\b(parental consent|parent or guardian|under (?:the age of )?1[2368]|minimum age|age requirement)\b/i,
    explanation: "This sets rules for younger users, such as a minimum age or a need for parent or guardian permission.",
  },
];

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12);
}

function shortQuote(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= 220 ? trimmed : `${trimmed.slice(0, 217).trimEnd()}…`;
}

function basicAnalysis(text: string, remainingToday = 0): ContractAnalysis {
  const sentences = splitSentences(text);
  const clauses: z.infer<typeof ClauseSchema>[] = [];
  const used = new Set<string>();

  for (const rule of BASIC_RULES) {
    const sentence = sentences.find((candidate) => !used.has(candidate) && rule.pattern.test(candidate));
    if (!sentence) continue;
    used.add(sentence);
    clauses.push({
      risk: rule.risk,
      title: rule.title,
      quote: shortQuote(sentence),
      plainEnglish: rule.explanation,
    });
    if (clauses.length >= 10) break;
  }

  if (clauses.length === 0) {
    for (const sentence of sentences.slice(0, 3)) {
      clauses.push({
        risk: "standard",
        title: "General contract term",
        quote: shortQuote(sentence),
        plainEnglish: "This clause did not match one of the decoder's common risk patterns. Read it carefully in context and ask a qualified person if its effect is unclear.",
      });
    }
  }

  if (clauses.length === 0) {
    clauses.push({
      risk: "standard",
      title: "General contract text",
      quote: shortQuote(text),
      plainEnglish: "This text is too fragmented for the basic scanner to classify reliably. Try pasting a complete paragraph or section.",
    });
  }

  const highRiskCount = clauses.filter((clause) => clause.risk === "high").length;
  const mediumRiskCount = clauses.filter((clause) => clause.risk === "medium").length;
  const summary = highRiskCount || mediumRiskCount
    ? `The basic clause scan found ${highRiskCount} high-risk and ${mediumRiskCount} medium-risk pattern${highRiskCount + mediumRiskCount === 1 ? "" : "s"} worth reading closely. This fallback checks common wording only and does not replace the full AI analysis or legal advice.`
    : "The basic clause scan did not detect one of its common higher-risk wording patterns. That does not mean the contract is risk-free; this fallback is deliberately limited and should be used as a reading aid only.";

  return {
    summary,
    clauses,
    highRiskCount,
    remainingToday,
    analysisMode: "basic",
  };
}

export const analyzeContract = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ContractAnalysis> => {
    const apiKey = process.env.DECODER_AI_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const modelName = process.env.DECODER_AI_MODEL || process.env.AI_MODEL;

    if (!apiKey || !modelName) {
      return basicAnalysis(data.text);
    }

    const allowance = await consumeAiAllowance({ feature: "decoder", dailyLimit: 10 });
    const provider = createAiProvider({
      apiKey,
      baseUrl: process.env.DECODER_AI_BASE_URL || process.env.AI_BASE_URL,
      supportsStructuredOutputs: (process.env.DECODER_AI_STRUCTURED_OUTPUTS || process.env.AI_STRUCTURED_OUTPUTS) !== "false",
    });

    try {
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
        analysisMode: "ai",
      };
    } catch (error) {
      console.error("Contract Decoder AI failed; using basic fallback", error);
      return basicAnalysis(data.text, allowance.remaining);
    }
  });