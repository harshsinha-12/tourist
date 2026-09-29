import { z } from "zod";
import { getModelConfig, type ModelId } from "../../../packages/agent-runtime/src/models/config.js";

export const SubmissionSchema = z.object({
  repo: z.string().regex(/^[a-zA-Z0-9-]{1,39}\/[a-zA-Z0-9_.-]{1,100}$/),
  task: z.string().trim().min(1).max(10_000),
  modelId: z.string(),
  reasoningLevel: z.enum(["low", "medium", "high"]).optional(),
  mode: z.enum(["run", "plan", "ask", "debug"]).default("run"),
  memoryPack: z.array(z.string().max(1_000)).max(8).optional(),
}).strict();

export type Submission = z.infer<typeof SubmissionSchema> & { modelId: ModelId };

export function parseSubmission(input: unknown): Submission {
  const parsed = SubmissionSchema.parse(input);
  const model = getModelConfig(parsed.modelId);
  if (parsed.reasoningLevel && !model.options.reasoningLevels?.includes(parsed.reasoningLevel)) throw new Error(`Reasoning level not supported by ${parsed.modelId}`);
  return parsed as Submission;
}

export function providerKeyEnv(modelId: ModelId): string {
  const provider = getModelConfig(modelId).provider;
  return provider === "openai" ? "OPENAI_API_KEY" : provider === "anthropic" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY";
}
