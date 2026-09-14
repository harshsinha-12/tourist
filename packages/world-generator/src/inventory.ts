import type { FileKind, RepositoryFile } from "@tourist/protocol";

const SKIP_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "icns", "bmp", "tif", "tiff", "avif",
  "mp3", "mp4", "wav", "webm", "mov", "avi", "ogg",
  "woff", "woff2", "ttf", "otf", "eot",
  "pdf", "zip", "gz", "tgz", "rar", "7z", "wasm", "exe", "dmg", "bin", "svg",
]);

const SKIP_DIRECTORIES = new Set([
  "node_modules", ".git", ".next", "dist", "coverage", ".pnpm-store", ".turbo",
]);

const SKIP_PREFIXES = ["assets/", "apps/web/public/assets/"];
const SKIP_NAMES = new Set(["next-env.d.ts", ".ds_store"]);

const LANGUAGES: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  py: "Python", pyi: "Python",
  css: "CSS", scss: "SCSS", sass: "Sass", less: "Less",
  html: "HTML", htm: "HTML",
  json: "JSON", jsonc: "JSON",
  md: "Markdown", markdown: "Markdown", mdx: "MDX", rst: "reStructuredText", txt: "Text",
  yml: "YAML", yaml: "YAML", toml: "TOML", xml: "XML",
  sql: "SQL", graphql: "GraphQL", gql: "GraphQL",
  go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", kts: "Kotlin",
  rb: "Ruby", php: "PHP", swift: "Swift", dart: "Dart",
  c: "C", h: "C", cpp: "C++", cc: "C++", cxx: "C++", hpp: "C++",
  cs: "C#", sh: "Shell", bash: "Shell", zsh: "Shell", ps1: "PowerShell",
  tf: "Terraform", proto: "Protocol Buffers", prisma: "Prisma",
};

export function normalizeRepoPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function shouldIncludePath(path: string): boolean {
  const normalized = normalizeRepoPath(path);
  if (!normalized || normalized.endsWith("/")) return false;
  const parts = normalized.split("/");
  const name = parts.at(-1)?.toLowerCase() ?? "";
  if (SKIP_NAMES.has(name) || parts.some((part) => SKIP_DIRECTORIES.has(part))) return false;
  if (SKIP_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))) return false;
  const extension = name.includes(".") ? name.split(".").at(-1) ?? "" : "";
  return !SKIP_EXTENSIONS.has(extension);
}

export function classifyPath(path: string): { language: string; kind: FileKind } {
  const normalized = normalizeRepoPath(path).toLowerCase();
  const name = normalized.split("/").at(-1) ?? "";
  if (name === "license" || /^(licen[cs]e)(\.(md|txt|rst))?$/.test(name)) return { language: "Text", kind: "documentation" };
  if (name === ".gitignore" || name.endsWith("/.gitignore")) return { language: "Ignore", kind: "config" };
  if (name === "dockerfile" || name.endsWith(".dockerfile")) return { language: "Docker", kind: "config" };
  if (/^(gnu)?makefile$/.test(name) || name.endsWith(".mk")) return { language: "Make", kind: "config" };
  if (name === "gemfile" || name === "pipfile") return { language: "Ruby", kind: "config" };
  const kind: FileKind = isTestPath(normalized, name) ? "test"
    : /\.(md|mdx|rst|txt)$/.test(name) || name === "agents.md" || name === "claude.md" ? "documentation"
    : /\.(json|jsonc|ya?ml|toml|ini|npmrc|editorconfig)$/.test(name)
      || name.endsWith(".lock") || name.endsWith("-lock.yaml") || name.endsWith("-lock.json")
      || name === ".npmrc" || name === "pnpm-workspace.yaml" ? "config"
    : /\.(csv|tsv|sql)$/.test(name) ? "data"
    : "source";
  const extension = name.includes(".") ? name.split(".").at(-1) ?? "" : "";
  const language = name === ".npmrc" ? "npm"
    : LANGUAGES[extension] ?? (kind === "documentation" ? "Text" : kind === "config" ? "Config" : "Other");
  return { language, kind };
}

export function inventoryFromPaths(
  paths: readonly string[],
  locByPath: ReadonlyMap<string, number> = new Map(),
): RepositoryFile[] {
  return [...new Set(paths.map(normalizeRepoPath))]
    .filter(shouldIncludePath)
    .sort((left, right) => left.localeCompare(right))
    .map((path) => {
      const { language, kind } = classifyPath(path);
      return {
        path,
        language,
        kind,
        linesOfCode: locByPath.get(path) ?? 0,
        changeFrequency: 0,
        state: "idle" as const,
      };
    });
}

function isTestPath(path: string, name: string): boolean {
  return /(^|\/)(__tests__|tests?)\//.test(path)
    || /\.(test|spec)\.[^.]+$/.test(name)
    || /^test_.+\.py$/.test(name)
    || /_test\.(py|go)$/.test(name);
}
