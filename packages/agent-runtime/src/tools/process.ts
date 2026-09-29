import { z } from "zod";
import { defineTool } from "./types.js";
import { runCommand, safePath } from "./utils.js";

const output = z.object({ exitCode: z.number().int(), stdout: z.string(), stderr: z.string() });
const command = z.enum(["node", "pnpm", "npm"]);

function allowed(program: z.infer<typeof command>, args: string[]): boolean {
  if (program === "node") return args[0] === "--test" && args.length <= 2 && (!args[1] || /^[\w./-]+\.(?:js|mjs|cjs)$/.test(args[1]));
  return args.length === 1 && ["test", "typecheck", "build"].includes(args[0] ?? "");
}

export const shellTool = defineTool({
  id: "shell", description: "Run an allowlisted local test or build command. No arbitrary shell strings.",
  inputSchema: z.object({ program: command, args: z.array(z.string()).max(2) }), outputSchema: output, permissions: ["process"],
  async execute({ program, args }, { checkout }) {
    if (!allowed(program, args)) throw new Error("Command is not allowlisted");
    if (program === "node" && args[1]) await safePath(checkout, args[1]);
    return runCommand(checkout, program, args, 120_000);
  },
});

export const runTestsTool = defineTool({
  id: "run_tests", description: "Run the fixture's Node test suite inside the checkout.",
  inputSchema: z.object({}), outputSchema: output, permissions: ["process"],
  async execute(_input, { checkout }) { return runCommand(checkout, "node", ["--test"], 120_000); },
});
