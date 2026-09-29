import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { createPatch } from "../src/worker.js";

const execFileAsync = promisify(execFile);

test.each([false, true])("swarm patch includes all merged parts (correction: %s)", async (withCorrection) => {
  const root = await mkdtemp(join(tmpdir(), "tourist-worker-patch-"));
  const git = async (...args: string[]) => (await execFileAsync("git", ["-C", root, ...args])).stdout.trim();
  const commit = async (message: string) => {
    await git("add", "-A");
    await git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", message);
  };
  try {
    await git("init", "-b", "main");
    await writeFile(join(root, "seed.txt"), "base\n");
    await commit("base");
    const base = await git("rev-parse", "HEAD");
    for (const [index, file] of ["a.txt", "b.txt"].entries()) {
      await git("switch", "-c", `part-${index + 1}`);
      await writeFile(join(root, file), `part ${index + 1}\n`);
      await commit(`part ${index + 1}`);
      await git("switch", "main");
    }
    await git("switch", "-c", "integration");
    for (const branch of ["part-1", "part-2"]) {
      await git("-c", "user.name=Test", "-c", "user.email=test@example.com", "merge", "--no-ff", "--no-edit", branch);
    }
    if (withCorrection) {
      await writeFile(join(root, "b.txt"), "corrected part 2\n");
      await commit("correction");
    }

    const patch = await createPatch(root, base);
    expect(patch).toContain("diff --git a/a.txt b/a.txt");
    expect(patch).toContain("diff --git a/b.txt b/b.txt");
    expect(patch).toContain(withCorrection ? "+corrected part 2" : "+part 2");
    await git("switch", "main");
    const patchPath = join(root, "swarm.patch");
    await writeFile(patchPath, patch);
    await git("apply", "--check", patchPath);
    await git("apply", patchPath);
    expect(await readFile(join(root, "a.txt"), "utf8")).toBe("part 1\n");
    expect(await readFile(join(root, "b.txt"), "utf8")).toBe(withCorrection ? "corrected part 2\n" : "part 2\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
