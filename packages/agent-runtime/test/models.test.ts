import { expect, test } from "vitest";
import { MODELS, getModelConfig } from "../src/models/config.js";
import { estimateTextCost, MODEL_PRICING } from "../src/models/pricing.js";
import { resolveModel } from "../src/models/router.js";

test("every configured model has rates and a working provider route", () => {
  for (const id of Object.keys(MODELS) as Array<keyof typeof MODELS>) {
    expect(MODEL_PRICING[id]).toBeDefined();
    const route = resolveModel({ modelId: id, apiKey: "test-only-key" });
    expect(route.provider).toBe(getModelConfig(id).provider);
    expect(route.model).toBeDefined();
  }
  expect(() => getModelConfig("unknown-model")).toThrow("Unsupported model");
});

test("cost estimator uses cached input rate when supplied", () => {
  expect(estimateTextCost("gpt-6-sol", { inputTokens: 1_000_000, cachedInputTokens: 500_000, outputTokens: 100_000 })).toBeCloseTo(2.1);
  expect(estimateTextCost("gpt-6-sol", { inputTokens: 1_000_000, cacheWriteTokens: 500_000, outputTokens: 0 })).toBeCloseTo(2.25);
});

test("router maps a supported reasoning level to each provider", () => {
  expect(resolveModel({ modelId: "gpt-6-sol", apiKey: "test", reasoningLevel: "high" }).providerOptions).toEqual({ openai: { store: false, reasoningEffort: "high" } });
  expect(resolveModel({ modelId: "claude-sonnet-5-5", apiKey: "test", reasoningLevel: "low" }).providerOptions).toEqual({ anthropic: { effort: "low" } });
  expect(resolveModel({ modelId: "gemini-3.8-flash", apiKey: "test", reasoningLevel: "medium" }).providerOptions).toEqual({ google: { thinkingConfig: { thinkingLevel: "medium" } } });
  expect(() => resolveModel({ modelId: "claude-haiku-4-5", apiKey: "test", reasoningLevel: "high" })).toThrow("not supported");
});
