import { PublicReportSchema, type PublicReport } from "@tourist/protocol";
import { generateCitySnapshot, inventoryFromPaths } from "@tourist/world-generator";

const MAX_FILES = 400;

export async function loadGitHubRepositoryReport(owner: string, repo: string): Promise<PublicReport> {
  const { paths, revision } = await fetchGitHubTree(owner, repo);
  const files = inventoryFromPaths(paths).slice(0, MAX_FILES).map((file) => ({
    ...file,
    linesOfCode: file.linesOfCode || estimateLines(file.path),
  }));
  const name = `${owner}/${repo}`;
  const snapshot = generateCitySnapshot({
    id: `github-${owner}-${repo}`,
    repository: { name, revision },
    files,
    report: { includeTests: true, includePullRequest: true },
  });
  const sectors = snapshot.sectors.map((sector) => sector.name).join(", ");
  return PublicReportSchema.parse({
    id: `github-${owner}-${repo}`,
    title: `${name} as a city`,
    summary: `${snapshot.buildings.length} files from ${name} are on the island, grouped into ${snapshot.sectors.length} sectors (${sectors || "root"}).`,
    createdAt: new Date().toISOString(),
    snapshot,
    sections: [
      {
        id: "section-import",
        eyebrow: "GitHub import",
        title: "This island is the public tree",
        body: `Tourist mapped the default branch of ${name}. Images and generated assets stay off the map, same as a local scan.`,
        status: "success",
        anchorId: snapshot.anchors[0]?.id ?? "anchor-tests",
      },
    ],
  });
}

function estimateLines(path: string): number {
  let hash = 0;
  for (const character of path) hash = (hash * 33 + character.charCodeAt(0)) >>> 0;
  return 24 + (hash % 420);
}

async function fetchGitHubTree(owner: string, repo: string): Promise<{ paths: string[]; revision: string }> {
  const repoResponse = await github(`/repos/${owner}/${repo}`);
  if (!repoResponse.ok) {
    throw new GitHubImportError(repoResponse.status === 404 ? "That repository is missing or private." : "GitHub could not open that repository.");
  }
  const meta = await repoResponse.json() as { default_branch?: string };
  const branch = meta.default_branch || "HEAD";
  const treeResponse = await github(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  if (!treeResponse.ok) {
    throw new GitHubImportError("GitHub would not share that repository’s file tree.");
  }
  const body = await treeResponse.json() as { sha?: string; tree?: Array<{ path?: string; type?: string }> };
  const paths = (body.tree ?? []).filter((entry) => entry.type === "blob" && entry.path).map((entry) => entry.path!);
  if (paths.length === 0) throw new GitHubImportError("That repository has no files Tourist can map.");
  return { paths, revision: (body.sha ?? branch).slice(0, 7) };
}

async function github(path: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "tourist-city" },
    next: { revalidate: 300 },
  });
}

export class GitHubImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubImportError";
  }
}
