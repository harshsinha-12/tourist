import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { DEFAULT_MODEL, getModelConfig, type ModelId, type ProviderId, type ReasoningLevel } from "./config.js";

const KEY_ENV: Record<ProviderId, readonly string[]> = {
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  google: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
};

export interface ModelSelection {
  modelId?: ModelId;
  reasoningLevel?: ReasoningLevel;
  /** Task-scoped credential. Never serialize this value into trajectories. */
  apiKey?: string;
}

type RoutingOptions = Record<string, Record<string, string | boolean | { thinkingLevel: ReasoningLevel }>>;

export function resolveModel(selection: ModelSelection = {}): { model: LanguageModel; modelId: ModelId; provider: ProviderId; providerOptions: RoutingOptions } {
  const modelId = selection.modelId ?? DEFAULT_MODEL;
  const config = getModelConfig(modelId);
  const apiKey = selection.apiKey ?? KEY_ENV[config.provider].map((name) => process.env[name]).find((key) => key?.trim());
  if (!apiKey?.trim()) throw new Error(`Missing ${KEY_ENV[config.provider].join(" or ")} for ${modelId}`);
  if (selection.reasoningLevel && !config.options.reasoningLevels?.includes(selection.reasoningLevel)) throw new Error(`Reasoning level ${selection.reasoningLevel} is not supported by ${modelId}`);
  const model = config.provider === "openai"
    ? createOpenAI({ apiKey }).responses(modelId)
    : config.provider === "anthropic"
      ? createAnthropic({ apiKey })(modelId)
      : createGoogleGenerativeAI({ apiKey })(modelId);
  const providerOptions: RoutingOptions = config.provider === "openai"
    ? { openai: { store: false, ...(selection.reasoningLevel ? { reasoningEffort: selection.reasoningLevel } : {}) } }
    : config.provider === "anthropic"
      ? (selection.reasoningLevel ? { anthropic: { effort: selection.reasoningLevel } } : {})
      : (selection.reasoningLevel ? { google: { thinkingConfig: { thinkingLevel: selection.reasoningLevel } } } : {});
  return { model, modelId, provider: config.provider, providerOptions };
}
