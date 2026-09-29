import { main } from "./cli.js";

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Tourist failed");
  process.exitCode = 1;
});
