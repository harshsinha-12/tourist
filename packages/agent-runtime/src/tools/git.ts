import { z } from "zod";
import { defineTool } from "./types.js";
import { runCommand } from "./utils.js";

const result = z.object({ exitCode: z.number().int(), stdout: z.string(), stderr: z.string() });
const branchName = z.string().regex(/^tourist\/task-[a-z0-9][a-z0-9-]{0,48}$/);

export const gitBranchTool = defineTool({
  id: "git_branch", description: "Create and switch to a local tourist task branch.",
  inputSchema: z.object({ name: branchName }), outputSchema: result, permissions: ["git"],
  async execute({ name }, { checkout }) { return runCommand(checkout, "git", ["switch", "-c", name]); },
});

export const gitStatusTool = defineTool({
  id: "git_status", description: "Show local branch and changed files.",
  inputSchema: z.object({}), outputSchema: result, permissions: ["git", "read"],
  async execute(_input, { checkout }) { return runCommand(checkout, "git", ["status", "--short", "--branch"]); },
});

export const gitDiffTool = defineTool({
  id: "git_diff", description: "Show the local unstaged or staged diff.",
  inputSchema: z.object({ staged: z.boolean().default(false) }), outputSchema: result, permissions: ["git", "read"],
  async execute({ staged }, { checkout }) { return runCommand(checkout, "git", staged ? ["diff", "--cached"] : ["diff"]); },
});

export const gitCommitTool = defineTool({
  id: "git_commit", description: "Commit local changes on a tourist task branch; cannot push.",
  inputSchema: z.object({ message: z.string().min(3).max(120) }), outputSchema: result, permissions: ["git", "write"],
  async execute({ message }, { checkout }) {
    const branch = await runCommand(checkout, "git", ["branch", "--show-current"]);
    if (branch.exitCode !== 0 || !branch.stdout.trim().startsWith("tourist/task-")) throw new Error("Commit requires a tourist task branch");
    const added = await runCommand(checkout, "git", ["add", "-A", "--", ".", ":(exclude).env*", ":(exclude)**/.env*", ":(exclude)*.pem", ":(exclude)**/*.pem"]);
    if (added.exitCode !== 0) return added;
    return runCommand(checkout, "git", ["-c", "user.name=Tourist Agent", "-c", "user.email=tourist-agent@localhost", "commit", "-m", message]);
  },
});
