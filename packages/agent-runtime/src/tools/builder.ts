import { readFile } from "node:fs/promises";
import { z } from "zod";
import { safePath } from "./utils.js";
import { defineTool, type ToolContext } from "./types.js";
import type { ToolRegistry } from "./registry.js";

/** Deliberately constrained implementation grammar: no generated JavaScript or shell. */
export const toolManifestSchema = z.object({
  id: z.string().regex(/^local_[a-z][a-z0-9_]{2,40}$/),
  description: z.string().trim().min(8).max(200),
  operation: z.literal("count_lines"),
  fixtures: z.array(z.object({ path: z.string().min(1), expected: z.number().int().nonnegative() }).strict()).min(1).max(5),
}).strict();

export async function buildAndRegisterTool(registry: ToolRegistry, context: ToolContext, raw: unknown): Promise<string> {
  const manifest = toolManifestSchema.parse(raw);
  registry.get("read_file"); // Built tools depend only on this vetted read capability.
  const implementation = defineTool({
    id: manifest.id, description: manifest.description,
    inputSchema: z.object({ path: z.string().min(1) }),
    outputSchema: z.object({ path: z.string(), lines: z.number().int().nonnegative() }),
    permissions: ["read"],
    async execute({ path }, { checkout }) {
      const content = await readFile(await safePath(checkout, path), "utf8");
      if (content.length > 200_000) throw new Error("File too large");
      return { path, lines: content.length === 0 ? 0 : content.split("\n").length - Number(content.endsWith("\n")) };
    },
  });
  for (const fixture of manifest.fixtures) {
    const result = await implementation.execute({ path: fixture.path }, context);
    if (result.lines !== fixture.expected) throw new Error(`Tool fixture failed: ${fixture.path}`);
  }
  registry.register(implementation);
  return manifest.id;
}
