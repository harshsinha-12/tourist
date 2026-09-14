const GITHUB_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/?#].*)?$/i;
const SHORT = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;

export function parseGitHubRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const match = trimmed.match(GITHUB_URL) ?? trimmed.match(SHORT);
  if (!match) return null;
  const owner = match[1]!;
  const repo = match[2]!.replace(/\.git$/i, "");
  if (!owner || !repo || owner === "." || repo === "." || owner.startsWith("-") || repo.startsWith("-")) return null;
  return { owner, repo };
}

export function cityPath(owner: string, repo: string): string {
  return `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}
