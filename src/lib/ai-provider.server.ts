import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

type AiProviderOptions = {
  apiKey: string;
  baseUrl?: string;
};

export function createAiProvider({ apiKey, baseUrl }: AiProviderOptions) {
  return createOpenAICompatible({
    name: "braver-together-ai",
    apiKey,
    baseURL: baseUrl || "https://api.openai.com/v1",
  });
}
