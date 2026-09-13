import type { BuildingArchetype } from "./types";
export interface PickBuilding { path: string; language: string; kind?: string; }

const lockfiles = new Set([
  "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock",
  "bun.lock", "bun.lockb", "cargo.lock", "poetry.lock", "uv.lock", "pipfile.lock",
  "composer.lock", "gemfile.lock", "go.sum", "packages.lock.json",
]);

export function resolveArchetype(
  building: PickBuilding,
  registry: readonly BuildingArchetype[],
  fallback: BuildingArchetype,
): BuildingArchetype {
  const path = building.path.replaceAll("\\", "/").toLowerCase();
  const name = path.split("/").at(-1) ?? "";
  const special = lockfiles.has(name) ? "lockfile"
    : name === ".env" || name.startsWith(".env.") ? "environment"
    : name === ".gitignore" ? "gitignore"
    : /^(licen[cs]e)(\.(md|txt|rst))?$/.test(name) ? "license"
    : /^(dockerfile)(\..+)?$/.test(name) || name.endsWith(".dockerfile") ? "docker"
    : /^(gnu)?makefile$/.test(name) || name.endsWith(".mk") ? "makefile"
    : building.kind === "test" || /(^|\/)(__tests__|tests?)\//.test(path)
      || /\.(test|spec)\.[^.]+$/.test(name) || /^test_.+\.py$/.test(name) || /_test\.(py|go)$/.test(name) ? "test"
    : undefined;
  if (special) {
    const match = registry.find((entry) => entry.design.id === special);
    if (match) return match;
  }
  const extension = name.includes(".") ? name.split(".").at(-1) : undefined;
  return registry.find((entry) => extension && entry.extensions.includes(extension))
    ?? registry.find((entry) => entry.languages.includes(building.language.trim().toLowerCase()))
    ?? fallback;
}
