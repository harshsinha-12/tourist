import { cache } from "react";
import { PublicReportSchema, type PublicReport } from "@tourist/protocol";
import { generateCitySnapshot } from "@tourist/world-generator";
import { resolveRepositoryRoot, scanLocalRepository } from "./scan-local-repo";
import { loadGitHubRepositoryReport } from "./github-report";

export const LOCAL_REPORT_ID = "tourist-city-foundation";
const SPARSE_SCAN = 8;

export const loadLocalRepositoryReport = cache(async (): Promise<PublicReport> => {
  const root = await resolveRepositoryRoot();
  const { name, revision, files, changedPaths } = await scanLocalRepository(root);
  if (files.length < SPARSE_SCAN) {
    const fallback = await githubIslandFallback();
    if (fallback) return fallback;
  }
  const snapshot = generateCitySnapshot({
    id: "tourist-local-v1",
    repository: { name, revision },
    files,
    report: {
      changedPaths,
      anchorPaths: [
        "apps/web/components/CityCanvas.tsx",
        "packages/protocol/src/index.ts",
        "scripts/prepare-building-sprites.py",
      ],
      includeTests: true,
      includePullRequest: true,
    },
  });
  const sectors = snapshot.sectors.map((sector) => sector.name).join(", ");
  return PublicReportSchema.parse({
    id: LOCAL_REPORT_ID,
    title: `${name} as a city`,
    summary: `${snapshot.buildings.length} source files are on the island, grouped into ${snapshot.sectors.length} sectors (${sectors || "root"}). Gitignored paths, images, and generated sprites stay off the map.`,
    createdAt: new Date().toISOString(),
    snapshot,
    sections: [
      {
        id: "section-viewer",
        eyebrow: "City viewer",
        title: "Every kept file has a plot",
        body: "The island is generated from this repository’s source tree. Scripts, packages, apps, and docs become buildings; images and generated assets do not.",
        status: "success",
        anchorId: snapshot.anchors.find((anchor) => anchor.id.includes("citycanvas"))?.id ?? "anchor-tests",
      },
      {
        id: "section-scripts",
        eyebrow: "Scripts",
        title: "Prepare jobs live on the island too",
        body: "Python and Node scripts under scripts/ are first-class buildings, the same as application source.",
        status: "success",
        anchorId: snapshot.anchors.find((anchor) => anchor.id.includes("prepare-building-sprites"))?.id ?? snapshot.anchors[0]?.id ?? "anchor-tests",
      },
      {
        id: "section-tests",
        eyebrow: "Verification",
        title: "The generator is deterministic",
        body: "Tests cover stable output, unique plots, folder mapping, and the inventory filters that drop media and ignored paths.",
        status: "success",
        anchorId: "anchor-tests",
      },
      {
        id: "section-pr",
        eyebrow: "Delivery",
        title: "Ready for a public GitHub URL",
        body: "The same inventory rules can later accept a GitHub tree listing. This stage maps only the local working copy.",
        status: "neutral",
        anchorId: "anchor-pull-request",
      },
    ],
  });
});

export function createRepositoryReport(report: PublicReport): PublicReport {
  return PublicReportSchema.parse(report);
}

async function githubIslandFallback(): Promise<PublicReport | undefined> {
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const repo = process.env.VERCEL_GIT_REPO_SLUG;
  if (!owner || !repo) return undefined;
  try {
    const report = await loadGitHubRepositoryReport(owner, repo);
    return PublicReportSchema.parse({ ...report, id: LOCAL_REPORT_ID });
  } catch {
    return undefined;
  }
}
