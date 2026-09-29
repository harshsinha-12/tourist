import { z } from "zod";
import type { ToolContext, ToolDefinition } from "./types.js";
import { readFileTool, searchTool, writeFileTool } from "./files.js";
import { shellTool, runTestsTool } from "./process.js";
import { gitBranchTool, gitCommitTool, gitDiffTool, gitStatusTool, gitWorktreeAddTool, gitWorktreeRemoveTool, gitDeletePartBranchTool, gitShowFilesTool, gitMergePartTool, gitMergeAbortTool, gitHeadTool } from "./git.js";
import { createPullRequestTool, deleteMemoryTool, embedCodebaseTool, getIssueTool, listIssuesTool, readMemoryTool, writeMemoryTool } from "./recording.js";
import { buildAndRegisterTool, toolManifestSchema } from "./builder.js";

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  constructor(private readonly context: ToolContext) {}

  register<I extends z.ZodType, O extends z.ZodType>(definition: ToolDefinition<I, O>): void {
    if (this.tools.has(definition.id)) throw new Error(`Tool already registered: ${definition.id}`);
    this.tools.set(definition.id, definition as ToolDefinition);
  }

  list() {
    return [...this.tools.values()].map(({ id, description, inputSchema, outputSchema, permissions }) => ({
      id, description, inputSchema: inputSchema.toJSONSchema(), outputSchema: outputSchema.toJSONSchema(), permissions,
    }));
  }

  get(id: string): ToolDefinition {
    const found = this.tools.get(id);
    if (!found) throw new Error(`Unknown tool: ${id}`);
    return found;
  }

  async invoke(id: string, input: unknown): Promise<unknown> {
    const definition = this.get(id);
    const parsed = definition.inputSchema.parse(input);
    return definition.outputSchema.parse(await definition.execute(parsed, this.context));
  }
}

export function createToolRegistry(checkout: string, githubCalls: ToolContext["githubCalls"] = [], allowedWrites?: readonly string[]): ToolRegistry {
  const registry = new ToolRegistry({ checkout, githubCalls, ...(allowedWrites ? { allowedWrites } : {}) });
  for (const tool of [readFileTool, writeFileTool, searchTool, shellTool, runTestsTool, gitBranchTool, gitStatusTool, gitDiffTool, gitCommitTool, gitWorktreeAddTool, gitWorktreeRemoveTool, gitDeletePartBranchTool, gitShowFilesTool, gitMergePartTool, gitMergeAbortTool, gitHeadTool, listIssuesTool, getIssueTool, createPullRequestTool, embedCodebaseTool, readMemoryTool, writeMemoryTool, deleteMemoryTool]) {
    registry.register(tool as ToolDefinition);
  }
  registry.register({
    id: "build_tool", description: "Create a run-scoped read tool from a manifest after its fixtures pass.",
    inputSchema: toolManifestSchema,
    outputSchema: (awaitableBuildOutput),
    permissions: ["read"],
    async execute(manifest) { return { id: await buildAndRegisterTool(registry, { checkout, githubCalls }, manifest) }; },
  });
  return registry;
}

const awaitableBuildOutput = z.object({ id: z.string() });
