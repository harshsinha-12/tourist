import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { defineTool } from "./types.js";
import { safePath, runCommand } from "./utils.js";

export const readFileTool = defineTool({
  id: "read_file", description: "Read a UTF-8 file inside the local checkout.",
  inputSchema: z.object({ path: z.string().min(1) }),
  outputSchema: z.object({ path: z.string(), content: z.string() }), permissions: ["read"],
  async execute({ path }, { checkout }) {
    const content = await readFile(await safePath(checkout, path), "utf8");
    if (content.length > 200_000) throw new Error("File too large for read_file");
    return { path, content };
  },
});

export const writeFileTool = defineTool({
  id: "write_file", description: "Write a UTF-8 file inside the local checkout.",
  inputSchema: z.object({ path: z.string().min(1), content: z.string().max(200_000) }),
  outputSchema: z.object({ path: z.string(), bytes: z.number().int() }), permissions: ["write"],
  async execute({ path, content }, { checkout }) {
    await writeFile(await safePath(checkout, path, true), content, { encoding: "utf8", flag: "w" });
    return { path, bytes: Buffer.byteLength(content) };
  },
});

export const searchTool = defineTool({
  id: "search", description: "Search tracked and untracked checkout text with ripgrep (literal text).",
  inputSchema: z.object({ query: z.string().min(1).max(200) }),
  outputSchema: z.object({ matches: z.string(), truncated: z.boolean() }), permissions: ["read"],
  async execute({ query }, { checkout }) {
    const result = await runCommand(checkout, "rg", ["-n", "--fixed-strings", "--max-count", "20", "--glob", "!.git/**", "--glob", "!node_modules/**", "--glob", "!.env*", "--glob", "!**/.env*", "--glob", "!*.pem", "--", query, "."]);
    if (result.exitCode > 1) throw new Error(result.stderr || "Search failed");
    return { matches: result.stdout.slice(0, 50_000), truncated: result.stdout.length > 50_000 };
  },
});
