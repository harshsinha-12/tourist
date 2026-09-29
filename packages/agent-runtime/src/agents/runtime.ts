import { chooseTopology } from "./roles.js";
import { runSoloTask, type SoloRun, type SoloTask } from "./solo.js";
import { runTeamTask, type TeamRun } from "./team.js";

/** Stage 3 supervisor: small tasks stay solo; bugs and larger work use specialists. */
export function runTask(task: SoloTask): Promise<SoloRun | TeamRun> {
  return chooseTopology(task.task) === "solo_coder" ? runSoloTask(task) : runTeamTask(task);
}
