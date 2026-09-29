import { expect, test } from "vitest";
import { matchingModels, modelPickerLines } from "../src/model-picker.js";

test("model picker filters providers and shows a selectable priced list", () => {
  expect(matchingModels("anthropic")).toEqual(["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-4-5"]);
  const lines = modelPickerLines("gpt-6", 1, "gpt-6-sol", undefined, 120).join("\n");
  expect(lines).toContain("gpt-6-luna");
  expect(lines).toContain("$0.1 / $0.5");
  expect(lines).toContain("API key");
  expect(lines).toContain("Reasoning");
  expect(lines).not.toContain("claude-sonnet-5-5");
});
