import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await Promise.all([
  build({ entryPoints: ["src/bin.ts"], outfile: "dist/server.cjs", bundle: true, platform: "node", target: "node22", format: "cjs", legalComments: "none" }),
  build({ entryPoints: ["src/worker.ts"], outfile: "dist/worker.cjs", bundle: true, platform: "node", target: "node22", format: "cjs", legalComments: "none" }),
]);
