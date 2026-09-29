import { expect, test } from "vitest";
import { COMMANDS, ribbonLines } from "../src/ribbon.js";

test("slash ribbon exposes every command with its description and filters as typed", () => {
  const open = ribbonLines("/", 0, 100).join("\n");
  for (const command of COMMANDS) {
    expect(open).toContain(command.name);
    expect(open).toContain(command.description);
  }
  const filtered = ribbonLines("/mod", 0, 100).join("\n");
  expect(filtered).toContain("/model");
  expect(filtered).toContain("/models");
  expect(filtered).not.toContain("/plan");
  const characterSuggestion = ribbonLines("P", 0, 100).join("\n");
  expect(characterSuggestion).toContain("SUGGESTIONS");
  expect(characterSuggestion).toContain("/plan");
  expect(characterSuggestion).not.toContain("/debug");
  expect(ribbonLines("Please fix this", 0, 100).join("\n")).toContain("TOURIST / COMMANDS");
});
