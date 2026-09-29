import type { z } from "zod";

export interface ToolContext {
  checkout: string;
  githubCalls: Array<{ name: string; input: unknown }>;
}

export interface ToolDefinition<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  id: string;
  description: string;
  inputSchema: I;
  outputSchema: O;
  permissions: readonly ("read" | "write" | "process" | "git" | "record")[];
  execute(input: z.output<I>, context: ToolContext): Promise<z.output<O>>;
}

export function defineTool<I extends z.ZodType, O extends z.ZodType>(tool: ToolDefinition<I, O>): ToolDefinition<I, O> {
  return tool;
}
