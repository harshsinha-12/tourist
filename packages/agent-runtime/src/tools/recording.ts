import { z } from "zod";
import { defineTool } from "./types.js";

const repo = z.object({ owner: z.string().regex(/^[\w-]+$/), repo: z.string().regex(/^[\w.-]+$/) });
const recorded = z.object({ recorded: z.literal(true), callIndex: z.number().int() });

export const listIssuesTool = defineTool({
  id: "list_issues", description: "Record a future GitHub issue-list call without contacting GitHub.",
  inputSchema: repo, outputSchema: recorded, permissions: ["record"],
  async execute(input, context) { context.githubCalls.push({ name: "list_issues", input }); return { recorded: true as const, callIndex: context.githubCalls.length - 1 }; },
});

export const getIssueTool = defineTool({
  id: "get_issue", description: "Record a future GitHub issue-read call without contacting GitHub.",
  inputSchema: repo.extend({ number: z.number().int().positive() }), outputSchema: recorded, permissions: ["record"],
  async execute(input, context) { context.githubCalls.push({ name: "get_issue", input }); return { recorded: true as const, callIndex: context.githubCalls.length - 1 }; },
});

export const createPullRequestTool = defineTool({
  id: "create_pull_request", description: "Record an intended pull request without contacting GitHub.",
  inputSchema: repo.extend({ head: branchName(), base: z.string().min(1), title: z.string().min(1), body: z.string() }),
  outputSchema: recorded, permissions: ["record"],
  async execute(input, context) { context.githubCalls.push({ name: "create_pull_request", input }); return { recorded: true as const, callIndex: context.githubCalls.length - 1 }; },
});

function branchName() { return z.string().regex(/^tourist\/task-[a-z0-9][a-z0-9-]{0,48}$/); }

const unavailable = (id: string, description: string) => defineTool({
  id, description, inputSchema: z.object({}), outputSchema: z.object({ available: z.literal(false), reason: z.string() }), permissions: ["read"] as const,
  async execute() { return { available: false as const, reason: "Available in Stage 6" }; },
});

export const embedCodebaseTool = unavailable("embed_codebase", "Stage 6 code indexing placeholder.");
export const readMemoryTool = unavailable("read_memory", "Stage 6 memory lookup placeholder.");
export const writeMemoryTool = unavailable("write_memory", "Stage 6 memory write placeholder.");
export const deleteMemoryTool = unavailable("delete_memory", "Stage 6 supervisor-only deletion placeholder.");
