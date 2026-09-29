import { chooseTopology } from "./roles.js";
import { runSoloTask, type RunEvent, type SoloRun, type SoloTask } from "./solo.js";
import { runTeamTask, type TeamRun } from "./team.js";
import { runSwarmTask, type SwarmRun } from "./swarm.js";
import { TOOL_EVENT_RULES } from "../config/tool-events.js";

/** Stage 3 supervisor: small tasks stay solo; bugs and larger work use specialists. */
export async function runTask(task: SoloTask): Promise<(SoloRun | TeamRun | SwarmRun) & { events: RunEvent[] }> {
  const events: RunEvent[] = [];
  const emit = async (event: RunEvent) => { events.push(event); await task.onEvent?.(event); };
  const wrapped: SoloTask = { ...task,
    onEvent: emit,
    onTool: async (trace) => {
      await task.onTool?.(trace);
      await emit({ type: "tool.called", at: trace.at, tool: trace.name });
      const rule = TOOL_EVENT_RULES[trace.name];
      if (rule?.kind === "path_on_success") {
        const path = trace.input[rule.field];
        if (typeof path === "string" && !trace.result.error) await emit({ type: rule.event, at: trace.at, path });
      } else if (rule?.kind === "exit_code") {
        await emit({ type: trace.result[rule.field] === 0 ? rule.success : rule.failure, at: trace.at });
      }
    },
  };
  const topology = chooseTopology(task.task, task.swarmParts);
  const result = topology === "swarm" ? await runSwarmTask(wrapped) : topology === "solo_coder" ? await runSoloTask(wrapped) : await runTeamTask(wrapped);
  return { ...result, events };
}
