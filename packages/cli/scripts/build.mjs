import { build } from "esbuild";
import { chmod, mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/bin.ts"],
  outfile: "dist/cli.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  banner: { js: "#!/usr/bin/env node" },
  legalComments: "none",
});
await chmod("dist/cli.cjs", 0o755);
