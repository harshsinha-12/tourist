export type AgentRole = "supervisor" | "coder" | "researcher" | "tester" | "reviewer";

export interface TaskMemory {
  goal: string;
  decisions: string[];
  filesTouched: string[];
  openQuestions: string[];
  memoryPack: string[];
  decomposition?: Array<{ goal: string; files: string[] }>;
}

export const AGENT_ROLES = {
  supervisor: {
    instructions: "Choose the smallest useful topology. Never edit files. Pass only the shared task memory to specialists.",
    tools: [] as readonly string[],
  },
  coder: {
    instructions: "Inspect the checkout, implement the task, and keep the change focused. Run tests when useful. Do not commit or contact GitHub.",
    tools: ["read_file", "write_file", "search", "shell", "run_tests", "git_status", "git_diff"],
  },
  researcher: {
    instructions: "Research the local repository and report concrete findings. Do not edit files.",
    tools: ["read_file", "search"],
  },
  tester: {
    instructions: "Inspect the change, add or improve a regression test if appropriate, and run the test suite. Do not edit product code.",
    tools: ["read_file", "write_file", "search", "run_tests", "git_diff"],
  },
  reviewer: {
    instructions: "Review the diff for correctness, scope, and test coverage. Begin your final answer with ACCEPT or CHANGES_REQUIRED: and give a concise reason. Do not edit files.",
    tools: ["read_file", "git_diff"],
  },
} as const;

export function chooseTopology(task: string, parts?: readonly { files: readonly string[] }[]): "solo_coder" | "coder_tester_reviewer" | "swarm" {
  if (parts && parts.length >= 2) return "swarm";
  return /\b(?:bug|fix|race|regression|auth|security|refactor)\b/i.test(task) || task.length > 120
    ? "coder_tester_reviewer"
    : "solo_coder";
}
