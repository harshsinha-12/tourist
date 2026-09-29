import { z } from "zod";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative } from "node:path";
import { defineTool } from "./types.js";
import { runCommand } from "./utils.js";

const result = z.object({ exitCode: z.number().int(), stdout: z.string(), stderr: z.string() });
const branchName = z.string().regex(/^tourist\/task-[a-z0-9][a-z0-9-]{0,48}$/);
const partBranch = z.string().regex(/^tourist\/task-[a-z0-9-]+-part-[0-9]+$/);

async function checkedWorktreePath(path: string) {
  if (!isAbsolute(path) || !basename(dirname(path)).startsWith("tourist-swarm-")) throw new Error("Invalid swarm worktree path");
  const parent = await realpath(dirname(path));
  const rel = relative(await realpath(tmpdir()), parent);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Worktree must be in the temporary directory");
  return path;
}

export const gitWorktreeAddTool = defineTool({
  id: "git_worktree_add", description: "Create an isolated local task worktree and branch.",
  inputSchema: z.object({ path: z.string(), branch: partBranch }), outputSchema: result, permissions: ["git", "write"],
  async execute({ path, branch }, { checkout }) { return runCommand(checkout, "git", ["worktree", "add", "-b", branch, await checkedWorktreePath(path)]); },
});

export const gitWorktreeRemoveTool = defineTool({
  id: "git_worktree_remove", description: "Remove a clean isolated task worktree.",
  inputSchema: z.object({ path: z.string() }), outputSchema: result, permissions: ["git", "write"],
  async execute({ path }, { checkout }) { return runCommand(checkout, "git", ["worktree", "remove", await checkedWorktreePath(path)]); },
});

export const gitDeletePartBranchTool = defineTool({
  id: "git_delete_part_branch", description: "Delete an integrated local swarm part branch.",
  inputSchema: z.object({ branch: partBranch }), outputSchema: result, permissions: ["git", "write"],
  async execute({ branch }, { checkout }) { return runCommand(checkout, "git", ["branch", "-D", branch]); },
});

export const gitShowFilesTool = defineTool({
  id: "git_show_files", description: "List files changed in the latest local commit.",
  inputSchema: z.object({}), outputSchema: result, permissions: ["git", "read"],
  async execute(_input, { checkout }) { return runCommand(checkout, "git", ["show", "--pretty=format:", "--name-only", "HEAD"]); },
});

export const gitHeadTool = defineTool({
  id: "git_head", description: "Read the current local commit ID.",
  inputSchema: z.object({}), outputSchema: result, permissions: ["git", "read"],
  async execute(_input, { checkout }) { return runCommand(checkout, "git", ["rev-parse", "HEAD"]); },
});

export const gitMergePartTool = defineTool({
  id: "git_merge_part", description: "Merge a local swarm part branch into the task branch.",
  inputSchema: z.object({ branch: partBranch }), outputSchema: result, permissions: ["git", "write"],
  async execute({ branch }, { checkout }) {
    const current = await runCommand(checkout, "git", ["branch", "--show-current"]);
    if (!current.stdout.trim().startsWith("tourist/task-")) throw new Error("Merge requires a tourist task branch");
    return runCommand(checkout, "git", ["-c", "user.name=Tourist Agent", "-c", "user.email=tourist-agent@localhost", "merge", "--no-ff", "--no-edit", branch]);
  },
});

export const gitMergeAbortTool = defineTool({
  id: "git_merge_abort", description: "Abort a conflicted local part merge.",
  inputSchema: z.object({}), outputSchema: result, permissions: ["git", "write"],
  async execute(_input, { checkout }) { return runCommand(checkout, "git", ["merge", "--abort"]); },
});

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
