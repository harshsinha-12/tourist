import { execFile } from "node:child_process";
import { realpath, lstat, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
}

export async function checkoutRoot(checkout: string): Promise<string> {
  return realpath(checkout);
}

export async function safePath(checkout: string, path: string, createParent = false): Promise<string> {
  if (!path || isAbsolute(path)) throw new Error("Expected a nonempty checkout-relative path");
  if (path.split(/[\\/]/).some((part) => part === ".git" || part === "node_modules" || part === ".env" || part.startsWith(".env.") || part.endsWith(".pem"))) {
    throw new Error("Protected path");
  }
  const root = await checkoutRoot(checkout);
  const target = resolve(root, path);
  if (!inside(root, target) || target === root) throw new Error("Path escapes checkout");
  let cursor = root;
  for (const part of relative(root, dirname(target)).split(process.platform === "win32" ? "\\" : "/").filter(Boolean)) {
    cursor = resolve(cursor, part);
    try {
      const stat = await lstat(cursor);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Path parent must be a directory inside checkout");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  if (createParent) await mkdir(dirname(target), { recursive: true });
  const parent = await realpath(dirname(target));
  if (!inside(root, parent)) throw new Error("Path parent escapes checkout");
  try {
    const stat = await lstat(target);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Only regular files are allowed");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return target;
}

export async function runCommand(checkout: string, command: string, args: string[], timeout = 30_000) {
  const cwd = await checkoutRoot(checkout);
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)/i.test(name)));
    const result = await execFileAsync(command, args, { cwd, timeout, maxBuffer: 1_000_000, env });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as Error & { code?: number | string; stdout?: string; stderr?: string };
    return { exitCode: typeof failure.code === "number" ? failure.code : 1, stdout: failure.stdout ?? "", stderr: failure.stderr ?? failure.message };
  }
}
