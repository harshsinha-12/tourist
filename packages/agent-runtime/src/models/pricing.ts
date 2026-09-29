import { getModelConfig, type ModelId } from "./config.js";

export interface TokenPrice {
  /** USD per one million text tokens, standard paid tier. */
  input: number;
  cachedInput?: number;
  cacheWrite?: number;
  output: number;
  note?: string;
}

/** Published standard text rates checked 2026-09-29. Provider bills are authoritative. */
export const MODEL_PRICING: Record<ModelId, TokenPrice> = {
  "gpt-6-sol": { input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 10, note: "Long-context, tools, and other modes may add charges." },
  "gpt-6-luna": { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 },
  "gpt-6-astra": { input: 10, cachedInput: 1, cacheWrite: 12.5, output: 50 },
  "claude-sonnet-5-5": { input: 2, output: 10, note: "Cache writes and reads are billed separately." },
  "claude-opus-5-5": { input: 4, output: 20, note: "Cache writes and reads are billed separately." },
  "claude-haiku-4-5": { input: 1, output: 5, note: "Cache writes and reads are billed separately." },
  "gemini-3.8-flash": { input: 0.75, cachedInput: 0.075, output: 3.75, note: "Promotional rate through 2026-12-31; caching storage and tools extra." },
  "gemini-3.5-flash-lite": { input: 0.3, cachedInput: 0.03, output: 2.5, note: "Text rate; caching storage and tools extra." },
};

export function estimateTextCost(modelId: ModelId, usage: { inputTokens: number; outputTokens: number; cachedInputTokens?: number; cacheWriteTokens?: number }): number {
  getModelConfig(modelId);
  const rate = MODEL_PRICING[modelId];
  const cached = Math.min(usage.cachedInputTokens ?? 0, usage.inputTokens);
  const written = Math.min(usage.cacheWriteTokens ?? 0, usage.inputTokens - cached);
  return ((usage.inputTokens - cached - written) * rate.input + cached * (rate.cachedInput ?? rate.input) + written * (rate.cacheWrite ?? rate.input) + usage.outputTokens * rate.output) / 1_000_000;
}
