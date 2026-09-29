export const TOOL_IDS = {
  writeFile: "write_file",
  runTests: "run_tests",
} as const;

export type ToolEventRule =
  | { kind: "path_on_success"; event: "file.changed"; field: string }
  | { kind: "exit_code"; success: "test.passed"; failure: "test.failed"; field: string };

export const TOOL_EVENT_RULES: Record<string, ToolEventRule> = {
  [TOOL_IDS.writeFile]: { kind: "path_on_success", event: "file.changed", field: "path" },
  [TOOL_IDS.runTests]: { kind: "exit_code", success: "test.passed", failure: "test.failed", field: "exitCode" },
};
