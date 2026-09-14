import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

type AiProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  supportsStructuredOutputs?: boolean;
};

export function createAiProvider({
  apiKey,
  baseUrl,
  supportsStructuredOutputs = true,
}: AiProviderOptions) {
  return createOpenAICompatible({
    name: "braver-together-ai",
    apiKey,
    baseURL: baseUrl || "https://api.groq.com/openai/v1",
    supportsStructuredOutputs,
  });
}
