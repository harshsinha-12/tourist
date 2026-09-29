export type ProviderId = "openai" | "anthropic" | "google";
export type ReasoningLevel = "low" | "medium" | "high";

export interface ModelConfig {
  id: string;
  provider: ProviderId;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: {
    toolCalling: boolean;
    structuredOutput: boolean;
    imageInput: boolean;
    reasoning: boolean;
    streaming: boolean;
  };
  options: {
    reasoningLevels?: readonly ReasoningLevel[];
    api: "responses" | "messages" | "generateContent";
  };
}

const standard = { toolCalling: true, structuredOutput: true, imageInput: true, reasoning: true, streaming: true } as const;

// Explicit catalog: unknown model IDs fail before a provider request. Add a model here
// and its rates in pricing.ts after checking the provider's documentation.
export const MODELS = {
  "gpt-6-sol": { id: "gpt-6-sol", provider: "openai", contextWindow: 1_050_000, maxOutputTokens: 128_000, capabilities: standard, options: { api: "responses", reasoningLevels: ["low", "medium", "high"] } },
  "gpt-6-luna": { id: "gpt-6-luna", provider: "openai", contextWindow: 1_050_000, maxOutputTokens: 128_000, capabilities: standard, options: { api: "responses", reasoningLevels: ["low", "medium", "high"] } },
  "gpt-6-astra": { id: "gpt-6-astra", provider: "openai", contextWindow: 1_050_000, maxOutputTokens: 128_000, capabilities: standard, options: { api: "responses", reasoningLevels: ["low", "medium", "high"] } },
  "claude-sonnet-5-5": { id: "claude-sonnet-5-5", provider: "anthropic", contextWindow: 1_000_000, maxOutputTokens: 128_000, capabilities: standard, options: { api: "messages", reasoningLevels: ["low", "medium", "high"] } },
  "claude-opus-5-5": { id: "claude-opus-5-5", provider: "anthropic", contextWindow: 1_000_000, maxOutputTokens: 128_000, capabilities: standard, options: { api: "messages", reasoningLevels: ["low", "medium", "high"] } },
  "claude-haiku-4-5": { id: "claude-haiku-4-5", provider: "anthropic", contextWindow: 200_000, maxOutputTokens: 64_000, capabilities: standard, options: { api: "messages" } },
  "gemini-3.8-flash": { id: "gemini-3.8-flash", provider: "google", contextWindow: 1_048_576, maxOutputTokens: 65_536, capabilities: standard, options: { api: "generateContent", reasoningLevels: ["low", "medium", "high"] } },
  "gemini-3.5-flash-lite": { id: "gemini-3.5-flash-lite", provider: "google", contextWindow: 1_048_576, maxOutputTokens: 65_536, capabilities: standard, options: { api: "generateContent" } },
} as const satisfies Record<string, ModelConfig>;

export type ModelId = keyof typeof MODELS;
export const DEFAULT_MODEL: ModelId = "gpt-6-sol";

export function getModelConfig(id: string): ModelConfig {
  const model = (MODELS as Record<string, ModelConfig>)[id];
  if (!model) throw new Error(`Unsupported model: ${id}`);
  return model;
}
