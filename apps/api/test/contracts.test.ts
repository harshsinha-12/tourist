import { expect, test } from "vitest";
import { parseSubmission } from "../src/contracts.js";

test("cloud contract accepts only disjoint run-mode swarm assignments", () => {
  const base = { repo: "owner/repo", task: "Update both", modelId: "gpt-6-sol", mode: "run" };
  const swarmParts = [{ goal: "one", files: ["a.js"] }, { goal: "two", files: ["b.js"] }];
  expect(parseSubmission({ ...base, swarmParts }).swarmParts).toHaveLength(2);
  expect(() => parseSubmission({ ...base, mode: "ask", swarmParts })).toThrow();
  expect(() => parseSubmission({ ...base, swarmParts: [{ goal: "one", files: ["a.js"] }, { goal: "two", files: ["a.js"] }] })).toThrow();
});
